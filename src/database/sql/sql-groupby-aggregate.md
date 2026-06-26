---
title: "GROUP BY、聚合和 HAVING 怎么配合？"
description: "讲清聚合函数、分组、HAVING 的分工，以及为什么 SELECT 只能选分组列或聚合。"
breadcrumb: true
article: true
editLink: false
category:
  - "SQL"
tag:
  - "高频"
  - "基础"
  - "细节题"
prev:
  text: "一条 SELECT 语句的逻辑执行顺序是什么？"
  link: "/database/sql/sql-execution-order.html"
next:
  text: "各种 JOIN 到底有什么区别？"
  link: "/database/sql/sql-join.html"
---

# GROUP BY、聚合和 HAVING 怎么配合？

> 聚合查询是 SQL 题里出现频率最高的一类，但很多人只会套 `GROUP BY + COUNT`，却说不清"为什么 SELECT 里不能随便选列""HAVING 凭什么能用聚合函数"。

## 聚合函数：把多行压成一行

聚合函数（`COUNT`、`SUM`、`AVG`、`MAX`、`MIN`）的作用是把一组行的某个值**压成一个结果**。哪怕你不在查询里写 `GROUP BY`，只要 SELECT 里出现了聚合函数，整张表就会被当成"一个大组"，压成一行：

```sql
SELECT COUNT(*) AS total, AVG(amount) AS avg_amt, MAX(amount) AS max_amt
FROM   orders;
-- 一行：总订单数、平均金额、最大金额
```

这里有几个容易记错的细节：

- **`AVG()` / `SUM()` 会忽略 NULL**。`AVG(amount)` 算的是"非 NULL 的 amount 之和 ÷ 非 NULL 的行数"，分母不含 NULL 行。如果你以为它是"和 ÷ 总行数"，遇到有 NULL 的列就会算错。
- **`COUNT(*)` 和 `COUNT(列)` 不一样**：`COUNT(*)` 数所有行（含 NULL），`COUNT(列)` 只数该列非 NULL 的行。这一点展开能讲一整篇，见 [MySQL 里 count(\*)、count(1)、count(字段) 有什么区别](../mysql/mysql-count.html)，这里只记语义差别。
- **`DISTINCT` 能套在聚合里**：`COUNT(DISTINCT user_id)` 数去重后的用户数，`AVG(DISTINCT score)` 对去重后的分数求平均。

## GROUP BY：把一张表切成多个小表

光有聚合函数，整张表只能压成一行。`GROUP BY` 的作用是**按某列的值把表切成多个小组**，每个小组各自压成一行：

```sql
SELECT cust_id, COUNT(*) AS order_cnt, SUM(amount) AS total
FROM   orders
GROUP BY cust_id;
-- 每个顾客一行：他的订单数、他的总金额
```

可以按多列分组，分组粒度更细：

```sql
SELECT cust_id, YEAR(created_at) AS yr, COUNT(*) AS cnt
FROM   orders
GROUP BY cust_id, YEAR(created_at);
-- 每个「顾客 × 年份」一行
```

一个关键认知：**`GROUP BY` 之后，每个组只剩一行**。这句话能解释下面那个高频疑问。

## 为什么 SELECT 里只能选分组列或聚合函数

这是面试里特别爱问、也特别容易答歪的点。看这条会报错的 SQL：

```sql
SELECT cust_id, amount          -- ❌ amount 不是分组列，也不是聚合
FROM   orders
GROUP BY cust_id;
```

报错信息大致是"`amount` 不在 GROUP BY 里，也不是聚合函数"。为什么？因为 `GROUP BY cust_id` 之后，每个 `cust_id` 对应**多行**订单，但结果每个组只能输出一行——那这个组里那么多 `amount`，到底取哪个？SQL 标准拒绝替你猜，所以直接报错。

解决办法只有两条路：

1. **把它加进 GROUP BY**：`GROUP BY cust_id, amount`，那就变成按"顾客+金额"分组了。
2. **用聚合函数压缩它**：`SELECT cust_id, SUM(amount)`、`MAX(amount)`、`AVG(amount)`……告诉数据库"这一组的 amount 我要它的和/最大值/平均值"。

所以口诀是：**SELECT 里的非聚合列，必须全部出现在 GROUP BY 里。** 反过来，GROUP BY 里的列不一定要出现在 SELECT 里，但选出来通常没意义。

> 顺带一提，MySQL 有个 `ONLY_FULL_GROUP_BY` 模式。早期版本默认关，会"宽容"地让你写出上面那种报错语句，并随便取一行的值（结果不可预期）；5.7+ 默认开启，行为和标准一致。面试说一句"老版本 MySQL 不报错是隐患，新版本默认严格"就够了。

## HAVING：专门过滤分组后的结果

`WHERE` 在分组**之前**执行，过滤不了聚合结果（比如"订单数大于 3 的顾客"）。`HAVING` 在分组**之后**执行，正好干这个：

```sql
SELECT   cust_id, COUNT(*) AS order_cnt
FROM     orders
WHERE    created_at >= '2024-01-01'   -- 先过滤行：只要今年的
GROUP BY cust_id
HAVING   COUNT(*) > 3;                -- 再过滤组：只要下单超过 3 次的
```

为什么 `WHERE` 用不了聚合、`HAVING` 能用，根子在执行顺序——这条在 [执行顺序那篇](./sql-execution-order.html) 讲过，这里只说写法上的取舍。

**一条原则：和聚合无关的过滤尽量放 `WHERE`，别堆到 `HAVING`。** 因为 `WHERE` 先跑，能提前砍掉大量行，让 `GROUP BY` 处理的数据更少；全扔进 `HAVING` 的话，引擎得先对全量数据分组聚合完再过滤，做了不少白工。上面例子里 `created_at` 的过滤放 `WHERE` 是对的，`COUNT(*) > 3` 这种依赖聚合结果的才放 `HAVING`。

MySQL 还允许 `HAVING` 引用 `SELECT` 的别名（`HAVING order_cnt > 3` 也能跑），但这是 MySQL 扩展，标准 SQL 不支持，跨库时别依赖。

## 容易踩的坑

- **`AVG`/`SUM` 忽略 NULL**：分母不含 NULL 行，有缺失值时结果可能和你直觉的不一样。
- **`COUNT(列)` 不数 NULL**：要数总行数用 `COUNT(*)`，要数某列非空用 `COUNT(列)`，别混。
- **SELECT 非聚合列必须进 GROUP BY**：否则一组多行没法取值，标准 SQL 直接报错。
- **NULL 会自成一个分组**：`GROUP BY` 时，某列全为 NULL 的行会被归到同一个 NULL 组，统计时别漏。
- **过滤条件别乱放**：与聚合无关的放 `WHERE` 省事，依赖聚合的才放 `HAVING`。

## 小结

- 聚合函数把多行压成一行；不加 `GROUP BY` 时整张表是一个大组。
- `GROUP BY` 按列切组，每组输出一行，所以 SELECT 的非聚合列必须出现在 GROUP BY 里。
- `COUNT(*)` 数所有行、`COUNT(列)` 数非 NULL 行，深入的区别见 MySQL count 专题。
- `HAVING` 在分组后过滤聚合结果，`WHERE` 在分组前过滤行；无关聚合的条件优先 `WHERE`。
- MySQL 对 `HAVING` 用别名、老版本对非聚合列不报错都是扩展/隐患，标准行为更严格。

## 参考

综合社区 SQL 语法资料中分组、汇总函数章节及聚合、分组查询题目的解题思路重写；`COUNT` 的语义与性能深入交给了已有的 [MySQL count 专题](../mysql/mysql-count.html)，这里只保留语义层面的差别；`ONLY_FULL_GROUP_BY` 模式与 MySQL 别名扩展参考官方文档做了边界补充。
