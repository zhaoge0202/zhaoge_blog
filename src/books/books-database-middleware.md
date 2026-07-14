---
title: "数据库与中间件该怎么读书？"
description: "把 MySQL、Redis、消息队列书单映射到站内排查与选型主线。"
breadcrumb: true
article: true
editLink: false
category:
  - "书单"
tag:
  - "基础"
  - "体系化"
prev:
  text: "Java、JVM 与并发该怎么读书？"
  link: "/books/books-java-jvm-concurrency.html"
next:
  text: "计算机基础与系统设计该怎么读书？"
  link: "/books/books-cs-system-design.html"
---

# 数据库与中间件该怎么读书？

> 数据层最怕只背概念。书要帮你把执行过程和故障形态读厚。

## 映射表

| 主题           | 站内先读                                                                                                                                | 书中关注               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 索引与执行计划 | [索引设计](/database/mysql/mysql-index-design.html)、[EXPLAIN](/database/mysql/mysql-explain.html)                                      | B+ 树、选择性、优化器  |
| 事务与锁       | [隔离级别](/database/mysql/mysql-transaction-isolation.html)、[锁](/database/mysql/mysql-locks.html)                                    | MVCC、间隙锁、死锁     |
| 日志与复制     | [日志](/database/mysql/mysql-logs.html)、[复制](/database/mysql/mysql-replication.html)                                                 | redo/binlog、延迟      |
| 缓存一致性     | [缓存一致性](/database/redis/redis-cache-consistency.html)                                                                              | 旁路缓存、延迟双删边界 |
| Redis 结构     | [数据结构](/database/redis/redis-data-structures.html)                                                                                  | 编码、复杂度、场景     |
| MQ 可靠与顺序  | [可靠性](/high-performance/high-performance-message-reliability.html)、[顺序](/high-performance/high-performance-message-ordering.html) | 确认、重试、分区顺序   |
| 选型           | [MQ 选型](/high-performance/high-performance-mq-selection.html)                                                                         | 模型差异，而非跑分崇拜 |

## 建议读法

1. MySQL：事务锁日志串成一条更新路径
2. Redis：先场景后结构，再持久化与集群
3. MQ：先收益代价，再谈不丢不重与积压

## 小结

1. 数据库书围绕一条 SQL 怎么走完读。
2. 中间件书围绕失败后系统怎样仍正确读。
3. 每次读完都落到站内一篇排查/选型文做对照。

## 参考

综合自本站数据库与高性能消息队列专题阅读路径整理。
