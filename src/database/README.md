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

- [MVCC 和 ReadView 是怎么工作的？](./mysql/mysql-mvcc-read-view.html)
- [如何保证缓存和数据库一致性？](./redis/redis-cache-consistency.html)

## 后续计划

- SQL 基础与执行计划
- 缓存雪崩、击穿和穿透治理
- 数据一致性与高可用专题
