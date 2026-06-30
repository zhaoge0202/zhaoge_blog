---
title: "写 SQL 有哪些常见的写法坑？"
description: "汇总 SELECT *、隐式转换、批量操作等写法层面的坑，把内部机制链接到 MySQL 专题。"
breadcrumb: true
article: true
editLink: false
category:
  - "SQL"
tag:
  - "高频"
  - "项目实战"
  - "体系化"
prev:
  text: "分页查询怎么写？深度分页怎么优化？"
  link: "/database/sql/sql-pagination.html"
next:
  text: "Elasticsearch"
  link: "/database/elasticsearch/"
---

# 写 SQL 有哪些常见的写法坑？

> 前面几篇讲的是"怎么把 SQL 写对"，这篇讲"怎么把 SQL 写好"。很多线上慢查询不是因为表大、索引缺，而是写法本身就在拖后腿：一个 `SELECT *`、一次列上套函数、一个循环单条插入，就能把本该快的查询拖慢。这些坑大多一句话能说清，但绕不开。

## 避免 SELECT \*

`SELECT *` 看着省事，实则四个坏处：

- **多读无用字段**：`*` 把所有列都读出来，大字段（`TEXT`、`BLOB`）尤其伤，白白占带宽和内存。
- **挡掉覆盖索引**：只查索引上的列时，MySQL 能走覆盖索引、不回表；`SELECT *` 几乎一定要回表取全部字段，把这条优化路堵死（详见 [MySQL 索引设计](../mysql/mysql-index-design.html)）。
- **多耗 CPU**：解析、传输更多列，徒增开销。
- **抗表结构变更能力差**：表加了列，`SELECT *` 的结果跟着变，可能撑爆下游消费者。

养成习惯：**只查真正要用的列**，`SELECT id, name, status` 比 `SELECT *` 更安全也更快。

## 别在索引列上套函数或做运算

这是索引失效的头号原因。一旦在索引列上加了函数或运算，优化器就用不上索引了，转成全表扫描：

```sql
-- ❌ 列上套函数，索引失效
WHERE YEAR(create_time) = 2024
WHERE LEFT(name, 3) = 'abc'
WHERE amount + 1 > 100

-- ✅ 改写成列不动的形式
WHERE create_time >= '2024-01-01' AND create_time < '2025-01-01'
WHERE name LIKE 'abc%'
WHERE amount > 99
```

规律：**把条件改写成"索引列 = 常数"或"索引列 范围"的形式，让列本身保持原样。** 更多失效场景见 [MySQL 索引为什么会失效](../mysql/mysql-index-invalidation.html)。

## 小心隐式类型转换

字段是字符串、查询却传了数字（或反过来），MySQL 会做隐式转换，这条同样会让索引失效：

```sql
-- phone 是 varchar，却用数字查
WHERE phone = 13800000000      -- ❌ 隐式转换，可能全表扫描
WHERE phone = '13800000000'    -- ✅ 类型一致，走索引
```

规则：**查询条件的类型要和字段类型严格对齐**，尤其是字符串列别图省事传数字。这也是 [索引失效](../mysql/mysql-index-invalidation.html) 的常见一类。

## 用批量操作代替循环单条

应用层循环里一条条 `INSERT`，每次都要走一次网络往返和解析，N 条数据就是 N 次 RTT。改成批量插入，一次搞定：

```sql
-- ❌ 循环单条插入
INSERT INTO t(a) VALUES(1);
INSERT INTO t(a) VALUES(2);
INSERT INTO t(a) VALUES(3);

-- ✅ 批量插入
INSERT INTO t(a) VALUES(1),(2),(3);
```

`UPDATE`/`DELETE` 同理，能一条 `WHERE id IN (...)` 搞定的就别循环单条更新。批量操作把多次往返压成一次，性能差距常常是一个数量级。

## UNION ALL 代替 UNION（确定不重复时）

[集合操作那篇](./sql-set-operations.html) 讲过：`UNION` 比 `UNION ALL` 多一次去重，去重可能触发临时表和排序。如果两个查询结果不会重复、或业务不要求去重，就用 `UNION ALL` 省掉这一步。这是高频又好改的优化点。

## 谨慎用外键和级联

阿里规范明确"不得使用外键与级联，外键概念在应用层解决"。外键级联的问题主要是：

- **对分库分表极不友好**：跨库的外键无法维护。
- **级联操作不可控**：一次删除可能触发连锁更新/删除，锁范围和耗时难预估。
- **增加表间耦合**：影响并发的写入和迁移。

关系完整性放到应用层（代码校验 + 事务）更灵活。表结构设计的更多取舍见 [MySQL 表设计规范](../mysql/mysql-schema-design.html)。

## 大 IN 列表和 NOT IN 的坑

- **`IN` 列表太长**：`WHERE id IN (几千个值)` 会让解析变慢、可能占满 `max_allowed_packet`，还可能被优化器当成全表扫描。几千个以上的值考虑用临时表 `JOIN` 或分批。
- **`NOT IN` 遇 NULL 全空**：[子查询篇](./sql-subquery.html) 讲过，子查询结果含 NULL 时 `NOT IN` 直接失效，改用 `NOT EXISTS`。

## 少用 ORDER BY RAND()

随机取几条数据时常见的写法 `ORDER BY RAND() LIMIT 5`，会对**每一行**生成一个随机数再排序，等于全表扫描+排序，表一大就灾难。数据量大时改用"随机主键范围"或应用层抽样的方式。

## 字段类型选对，省一半性能

写 SQL 之外，建表时的类型选择也直接影响性能，但这块属于 MySQL 表设计范畴：

- 金额用 `DECIMAL` 不用浮点，避免精度丢失。
- 日期别用字符串存，用 `DATETIME`/`TIMESTAMP`，详见 [MySQL 时间字段和主键怎么选](../mysql/mysql-time-and-primary-key.html)。
- 小范围整数用 `TINYINT`，非负的用 `UNSIGNED`。
- 主键优先自增 ID，减少 B+ 树页分裂，详见 [MySQL 自增主键](../mysql/mysql-auto-increment.html)。

这些是写 SQL 的"上游"，选错类型再怎么优化查询也补救不回来，详见 [MySQL 表设计规范](../mysql/mysql-schema-design.html)。

## 慢了别瞎改：先定位再优化

写法优化之外，记住排查顺序，别上来就加索引：

1. **定位慢 SQL**：开慢查询日志、看 APM，找出真正高频且慢的那几条，而不是凭感觉。
2. **看执行计划**：用 `EXPLAIN` 看 `type`、`key`、`rows`、`Extra`，确认是全表扫描、回表过多还是临时表排序，详见 [MySQL 执行计划怎么看](../mysql/mysql-explain.html)。
3. **结合业务改**：是补索引、改写 SQL、限制分页深度，还是干脆把查询挪到缓存/搜索引擎。

一句话：**先确认现象，再定位 SQL，再分析计划，最后才动手改。** 详见 [MySQL 日志与慢查询](../mysql/mysql-logs.html)。

## 小结

- 避免 `SELECT *`：只查需要的列，留出覆盖索引的优化空间。
- 索引列别套函数/运算、类型要匹配，否则索引失效——详见 MySQL 索引失效专题。
- 批量操作代替循环单条，`UNION ALL` 代替 `UNION`（不重复时）。
- 不用外键级联，关系完整性放应用层；`NOT IN` 防空、大 `IN` 防爆。
- 慢 SQL 先用 EXPLAIN 定位再改，别凭感觉加索引。

## 参考

基于 MySQL 8.0 Reference Manual 中 SQL Statements、Functions and Operators、JOIN、Subqueries、Window Functions 与 Optimization 等相关官方章节整理。
