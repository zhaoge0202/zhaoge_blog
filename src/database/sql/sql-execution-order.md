---
title: "一条 SELECT 语句的逻辑执行顺序是什么？"
description: "讲清 SQL 子句的真实执行顺序，以及它为什么能解释 WHERE/HAVING 和别名报错。"
breadcrumb: true
article: true
editLink: false
category:
  - "SQL"
tag:
  - "高频"
  - "基础"
  - "原理深入"
prev:
  text: "SQL"
  link: "/database/sql/"
next:
  text: "GROUP BY、聚合和 HAVING 怎么配合？"
  link: "/database/sql/sql-groupby-aggregate.html"
---

# 一条 SELECT 语句的逻辑执行顺序是什么？

> 你写 SQL 时第一个敲的是 `SELECT`，但它几乎是最后才执行的；很多"为什么这条报错、为什么这条能跑"的困惑，根子都在这个顺序上。

## 先把结论摆出来

一条查询语句的书写顺序是这样的：

```sql
SELECT   字段
FROM     表
JOIN     另一张表 ON ...
WHERE    条件
GROUP BY 分组列
HAVING   分组后条件
ORDER BY 排序列
LIMIT    n;
```

但数据库**真正执行**的顺序恰恰相反，大致是：

```mermaid
flowchart LR
    A[FROM / JOIN] --> B[ON]
    B --> C[WHERE]
    C --> D[GROUP BY]
    D --> E[HAVING]
    E --> F[SELECT / DISTINCT]
    F --> G[ORDER BY]
    G --> H[LIMIT]
```

也就是 **FROM → ON → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT**。

记住一句话：**先把数据从哪来定下来（FROM/JOIN），再一层层过滤和加工（WHERE → 分组 → HAVING），最后才轮到选列、去重、排序、截断（SELECT → DISTINCT → ORDER BY → LIMIT）。**

很多人卡在"`SELECT` 不是第一个吗"，其实就是把"书写顺序"和"执行顺序"搞混了。`SELECT` 只是你最先写出来的，引擎要先把表拼好、行过滤好，才知道有哪些列可选。

## 用一条真实查询走一遍

光记流水线没用，拿一条带 JOIN、过滤、分组、排序、分页的查询，逐步看每一步发生了什么。

假设有两张表：

```sql
-- 顾客表
customers(cust_id, cust_name, cust_level)
-- 订单表
orders(order_id, cust_id, amount, created_at)
```

现在要查：**每个 2 级及以上顾客在 2024 年的订单数，只要下单超过 3 次的，按订单数降序取前 5。**

```sql
SELECT   c.cust_name, COUNT(o.order_id) AS order_cnt
FROM     customers c
JOIN     orders o ON c.cust_id = o.cust_id
WHERE    c.cust_level >= 2
  AND    o.created_at >= '2024-01-01'
GROUP BY c.cust_name
HAVING   COUNT(o.order_id) > 3
ORDER BY order_cnt DESC
LIMIT    5;
```

按执行顺序，引擎是这样干的：

| 步骤 | 子句                                                   | 这一步在干什么                                               |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------ |
| 1    | `FROM customers c JOIN orders o ON ...`                | 先把两张表按 `cust_id` 关联起来，得到一张"顾客×订单"的宽表   |
| 2    | `WHERE cust_level >= 2 AND created_at >= '2024-01-01'` | 在这张宽表上逐行过滤：丢掉低级别顾客、丢掉 2024 年以前的订单 |
| 3    | `GROUP BY c.cust_name`                                 | 把剩下的行按顾客名分组，每个顾客聚成一行                     |
| 4    | `HAVING COUNT(order_id) > 3`                           | 在**分组后的结果**上再过滤，丢掉订单数不超过 3 的顾客        |
| 5    | `SELECT c.cust_name, COUNT(o.order_id) AS order_cnt`   | 这时才计算要输出的列，给聚合结果起别名 `order_cnt`           |
| 6    | `ORDER BY order_cnt DESC`                              | 按刚算出来的 `order_cnt` 降序排                              |
| 7    | `LIMIT 5`                                              | 截取前 5 行返回                                              |

注意第 5 步：`order_cnt` 这个别名是**直到 SELECT 阶段才诞生**的。这能解释下面几个高频坑。

## 这个顺序能解释的几个坑

### 坑一：为什么 WHERE 里用不了 SELECT 的别名

新手常这么写：

```sql
SELECT amount * 0.9 AS discount_price
FROM   orders
WHERE  discount_price > 100;   -- ❌ 报错：Unknown column 'discount_price'
```

报错的原因就在执行顺序：`WHERE`（第 3 步）跑在 `SELECT`（第 5 步）**之前**，`discount_price` 这个名字还没诞生，`WHERE` 当然找不到它。

解决办法是把表达式原样写回去，因为 `WHERE` 看到的是原始列：

```sql
SELECT amount * 0.9 AS discount_price
FROM   orders
WHERE  amount * 0.9 > 100;   -- ✅ 用原始表达式
```

### 坑二：为什么 ORDER BY 里却能用别名

同样是别名，`ORDER BY` 就能认：

```sql
SELECT amount * 0.9 AS discount_price
FROM   orders
WHERE  amount * 0.9 > 100
ORDER BY discount_price DESC;   -- ✅ 没问题
```

因为 `ORDER BY`（第 6 步）在 `SELECT`（第 5 步）**之后**执行，别名已经生成了。同理 `LIMIT` 也在后面，所以排序后再截断，逻辑自洽。

### 坑三：WHERE 和 HAVING 的根本区别

资料里常这么讲："`WHERE` 过滤行，`HAVING` 过滤分组，`HAVING` 能用聚合函数、`WHERE` 不能。" 这话没错，但只说了现象，没说**为什么**。

原因还是执行顺序：`WHERE` 在 `GROUP BY` **之前**跑，那时还没分组，自然没有聚合结果可过滤，也用不了 `COUNT()`、`SUM()` 这类聚合函数；`HAVING` 在 `GROUP BY` **之后**跑，分组和聚合都算完了，所以能拿聚合结果当条件。

所以一条通用规则：**能用 `WHERE` 过滤的就别留到 `HAVING`**。因为 `WHERE` 先执行，能提前把大量无关行砍掉，让 `GROUP BY` 处理的行数更少；要是全堆到 `HAVING`，引擎得先对全量数据分组聚合，再过滤，白做一堆功。

回到上面那条查询，`cust_level >= 2` 这种**与聚合无关**的条件放 `WHERE`，`COUNT(order_id) > 3` 这种**依赖聚合结果**的条件才放 `HAVING`，这就是正确写法。

### 坑四：GROUP BY 里能不能用别名

标准 SQL 里，`GROUP BY` 在 `SELECT` 之前执行，按理也用不了别名。但 **MySQL 做了扩展**，允许在 `GROUP BY`、`ORDER BY`、`HAVING` 里引用 `SELECT` 的别名。所以下面写法在 MySQL 能跑：

```sql
SELECT YEAR(created_at) AS yr, COUNT(*) AS cnt
FROM   orders
GROUP BY yr;   -- MySQL 允许，标准 SQL 不允许，迁库时要小心
```

这是个"能用但别依赖"的特性——换到 PostgreSQL、Oracle 这类严格遵循标准的库上会直接报错。面试里如果被问到，点一句"MySQL 对此做了扩展，但不是标准行为"就够了。

## 容易踩的坑

- **书写顺序 ≠ 执行顺序**：`SELECT` 最先写、几乎最后执行，这是理解一切的关键。
- **`WHERE` 用不了 `SELECT` 别名**，因为别名还没生成；要过滤就用原始表达式。
- **`HAVING` 不是 `WHERE` 的升级版**：和聚合无关的条件尽量放 `WHERE`，提前过滤更省事。
- **MySQL 允许 `GROUP BY`/`HAVING`/`ORDER BY` 用别名**是扩展，不是标准，跨库迁移别踩。

## 小结

- 执行顺序：`FROM/JOIN → ON → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT`。
- `SELECT` 几乎最后执行，所以它的别名在 `WHERE` 里不可见、在 `ORDER BY` 里可见。
- `WHERE` 和 `HAVING` 的区别本质是执行先后：`WHERE` 先于分组、用不了聚合函数；`HAVING` 后于分组、能过滤聚合结果。
- 与聚合无关的过滤条件优先放 `WHERE`，让 `GROUP BY` 少处理点行。
- MySQL 对 `GROUP BY` 等子句引用别名做了扩展，能用但非标准，跨库时要注意。

## 参考

基于 MySQL 8.0 Reference Manual 中 SQL Statements、Functions and Operators、JOIN、Subqueries、Window Functions 与 Optimization 等相关官方章节整理。
