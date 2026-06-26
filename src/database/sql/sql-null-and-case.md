---
title: "NULL 和 CASE WHEN 有哪些坑？"
description: "讲清 NULL 的三值逻辑、聚合忽略 NULL，以及 CASE WHEN 的条件聚合与行转列。"
breadcrumb: true
article: true
editLink: false
category:
  - "SQL"
tag:
  - "高频"
  - "细节题"
  - "基础"
prev:
  text: "窗口函数解决什么问题？"
  link: "/database/sql/sql-window-functions.html"
next:
  text: "分页查询怎么写？深度分页怎么优化？"
  link: "/database/sql/sql-pagination.html"
---

# NULL 和 CASE WHEN 有哪些坑？

> NULL 不是"空字符串"也不是"0"，它是"未知/缺失"。就这一个定义，引出了 SQL 里最反直觉的一类坑：比较结果不是真假两值而是三值、聚合函数悄悄跳过它、`NOT IN` 碰上它整段失效。再配上 `CASE WHEN` 做条件聚合，就是面试里"写 SQL 题"最常考的组合。

## NULL 是什么：未知，不是空

NULL 表示"这个值缺失或未知"，它**不是一个具体的值**。所以拿它跟任何东西比，结果都不是"相等"或"不等"，而是"不知道"。

这就引出 SQL 的**三值逻辑**：比较运算的结果有三种——`TRUE`、`FALSE`、`UNKNOWN`。

| 表达式        | 结果    | 为什么                       |
| ------------- | ------- | ---------------------------- |
| `5 = 5`       | TRUE    | 明确相等                     |
| `5 = 6`       | FALSE   | 明确不等                     |
| `NULL = 5`    | UNKNOWN | NULL 是未知，没法判断        |
| `NULL = NULL` | UNKNOWN | 两个未知，还是不知道是否相等 |
| `NULL <> 5`   | UNKNOWN | 同理                         |

`UNKNOWN` 在 `WHERE` 里被当作"不满足"——只有 `TRUE` 的行才会被选出。所以 `WHERE col = NULL` 永远查不出任何行，哪怕 col 里确实有 NULL。

## 判断 NULL 只能用 IS NULL

因为 `=` 对 NULL 永远是 UNKNOWN，判断一个值是不是 NULL 必须**用专用谓词**：

```sql
SELECT * FROM orders WHERE submit_time IS NULL;     -- ✅ 查未提交的
SELECT * FROM orders WHERE submit_time IS NOT NULL; -- ✅ 查已提交的
SELECT * FROM orders WHERE submit_time = NULL;      -- ❌ 永远查不到，别这么写
```

这是最基础也最常犯的错：用 `= NULL` 而不是 `IS NULL`。记住一句：**判断 NULL 用 `IS NULL`，判断值用 `=`，两者不通用。**

## 聚合函数会忽略 NULL

`COUNT`、`SUM`、`AVG`、`MAX`、`MIN` 这些聚合函数，处理时**自动跳过 NULL**。这既是好事也是坑：

```sql
-- AVG 只算非 NULL 的行，分母不含 NULL
SELECT AVG(score) FROM exam_record;
-- 等价于 SUM(score) / COUNT(score)，不是 / COUNT(*)
```

几个要点：

- **`COUNT(*)` 数所有行（含 NULL），`COUNT(列)` 只数非 NULL 行**。这条最关键——`COUNT(*)` 和 `COUNT(submit_time)` 的差，正好是"该列为 NULL 的行数"。真题里常这么算"未完成数"：`COUNT(*) - COUNT(submit_time)`。
- **`AVG`/`SUM` 忽略 NULL**：有缺失值时，平均值的分母会变小，结果可能和直觉不符。
- **`SUM` 对全 NULL 的列结果是 NULL，不是 0**：要 0 得 `COALESCE(SUM(x), 0)`。

> 想深入 `COUNT(*)`/`COUNT(1)`/`COUNT(列)` 的性能差别，见 [MySQL count 专题](../mysql/mysql-count.html)，这里只讲语义。

## NULL 的运算传染：碰到就变 NULL

NULL 参与算术运算，结果也是 NULL（因为"未知 + 任何 = 未知"）：

```sql
SELECT 100 + NULL;   -- NULL，不是 100
SELECT NULL * 0;     -- NULL，不是 0
```

这在线上很危险：一个本该是 0 的字段如果是 NULL，参与汇总后就可能把整列结果污染成 NULL。处理办法是 `COALESCE(col, 0)` 或 MySQL 的 `IFNULL(col, 0)`，把 NULL 兜底成默认值再算。

## NOT IN 遇 NULL 的经典陷阱

这点在 [子查询篇](./sql-subquery.html) 提过，这里补全原理。`NOT IN` 碰上子查询结果含 NULL，会**整段变空**：

```sql
SELECT * FROM customers
WHERE  cust_id NOT IN (SELECT cust_id FROM orders WHERE amount > 500);
```

若子查询返回 `(1, 2, NULL)`，`x NOT IN (1, 2, NULL)` 展开成 `x<>1 AND x<>2 AND x<>NULL`，而 `x<>NULL` 是 UNKNOWN，整个 AND 链被 UNKNOWN 拖垮，没有任何行能满足。结论：**用 `NOT IN` 前先确认结果无 NULL，或改用 `NOT EXISTS`。**

## CASE WHEN：条件表达式

`CASE WHEN` 是 SQL 里的 if-else，两种写法：

```sql
-- 搜索型 CASE（条件任意，最常用）
CASE WHEN score >= 90 THEN 'A'
     WHEN score >= 60 THEN 'B'
     ELSE 'C' END

-- 简单型 CASE（按相等匹配）
CASE level WHEN 1 THEN '新手'
           WHEN 2 THEN '进阶'
           ELSE '其他' END
```

要点：从上往下匹配，命中即停；`ELSE` 可省，省了且都不命中返回 NULL；`END` 不能漏。

## 条件聚合：CASE WHEN + 聚合

`CASE WHEN` 套进聚合函数里，能做"按条件分别统计"——这是写 SQL 题的核心技巧。比如"统计每份试卷的完成数和未完成数"：

```sql
SELECT exam_id,
       COUNT(CASE WHEN submit_time IS NOT NULL THEN 1 END) AS done_cnt,
       COUNT(CASE WHEN submit_time IS NULL     THEN 1 END) AS undone_cnt
FROM   exam_record
GROUP BY exam_id;
```

原理：`CASE WHEN ... THEN 1 END` 命中时返回 1、不命中返回 NULL，而 `COUNT` 忽略 NULL，所以只数命中的行。等价的简写还有 `SUM(submit_time IS NULL)`——`submit_time IS NULL` 是布尔表达式，MySQL 里 TRUE=1、FALSE=0，求和正好数出 TRUE 的个数。

这个模式能替代很多"本来要写多个子查询再 JOIN"的需求：一次 GROUP BY，用条件聚合把多个维度同时算出来。

## 行转列：CASE WHEN + 聚合

把"行"变成"列"的经典做法也是条件聚合。比如把每个用户各科成绩从行转成列：

原始（一行一科）：

| uid | subject | score |
| --- | ------- | ----- |
| 1   | math    | 90    |
| 1   | english | 80    |

转列后（一行一用户）：

```sql
SELECT uid,
       MAX(CASE WHEN subject = 'math'    THEN score END) AS math,
       MAX(CASE WHEN subject = 'english' THEN score END) AS english
FROM   scores
GROUP BY uid;
```

| uid | math | english |
| --- | ---- | ------- |
| 1   | 90   | 80      |

每个科目用一个 `CASE WHEN` 单独成一列，外面套 `MAX`（或 `SUM`）把分组内的多行压成一个值。这就是"行转列"的标准写法，面试常考。

## 容易踩的坑

- **`= NULL` 查不到东西**：判断 NULL 必须用 `IS NULL`/`IS NOT NULL`。
- **聚合忽略 NULL**：`COUNT(列)` 不数 NULL、`AVG` 分母不含 NULL 行，结果和直觉可能差很多。
- **NULL 算术传染**：`x + NULL = NULL`，汇总前用 `COALESCE`/`IFNULL` 兜底。
- **`NOT IN` 遇 NULL 全空**：改用 `NOT EXISTS` 或先 `IS NOT NULL`。
- **`SUM` 全 NULL 得 NULL 非 0**：要 0 得 `COALESCE`。

## 小结

- NULL 是"未知"不是"空值"，比较结果是三值（TRUE/FALSE/UNKNOWN），判断它只能用 `IS NULL`。
- 聚合函数自动忽略 NULL：`COUNT(*)` 数全部、`COUNT(列)` 数非 NULL，差值可算 NULL 行数。
- NULL 参与算术会传染成 NULL，`NOT IN` 碰上 NULL 整段失效。
- `CASE WHEN` 套进聚合做"条件聚合"，能一次 GROUP BY 算多个维度，替代多个子查询。
- 行转列用 `MAX(CASE WHEN ... THEN ... END)` 逐列展开。

## 参考

综合社区 SQL 题目中空值处理、条件语句章节的真题写法（`COUNT(*)-COUNT(submit_time)`、`COUNT(CASE WHEN...)`、`SUM(条件)`、`IF` 处理 NULL）及语法资料重写；其中"三值逻辑""NULL 算术传染""NOT IN 失效原理"是资料未展开、这里系统讲清的部分，并与 [子查询](./sql-subquery.html)、[MySQL count](../mysql/mysql-count.html) 两篇互相呼应。
