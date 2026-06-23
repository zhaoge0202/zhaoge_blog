---
title: "Redis"
description: "围绕数据结构、持久化、缓存问题和分布式锁的专题。"
article: true
breadcrumb: true
editLink: false
prev:
  text: "MySQL"
  link: "/database/mysql/"
next:
  text: "Redis 常见数据类型怎么选？"
  link: "/database/redis/redis-data-structures.html"
---

# Redis

## 为什么重要

Redis 是后端面试里最容易从“会用缓存”一路被追问到“数据结构、持久化、缓存故障、高可用和分布式协调”的一块。

## 知识主线

数据结构 -> 持久化 -> 过期淘汰 -> 线上问题 -> 缓存问题 -> 高可用 -> 分布式锁 -> 扩展能力

## 怎么读这个专题

这个专题会沿着“Redis 为什么快、为什么会出问题、出了问题怎么取舍”这条线来写。重点不是背命令，而是把每个知识点落回真实工程场景：什么时候该用缓存、什么时候反而不该上缓存、缓存出故障时业务会怎么翻车、有哪些补救手段能真正落地。

Redis 相关资料里最容易出现两类问题：一类是只讲结论不讲边界，比如直接说“更新数据库后删缓存就能保证一致性”；另一类是把经验手法讲成银弹，比如把延迟双删说成标准答案。后面的文章会把这些地方单独点出来。

## 面试焦点

不是会背数据类型和命令，而是能把缓存命中率、持久化开销、热点 key、穿透击穿雪崩、主从复制、哨兵、集群和分布式锁这些问题讲成工程判断。

## 前置知识

缓存基础、网络 IO 基础

## 目标人群

3-5 年 Java 后端工程师

## 子模块

### 1. 数据结构与使用场景

- 5 种常见数据类型各自适合什么业务
- 特殊数据类型和典型业务场景怎么落地

### 2. 持久化与内存管理

- RDB、AOF 怎么选
- 过期删除和淘汰策略怎么影响线上稳定性

### 3. 线上问题与工程实践

- big key、hot key、慢命令该怎么识别
- Redis 卡顿时应该先看命令、持久化还是系统层
- 内存、配置和监控指标怎么和排障串起来

### 4. 缓存问题与一致性

- 缓存和数据库怎么协作
- 穿透、击穿、雪崩分别怎么治理

### 5. 高可用与分布式协调

- 主从复制、哨兵、集群各自解决什么问题
- Redis Cluster 的路由、槽位、扩缩容和复制排障怎么理解
- Redis 分布式锁能不能放心用，边界在哪

### 6. 扩展能力

- Pipeline 和 Lua 脚本该怎么选
- Redis 限流为什么经常配 Lua
- Redis 能不能兼职做消息队列
- 延时任务放在 Redis 上到底稳不稳

## 题目列表

### 数据结构与持久化

- [Redis 常见数据类型怎么选？](./redis-data-structures.html) - 不只是背 String、List、Hash、Set、ZSet，而是讲清各自适用场景和常见误用。
- [Redis 的特殊数据类型该怎么选？](./redis-special-data-structures.html) - Bitmap、HyperLogLog、GEO、Stream 不是冷门名词，而是场景型结构。
- [Redis 里的排行榜、计数器、签到这些场景该怎么设计？](./redis-typical-scenarios.html) - 把结构和业务目标真正对应起来。
- [RDB、AOF 和混合持久化怎么选？](./redis-persistence.html) - Redis 不是只会“在内存里飞快跑”，持久化和恢复边界才是生产问题的起点。
- [过期删除和内存淘汰到底有什么区别？](./redis-expire-eviction.html) - 这是 Redis 内存管理里最容易混淆、也最容易在线上踩坑的一组概念。

### 线上问题与工程实践

- [Redis 的大 key 和热 key 怎么发现和处理？](./redis-bigkey-hotkey.html) - 区分“大”和“热”，把判定、危害、排查和治理思路讲成一条线。
- [Redis 卡顿了该从哪里开始排查？](./redis-blocking-troubleshooting.html) - 从慢命令、big key、持久化、复制、CPU、网络和 swap 逐层收敛。
- [Redis 为什么会有内存碎片？](./redis-memory-fragmentation.html) - 不是只会背碎片率，而是知道它为什么长出来、什么时候值得处理。
- [Redis 常见配置项该怎么理解和取舍？](./redis-configuration-tuning.html) - 把 `maxmemory`、淘汰策略、AOF 刷盘、lazyfree、碎片整理放到同一张工程图里。
- [Redis 线上监控到底该盯哪些指标？](./redis-monitoring-metrics.html) - 命中率、延迟、慢日志、复制、内存和系统指标要怎么一起看。

### 缓存问题与一致性

- [缓存雪崩、击穿、穿透怎么治理？](./redis-cache-problems.html) - 缓存问题面试的高频组合题，核心在于分清成因和治理思路。
- [Redis 里的布隆过滤器到底怎么用？](./redis-bloom-filter.html) - 它最常见的工作不是“精确判断存在”，而是帮你挡住大批明显不存在的请求。
- [如何保证缓存和数据库一致性？](./redis-cache-consistency.html) - Redis 面试里最容易接到项目实战的一题，核心不在背方案，而在讲清边界、时序和补偿。

### 高可用与分布式协调

- [Redis 的高可用方案怎么理解？](./redis-high-availability.html) - 把主从复制、哨兵和集群各自解决的问题串成一条线。
- [Redis Cluster 为什么是 16384 个槽？扩缩容和路由怎么理解？](./redis-cluster-details.html) - 把哈希槽、MOVED、ASK、hash tag 和在线迁槽串成一条工程主线。
- [Redis Cluster 在工程上怎么部署和扩缩容？](./redis-cluster-operations.html) - 重点看迁槽、热点槽、分片倾斜和大 key 对集群的影响。
- [Redis 主从复制延迟和全量同步该怎么排查？](./redis-replication-troubleshooting.html) - 复制 backlog、offset、断线恢复和全量同步退化是排障重点。
- [Redis 分布式锁到底能不能用？](./redis-distributed-lock.html) - 重点不是能写出 `SET NX PX`，而是知道它的边界、续约和主从切换风险。

### 扩展能力

- [Redis 里的 Pipeline 和 Lua 脚本该怎么选？](./redis-pipeline-lua.html) - 一个主要省 RTT，一个主要做原子逻辑，别把两者混成同一种优化。
- [Redis 做分布式限流为什么经常配 Lua？](./redis-rate-limiting.html) - 固定窗口、滑动窗口、令牌桶都不难，难的是怎么把多步判定做成共享且原子。
- [Redis 能当消息队列吗？](./redis-message-queue.html) - 从 List、Pub/Sub、Stream 讲到 Redis 做 MQ 的能力边界和适用场景。
- [Redis 延时任务怎么做更稳？](./redis-delayed-task.html) - 对比过期事件、ZSet、Redisson 和专业 MQ 延时消息的取舍。
