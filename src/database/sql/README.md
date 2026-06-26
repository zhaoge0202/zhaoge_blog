---
title: "SQL"
description: "围绕查询执行顺序、聚合分组、连接、子查询、窗口函数和写法优化的专题。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "Redis"
  link: "/database/redis/"
next:
  text: "一条 SELECT 语句的逻辑执行顺序是什么？"
  link: "/database/sql/sql-execution-order.html"
---

# SQL

## 为什么重要

SQL 是后端面试里几乎每场都会问的基本功。但区分度不在"写不写得出来"，而在讲不讲得清一条查询的执行顺序、各种 JOIN 的差别、子查询和 JOIN 怎么选、窗口函数什么时候用——以及写出来的 SQL 有没有踩坑。

## 知识主线

执行顺序 -> 聚合分组 -> 连接/子查询/集合 -> 窗口函数与 NULL -> 分页 -> 写法优化

## 怎么读这个专题

这个专题沿着"一条 SQL 从写出来到跑起来、再到跑得快"这条线写。重点不是背语法，而是把每个知识点落回真实写法：为什么 `WHERE` 用不了 `SELECT` 别名、为什么 `LEFT JOIN` 的过滤放 `WHERE` 会退化成内连接、为什么 `NOT IN` 碰上 NULL 就全空、深分页到底慢在哪。

SQL 资料里最容易出问题的，是把语法罗列当成讲解——列一堆运算符、函数表，却没说清"什么时候用、用了会怎样"。后面的文章会把这些地方用具体数据和例子走一遍。涉及索引、执行计划、事务等 MySQL 内部机制时，会链接到已有的 MySQL 专题，不在本篇重复。

## 面试焦点

不是会背 `SELECT` 语法，而是能把执行顺序、JOIN 类型、子查询取舍、窗口函数、NULL 处理和写法优化讲成"能落地、能排障"的工程判断。

## 前置知识

数据库基础、SQL 基本语法

## 目标人群

3-5 年 Java 后端工程师

## 子模块

### 1. 查询执行与聚合

- 一条 SELECT 的逻辑执行顺序是什么
- GROUP BY、聚合和 HAVING 怎么配合

### 2. 多表连接、子查询与集合

- 各种 JOIN 到底有什么区别
- 子查询怎么用，和 JOIN 怎么选
- UNION 和 UNION ALL 有什么区别

### 3. 进阶查询

- 窗口函数解决什么问题
- NULL 和 CASE WHEN 有哪些坑
- 分页查询怎么写，深度分页怎么优化

### 4. 写法规范与优化

- 写 SQL 有哪些常见的写法坑

## 题目列表

### 查询执行与聚合

- [一条 SELECT 语句的逻辑执行顺序是什么？](./sql-execution-order.html) - 理解执行顺序是搞懂 WHERE/HAVING 和别名报错的根。
- [GROUP BY、聚合和 HAVING 怎么配合？](./sql-groupby-aggregate.html) - 讲清聚合、分组、HAVING 的分工，以及为什么 SELECT 只能选分组列或聚合。

### 多表连接、子查询与集合

- [各种 JOIN 到底有什么区别？](./sql-join.html) - 用具体数据讲清 INNER/LEFT/RIGHT/FULL/CROSS，以及 ON 和 WHERE 的分水岭。
- [子查询怎么用？和 JOIN 怎么选？](./sql-subquery.html) - 子查询分类、EXISTS vs IN、NOT IN 遇 NULL 的坑，以及和 JOIN 的取舍。
- [UNION 和 UNION ALL 有什么区别？](./sql-set-operations.html) - 去重代价、集合操作规则，以及 MySQL 对 INTERSECT/EXCEPT 的版本边界。

### 进阶查询

- [窗口函数解决什么问题？](./sql-window-functions.html) - RANK/DENSE_RANK/ROW_NUMBER 的区别，以及 Top-N、累计、偏移等经典场景。
- [NULL 和 CASE WHEN 有哪些坑？](./sql-null-and-case.html) - 三值逻辑、聚合忽略 NULL，以及条件聚合和行转列的写法。
- [分页查询怎么写？深度分页怎么优化？](./sql-pagination.html) - LIMIT 分页、深分页慢的根因，以及游标分页和延迟关联两种解法。

### 写法规范与优化

- [写 SQL 有哪些常见的写法坑？](./sql-writing-best-practices.html) - SELECT \*、索引列套函数、批量操作等写法层面的问题，内部机制链接到 MySQL 专题。
