---
title: "数据库"
description: "数据库知识域入口，覆盖 MySQL、Redis、SQL、Elasticsearch 与 MongoDB 的原理与工程取舍。"
article: false
breadcrumb: true
editLink: false
---

# 数据库

数据库部分先放项目里最常被追问的 MySQL、Redis、SQL、Elasticsearch 和 MongoDB。目标不是背术语，而是把事务、一致性、缓存问题、搜索分析和文档建模讲成可落地的工程判断。

## 当前子域

- [MySQL](./mysql/)：索引、事务、MVCC、锁和日志。
- [Redis](./redis/)：数据结构、缓存问题、线上排障、高可用和扩展能力。
- [SQL](./sql/)：查询执行、连接、子查询、窗口函数和写法优化。
- [Elasticsearch](./elasticsearch/)：倒排索引、分词映射、查询打分、聚合和集群读写。
- [MongoDB](./mongodb/)：文档模型、索引、聚合管道、副本集和分片。

## 当前重点文章

- [MySQL 索引是怎么设计和使用的？](./mysql/mysql-index-design.html)
- [MySQL 事务隔离级别怎么理解？](./mysql/mysql-transaction-isolation.html)
- [MVCC 和 ReadView 是怎么工作的？](./mysql/mysql-mvcc-read-view.html)
- [Redis 常见数据类型怎么选？](./redis/redis-data-structures.html)
- [RDB、AOF 和混合持久化怎么选？](./redis/redis-persistence.html)
- [Redis 的大 key 和热 key 怎么发现和处理？](./redis/redis-bigkey-hotkey.html)
- [Redis 卡顿了该从哪里开始排查？](./redis/redis-blocking-troubleshooting.html)
- [缓存雪崩、击穿、穿透怎么治理？](./redis/redis-cache-problems.html)
- [如何保证缓存和数据库一致性？](./redis/redis-cache-consistency.html)
- [MongoDB 文档模型怎么设计？和 MySQL 怎么选？](./mongodb/mongodb-data-model.html)
- [MongoDB 索引怎么设计？查询为什么没走索引？](./mongodb/mongodb-index-query.html)

## 后续计划

- 数据一致性与高可用专题
