---
title: "MySQL"
description: "从架构、存储、索引到事务、锁和日志的体系化专题。"
article: true
breadcrumb: true
editLink: false
prev:
  text: "JVM"
  link: "/java/jvm/"
next:
  text: "一条 SQL 查询语句是怎么执行的？"
  link: "/database/mysql/mysql-architecture-sql-execution.html"
---

# MySQL

## 为什么重要

MySQL 是后端工程师最容易从 CRUD 被一路追问到原理、性能和一致性的那一块。

## 知识主线

架构与执行流程 -> 存储结构 -> 索引 -> 执行计划 -> 事务与隔离 -> MVCC -> 锁与加锁规则 -> 死锁 -> 日志与恢复 -> 工程规范

## 怎么读这个专题

这些笔记是在多份 MySQL 技术资料和官方文档之间交叉验证后，用自己的话重写的——一些常见资料里讲得不一致或不严谨的地方（比如查询缓存归属、全文索引、RR 是否真能解决幻读、`.frm` 是否还在等），我在正文里都点了出来，不照搬结论。

整体按"一条 SQL 在 MySQL 里怎么走"这条线串起来：先搞清架构和存储，再到索引怎么让查询变快、什么时候失效，然后是事务、MVCC、锁这套并发控制，最后是日志（怎么保证不丢、怎么恢复）和工程上的字段/表设计。建议顺着读，每篇结尾都有"小结"方便回顾。

## 面试焦点

不是背概念，而是能把慢查询、并发更新、分页、加锁阻塞、日志恢复、字段设计这些真实问题讲清楚，并且知道每个结论的边界在哪。

## 前置知识

SQL 基础、B+ 树基础。

## 目标人群

3-5 年 Java 后端工程师。

## 子模块

### 1. 基础与架构

- 一条 SQL 的执行链路，Server 层和存储引擎层怎么分工
- InnoDB 和 MyISAM 的差异与取舍

### 2. 数据是怎么存的

- 表空间、页、行格式：一行记录到底怎么落到磁盘上
- Buffer Pool 怎么用内存把随机磁盘 IO 变快

### 3. 索引与查询优化

- 索引为什么用 B+ 树、单表多少行该考虑分表
- 聚簇索引、覆盖索引、联合索引、最左前缀
- 索引失效、执行计划、count 的写法差异

### 4. 事务与并发控制

- ACID、隔离级别、快照读与当前读
- MVCC 与 ReadView、锁体系、加锁规则、幻读边界、死锁

### 5. 日志与持久化

- redo log、undo log、binlog 各自解决什么问题
- WAL 和两阶段提交为什么出现

### 6. 工程细节与规范

- 字段类型、NOT NULL、字符集、主键怎么选
- 时间字段怎么存、自增主键为什么不一定连续

## 题目列表

### 基础与架构

- [一条 SQL 查询语句是怎么执行的？](./mysql-architecture-sql-execution.html) - 把这条流水线讲清，后面索引、事务、日志的题都能往这张图上挂。
- [InnoDB 和 MyISAM 有什么区别？](./mysql-innodb-vs-myisam.html) - MySQL 基础认知里最常见的入口题。

### 数据是怎么存的

- [一行记录在 InnoDB 里是怎么存的？](./mysql-row-format.html) - 行格式、页、行溢出，是理解索引和 varchar 限制的底座。
- [Buffer Pool 是怎么提速的？](./mysql-buffer-pool.html) - InnoDB 性能的核心，改进版 LRU 是高频追问点。

### 索引与查询优化

- [索引为什么用 B+ 树？单表多少行该分表？](./mysql-why-bplus-tree.html) - 从磁盘 IO 出发讲选型，顺带推算 2000 万行这个经验值。
- [索引是怎么设计和使用的？](./mysql-index-design.html) - 索引题是 MySQL 面试的第一高频。
- [索引为什么会失效？](./mysql-index-invalidation.html) - 索引题里最容易和慢 SQL 结合的一类。
- [执行计划 EXPLAIN 怎么看？](./mysql-explain.html) - 不会看 EXPLAIN，就很难把优化说成工程问题。
- [count(\*)、count(1)、count(字段) 有什么区别？](./mysql-count.html) - 经典细节题，还能引出 MVCC 为什么数得慢。

### 事务与并发控制

- [事务隔离级别怎么理解？](./mysql-transaction-isolation.html) - 事务题的总入口。
- [MVCC 和 ReadView 是怎么工作的？](./mysql-mvcc-read-view.html) - MySQL 事务面试最核心的原理题。
- [MySQL 有哪些锁？](./mysql-locks.html) - 先把全局锁、表锁、行锁的体系梳清。
- [行锁到底怎么加？间隙锁和临键锁怎么理解？](./mysql-lock-rules.html) - 加锁规则集大成，决定你能不能把幻读和阻塞讲完整。
- [死锁是怎么产生的，怎么排查和避免？](./mysql-deadlock.html) - 间隙锁死锁是最经典的并发翻车现场。

### 日志与持久化

- [redo log、undo log、binlog 分别有什么用？](./mysql-logs.html) - 日志题本质在问持久化、回滚和主从复制，还要讲清两阶段提交。

### 工程细节与规范

- [表结构和字段设计怎么做？](./mysql-schema-design.html) - 最容易和项目建模、历史包袱、扩展性挂钩。
- [时间字段和主键怎么选？](./mysql-time-and-primary-key.html) - 简历项目里很容易被追问到这一层。
- [自增主键为什么不一定连续？](./mysql-auto-increment.html) - 看似冷门，其实在考自增机制和事务理解。
