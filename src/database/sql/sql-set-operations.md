---
title: "UNION 和 UNION ALL 有什么区别？"
description: "讲清 UNION/UNION ALL/INTERSECT/EXCEPT 的差别、去重代价和适用场景。"
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
  text: "子查询怎么用？和 JOIN 怎么选？"
  link: "/database/sql/sql-subquery.html"
next:
  text: "窗口函数解决什么问题？"
  link: "/database/sql/sql-window-functions.html"
---

# UNION 和 UNION ALL 有什么区别？

> `UNION` 和 `UNION ALL` 都是"把多个查询结果上下拼起来"，区别就一个字：去不去重。但这一个字的差别，背后是一次可能很贵的排序去重，面试和线上都常因为它翻车。

## 先看它们干什么

`UNION` 把多个 `SELECT` 的结果**纵向合并**成一个结果集。比如两张结构相同的表各查一批数据，拼在一起：

```sql
SELECT id, name FROM teachers
UNION
SELECT id, name FROM students;
```

结果是 teachers 和 students 的所有 `(id, name)` 行拼在一起。

几条硬规则：

- **列数必须相同**，且顺序对应。
- **对应列的数据类型要相同或兼容**（能隐式转换）。
- **结果集的列名取自第一个 `SELECT`**，后面的查询列名不影响输出。

## UNION 和 UNION ALL 的唯一区别：去不去重

```sql
-- UNION：去掉重复行
SELECT id, name FROM teachers
UNION
SELECT id, name FROM students;

-- UNION ALL：保留所有行，含重复
SELECT id, name FROM teachers
UNION ALL
SELECT id, name FROM students;
```

|          | UNION              | UNION ALL      |
| -------- | ------------------ | -------------- |
| 是否去重 | 是                 | 否             |
| 实现     | 需要排序/哈希去重  | 直接拼接       |
| 性能     | 较慢（多一步去重） | 快             |
| 结果行数 | ≤ 两表行数之和     | = 两表行数之和 |

**核心结论：`UNION` 等于 `UNION ALL` 再加一次去重。** 如果你能确定两个查询的结果不会重复（或本就不在意重复），用 `UNION ALL` 省掉那一步去重，性能更好。这是个高频的写法优化点——很多线上慢查询就是因为无脑写了 `UNION`，明明数据不可能重复却白白做了一次排序。

> 反过来，如果你**确实需要去重**，也别为了"快"硬用 `UNION ALL` 再自己 `DISTINCT`，那是把去重换了个地方做，并不会更省。

## 还有哪些集合操作

`UNION` 是"并集"，SQL 还提供了交集和差集：

- **`INTERSECT`**：交集，只保留两个查询都有的行。
- **`EXCEPT`**（部分数据库叫 `MINUS`）：差集，保留第一个查询有、第二个查询没有的行。

```sql
-- 既下了单又写了评论的顾客
SELECT cust_id FROM orders
INTERSECT
SELECT cust_id FROM reviews;

-- 下过单但从没退过货的顾客
SELECT cust_id FROM orders
EXCEPT
SELECT cust_id FROM returns;
```

> ⚠️ **MySQL 的支持有版本边界**：`INTERSECT` 和 `EXCEPT` 直到 **8.0.31**（2022 年底）才原生支持，更早版本直接写会报语法错误。老版本要用 `IN`/`NOT IN` 或 `JOIN` 模拟：
>
> ```sql
> -- 交集（老版本 MySQL）
> SELECT DISTINCT cust_id FROM orders
> WHERE cust_id IN (SELECT cust_id FROM reviews);
>
> -- 差集（老版本 MySQL）
> SELECT DISTINCT cust_id FROM orders
> WHERE cust_id NOT IN (SELECT cust_id FROM reviews);
> ```
>
> 这是资料里常漏的边界，面试能点出来说明你真在 MySQL 上踩过。

## UNION vs JOIN：纵向还是横向

容易混的两个操作，本质不同：

|          | UNION          | JOIN                       |
| -------- | -------------- | -------------------------- |
| 合并方向 | 纵向（行拼接） | 横向（列拼接）             |
| 前提     | 列数/类型一致  | 有连接条件                 |
| 结果     | 行数相加       | 行数按条件匹配（可能放大） |

`UNION` 是"把多份同结构的数据叠起来"，`JOIN` 是"把不同表的列按关系拼宽"。需求是"再多查一类数据拼到下面"用 UNION；需求是"把两张表的字段放一行看"用 JOIN。

## 容易踩的坑

- **无脑用 UNION 忘了 UNION ALL**：数据本不会重复却多花一次去重，线上常见慢点。
- **列数不一致直接报错**：UNION 要求每个 SELECT 列数相同、顺序对应，少一列就挂。
- **列名以第一个 SELECT 为准**：后面查询的列名被忽略，取别名要在第一个 SELECT 上取。
- **MySQL 老版本不支持 INTERSECT/EXCEPT**：8.0.31 之前得用 IN/JOIN 模拟。
- **UNION 去重是整行比较**：所有列的值都相同才算重复，不是只看某一列。

## 小结

- `UNION` 去重、`UNION ALL` 不去重，差别就在那一次可能很贵的去重操作。
- 确定不会重复时优先 `UNION ALL`，需要去重时才用 `UNION`。
- UNION 要求列数相同、类型兼容，结果列名取自第一个 SELECT。
- `INTERSECT`（交集）、`EXCEPT`（差集）MySQL 8.0.31 才原生支持，之前用 IN/JOIN 模拟。
- UNION 是纵向拼行，JOIN 是横向拼列，别混用。

## 参考

综合社区 SQL 语法资料中"组合"章节与 SQL 优化资料中"用 UNION ALL 代替 UNION"一节重写；其中"UNION 即 UNION ALL + 去重""MySQL 对 INTERSECT/EXCEPT 的版本支持边界"是资料未点明、结合 MySQL 8.0.31 发行说明补全的部分。
