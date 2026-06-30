---
title: "子查询怎么用？和 JOIN 怎么选？"
description: "讲清子查询的分类、EXISTS 与 IN 的差别，以及子查询和 JOIN 的取舍。"
breadcrumb: true
article: true
editLink: false
category:
  - "SQL"
tag:
  - "高频"
  - "进阶"
  - "项目实战"
prev:
  text: "各种 JOIN 到底有什么区别？"
  link: "/database/sql/sql-join.html"
next:
  text: "UNION 和 UNION ALL 有什么区别？"
  link: "/database/sql/sql-set-operations.html"
---

# 子查询怎么用？和 JOIN 怎么选？

> 子查询就是"查询里套查询"。难的不是语法，而是搞清它出现在哪个位置、返回什么形状的结果，以及——同一个需求用子查询还是 JOIN 写，到底哪个更合适。

## 子查询：套在外层查询里的内层查询

一句话定义：把一个 `SELECT` 的结果，当作另一个 SQL 语句的**数据来源**或**判断条件**。子查询必须放在括号 `()` 里。

按它出现的位置和返回结果的形状，可以分成几类，这决定了你能配什么运算符。

## 按位置和返回形状分类

### 出现在 WHERE 里：当条件用

这是最常见的用法。子查询返回的形状不同，能配的运算符也不同：

**标量子查询（单行单列）**——可以配 `= > <` 这类需要单个值的运算符：

```sql
SELECT * FROM orders
WHERE  amount > (SELECT AVG(amount) FROM orders);  -- 比平均金额高的订单
```

**多行单列**——配 `IN`、`ANY`、`ALL`：

```sql
SELECT * FROM customers
WHERE  cust_id IN (SELECT cust_id FROM orders WHERE amount > 1000);
```

**多行多列**——配 `IN` 做行比较：

```sql
SELECT * FROM orders
WHERE  (cust_id, amount) IN (SELECT cust_id, MAX(amount) FROM orders GROUP BY cust_id);
```

### 出现在 FROM 里：当临时表用

子查询返回多行多列，相当于一张临时表（派生表），必须起别名：

```sql
SELECT t.cust_id, t.cnt
FROM   (SELECT cust_id, COUNT(*) AS cnt FROM orders GROUP BY cust_id) AS t
WHERE  t.cnt > 5;
```

这种写法在复杂统计里很常见——先把中间结果算出来当一张表，再在外面筛。

### 出现在 SELECT 里：当一列用

子查询返回单行单列，直接作为输出的一列：

```sql
SELECT c.cust_name,
       (SELECT COUNT(*) FROM orders o WHERE o.cust_id = c.cust_id) AS order_cnt
FROM   customers c;
```

## 相关子查询 vs 非相关子查询

这是理解子查询性能的关键。

**非相关子查询**：内层查询不依赖外层，可以独立执行一次，把结果交给外层。上面 `WHERE amount > (SELECT AVG(amount) FROM orders)` 就是——内层只算一次平均值。

**相关子查询**：内层查询引用了外层的字段，外层每处理一行，内层就要重新执行一次。上面 SELECT 里那个 `order_cnt` 就是相关子查询——每个顾客都要去 orders 里数一次。

```sql
-- 相关子查询：c.cust_id 被内层引用
SELECT c.cust_name
FROM   customers c
WHERE  EXISTS (SELECT 1 FROM orders o WHERE o.cust_id = c.cust_id AND o.amount > 500);
```

相关子查询不是不能用，但要意识到它的执行成本：外层有多少行，内层就可能跑多少次。数据量大时容易慢。

## EXISTS vs IN：经典对比

"判断某条记录是否存在"有两种写法，`EXISTS` 和 `IN`，面试常问差别。

```sql
-- 写法一：IN
SELECT * FROM customers c
WHERE  c.cust_id IN (SELECT cust_id FROM orders);

-- 写法二：EXISTS
SELECT * FROM customers c
WHERE  EXISTS (SELECT 1 FROM orders o WHERE o.cust_id = c.cust_id);
```

两者语义上等价（都找"下过单的顾客"），但驱动方向不同：

- **`IN`**：先执行子查询拿到一列 `cust_id`，再拿外层的 `cust_id` 去这一列里匹配。适合**子查询结果集小**的情况。
- **`EXISTS`**：外层每行都触发一次子查询，看能不能查到至少一行。适合**外层结果集小、子查询表大**的情况，因为它是找到一行就短路返回，不收集完整列表。

经验上：子查询结果集小用 `IN`，外层表小用 `EXISTS`。现代数据库优化器很多时候会自动把两者改写成一样的执行计划，所以差别没传说中那么大，但原理要讲得清。

## 一个特别坑的：NOT IN 遇到 NULL

`NOT IN` 是 `IN` 的反面，但它和 NULL 的组合是个经典陷阱：

```sql
SELECT * FROM customers
WHERE  cust_id NOT IN (SELECT cust_id FROM orders WHERE amount > 500);
```

如果子查询返回的列表里**混进了 NULL**（比如某条订单的 `cust_id` 为 NULL），那整个 `NOT IN` 的结果会**变成空**——一条都查不出来。

原因是 SQL 的三值逻辑：`x NOT IN (a, b, NULL)` 等价于 `x<>a AND x<>b AND x<>NULL`，而 `x<>NULL` 的结果是 `UNKNOWN`，整个 AND 链就被 UNKNOWN 拖垮了（详见 [NULL 和 CASE WHEN 那篇](./sql-null-and-case.html)）。

解决办法：要么子查询里加 `WHERE cust_id IS NOT NULL`，要么干脆改用 `NOT EXISTS`——`NOT EXISTS` 不受 NULL 影响：

```sql
SELECT * FROM customers c
WHERE  NOT EXISTS (SELECT 1 FROM orders o
                   WHERE o.cust_id = c.cust_id AND o.amount > 500);
```

这是子查询里最值得记的一条工程经验：**用 `NOT IN` 前先确认结果里有没有 NULL，否则结果可能莫名变空。**

## 子查询 vs JOIN：怎么选

同一个需求往往两种写法都能实现，比如"查下过单的顾客"既 `IN` 子查询又能 `INNER JOIN`。选哪个看几点：

| 维度                 | 子查询                           | JOIN                        |
| -------------------- | -------------------------------- | --------------------------- |
| 语义                 | 更接近自然语言"在……之中""存在……" | 偏向"把表拼起来"            |
| 输出列               | 只用外层表的列，结构干净         | 能同时输出多张表的列        |
| 需要"存在性判断"     | `EXISTS` 很自然                  | JOIN 后还要 `DISTINCT` 去重 |
| 需要两表字段一起输出 | 要套一层，啰嗦                   | JOIN 直接取，顺手           |
| 复杂中间统计         | FROM 派生表很清晰                | 多表 JOIN 容易乱            |

简单说：**只是判断"有没有/在不在"，用 `EXISTS`/`IN` 子查询更直白；要把两张表的字段拼在一起输出，用 JOIN 更自然。** 不要为了"显得高级"硬套五层嵌套子查询，可读性和优化器都不讨好。

## 容易踩的坑

- **`NOT IN` 遇 NULL 全空**：子查询结果含 NULL 时 `NOT IN` 直接失效，改用 `NOT EXISTS` 或先 `IS NOT NULL`。
- **相关子查询外层每行触发一次**：数据量大时慢，注意是否能在内层减少计算。
- **FROM 派生表忘起别名**：`FROM (SELECT ...) AS t` 的别名不能漏。
- **标量子查询返回多行报错**：配 `=` 的子查询必须保证只返回一行一列，否则运行时错。

## 小结

- 子查询按位置分 WHERE（当条件）、FROM（当临时表）、SELECT（当一列），返回形状决定能配的运算符。
- 非相关子查询只执行一次；相关子查询外层每行触发一次，成本更高。
- `EXISTS` 适合外层小、`IN` 适合子查询结果小，优化器常会自动改写，差别没传言大。
- `NOT IN` 一旦结果含 NULL 就全空，用 `NOT EXISTS` 规避。
- 只判断存在性用子查询，要拼字段输出用 JOIN，别为炫技堆嵌套。

## 参考

基于 MySQL 8.0 Reference Manual 中 SQL Statements、Functions and Operators、JOIN、Subqueries、Window Functions 与 Optimization 等相关官方章节整理。
