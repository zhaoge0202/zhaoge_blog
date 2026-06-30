---
title: "next-key lock 到底锁了什么范围？"
description: "用唯一索引、普通索引和范围查询讲清 next-key lock 的加锁边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "MySQL"
tag:
  - "高频"
  - "原理深入"
  - "细节题"
prev:
  text: "MySQL 刷盘策略怎么影响性能和丢数据风险？"
  link: "/database/mysql/mysql-flush-policy.html"
next:
  text: "慢 SQL 应该按什么顺序排查？"
  link: "/database/mysql/mysql-slow-query-troubleshooting.html"
---

# next-key lock 到底锁了什么范围？

> next-key lock 是“记录锁 + 前面的间隙锁”，默认是前开后闭区间，但在唯一命中、未命中、范围查询时会退化。

已有锁规则篇系统讲了行锁。这里单独把 next-key lock 的范围拿出来，因为面试和线上阻塞排查最容易错在“到底锁哪一段”。

## 先记住三个基础锁

| 锁            | 范围                     | 作用                          |
| ------------- | ------------------------ | ----------------------------- |
| Record Lock   | 锁一条索引记录           | 阻止更新/删除这条记录         |
| Gap Lock      | 锁两条索引记录之间的间隙 | 阻止插入新记录                |
| Next-Key Lock | 前开后闭区间 `(a, b]`    | 同时保护记录 b 和它前面的间隙 |

InnoDB 行锁锁的是索引，不是直接锁“整行对象”。如果查询条件没有走索引，InnoDB 可能扫描大量记录并加锁，效果接近把表锁住。

## 唯一索引等值查询

假设主键 id 已有：`1, 5, 10`。

```sql
SELECT * FROM t WHERE id = 5 FOR UPDATE;
```

命中唯一记录时，next-key lock 通常退化为记录锁，只锁 `id=5`。因为唯一约束已经保证别人不能再插入另一个 `id=5`，只要防止这条记录被改/删，就能保证结果集稳定。

如果查不存在的唯一值：

```sql
SELECT * FROM t WHERE id = 3 FOR UPDATE;
```

它会定位到第一条大于 3 的记录 5，锁 `(1, 5)` 这个间隙，防止别人插入 `id=3`。

## 普通索引等值查询

普通索引没有唯一性，等值查询命中时仍要考虑相同值后面还可能插入新记录。

例如普通索引 `age` 已有：`10, 20, 20, 30`。

```sql
SELECT * FROM user WHERE age = 20 FOR UPDATE;
```

它不仅会锁住 `age=20` 的索引记录，还会锁住相关间隙，防止别人再插入新的 `age=20` 造成当前读幻读。普通索引命中时通常比唯一索引锁得更宽。

如果查询值不存在，最终锁哪段要看它落在哪个间隙。比如查 `age=25`，会锁 `(20, 30)`，阻止插入 25。

## 范围查询最容易扩大锁范围

```sql
SELECT * FROM user WHERE id > 5 AND id <= 10 FOR UPDATE;
```

范围查询会扫描多个索引项，扫描到的索引范围通常都会加锁。即使业务上只关心 `(5, 10]`，优化器实际扫描到哪里、是否需要扫到边界外的第一条记录，都会影响加锁范围。

所以线上排查要看执行计划和实际锁，不要只凭 WHERE 条件猜。

## 怎么观察实际锁？

MySQL 8.0 可以看：

```sql
SELECT * FROM performance_schema.data_locks\G
SELECT * FROM performance_schema.data_lock_waits\G
```

重点看：

- `INDEX_NAME`：锁在哪个索引上。
- `LOCK_MODE`：`X`、`X,GAP`、`X,REC_NOT_GAP`、`X,INSERT_INTENTION`。
- `LOCK_DATA`：锁住的索引值或 supremum 伪记录。

注意：`LOCK_TYPE=RECORD` 表示行级锁，不等于 Record Lock。具体是不是记录锁，要看 `LOCK_MODE` 是否包含 `REC_NOT_GAP`。

## 小结

- next-key lock 是前开后闭区间，组合了间隙锁和记录锁。
- 唯一索引等值命中通常退化为记录锁，未命中通常退化为间隙锁。
- 普通索引等值查询锁得更宽，因为还要防止插入相同索引值。
- 范围查询会锁扫描范围，实际边界要结合执行计划和 `data_locks` 看。
- 行锁锁的是索引；不走索引的加锁语句非常危险。

## 参考

基于 MySQL 8.0 Reference Manual 中 InnoDB、Optimizer、Replication、EXPLAIN、Data Types、Online DDL 等相关官方章节整理。
