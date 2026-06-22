---
title: "数据库"
article: false
breadcrumb: true
editLink: false
---

# 数据库

数据库部分先放项目里最常被追问的 MySQL 和 Redis。目标不是背术语，而是把事务、一致性、缓存问题讲成可落地的工程判断。

## 当前子域

- [MySQL](./mysql/)：索引、事务、MVCC、锁和日志。
- [Redis](./redis/)：数据结构、缓存问题、高可用和分布式锁。

## 当前重点文章

- [MySQL 索引是怎么设计和使用的？](./mysql/mysql-index-design.html)
- [MySQL 事务隔离级别怎么理解？](./mysql/mysql-transaction-isolation.html)
- [MVCC 和 ReadView 是怎么工作的？](./mysql/mysql-mvcc-read-view.html)
- [Redis 常见数据类型怎么选？](./redis/redis-data-structures.html)
- [RDB、AOF 和混合持久化怎么选？](./redis/redis-persistence.html)
- [缓存雪崩、击穿、穿透怎么治理？](./redis/redis-cache-problems.html)
- [如何保证缓存和数据库一致性？](./redis/redis-cache-consistency.html)

## 后续计划

- SQL 基础与复杂查询优化
- 数据一致性与高可用专题
