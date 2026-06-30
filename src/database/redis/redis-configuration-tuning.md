---
title: "Redis 常见配置项该怎么理解和取舍？"
description: "把 maxmemory、淘汰策略、appendfsync、lazyfree、activedefrag 等配置讲清。"
breadcrumb: true
article: true
editLink: false
category:
  - "Redis"
tag:
  - "排障"
  - "项目实战"
  - "进阶"
prev:
  text: "Redis 为什么会有内存碎片？"
  link: "/database/redis/redis-memory-fragmentation.html"
next:
  text: "Redis 线上监控到底该盯哪些指标？"
  link: "/database/redis/redis-monitoring-metrics.html"
---

# Redis 常见配置项该怎么理解和取舍？

> Redis 配置题最怕答成“我知道有很多参数”。面试真正想听的是：哪些参数决定稳定性，哪些参数背后是在换性能、内存和数据安全。

这一篇不追求覆盖所有配置项，只抓最常见、最容易在生产里踩坑的一批。

## 先抓主线：配置其实是在做三类取舍

| 方向           | 你在取舍什么                       |
| -------------- | ---------------------------------- |
| 内存           | 能装多少、满了怎么办、删得会不会卡 |
| 持久化         | 性能、恢复速度、数据丢失窗口       |
| 复制与后台任务 | fork 压力、同步成本、重建风险      |

所以你别把配置看成一堆参数名，而应该看成 Redis 的运行策略开关。

## `maxmemory`：最基础，也最该先设

如果不设 `maxmemory`，Redis 进程就可能一路吃内存，最后把宿主机拖进 swap 或直接 OOM。

所以比较稳的做法通常是：

- 明确给实例设上限
- 留足系统和后台任务余量

它的意义不是“限制 Redis 发挥”，而是防止 Redis 失控增长。

## `maxmemory-policy`：内存满了以后怎么活

这是面试高频配置项。

重点不是把所有策略机械背全，而是知道几类方向：

- `noeviction`
- `volatile-*`
- `allkeys-*`

### `noeviction`

内存满了直接拒绝新写。  
适合不能接受 Redis 私自踢 key 的场景。

### `volatile-*`

优先从设置了过期时间的 key 里淘汰。  
适合“有一部分 key 是缓存，另一部分更重要”的模型。

### `allkeys-*`

所有 key 都可能被淘汰。  
适合 Redis 更像纯缓存池的场景。

面试里更重要的是说清：

- 你是把 Redis 当纯缓存
- 还是当“部分业务状态存储”

这决定策略选型，不是反过来。

## `appendfsync`：AOF 的核心取舍点

持久化那篇已经讲过原理，这里只抓配置取舍：

- `always`
- `everysec`
- `no`

### `always`

最安全，但性能最差。  
通常不会是线上默认首选。

### `everysec`

工程里最常见。  
它是在性能和数据安全之间做平衡。

### `no`

更依赖操作系统刷盘时机，数据风险更大。  
除非你业务能接受，否则一般不会作为重要实例的首选。

## `lazyfree-*`：删得更轻，主线程更稳

big key 问题里已经提过，删除不是免费动作。  
Redis 后来提供了一组 lazy free 相关配置，就是为了尽量把一些重释放动作异步化。

它们的意义不是“Redis 删除从此无成本”，而是：

- 尽量少卡主线程
- 让删除、过期、淘汰更平滑

这类配置在线上非常有价值，尤其是你已经知道自己业务里存在大对象或批量删除时。

## `activedefrag`：内存碎片治理开关

如果你的实例长期存在明显碎片率问题，就会用到主动碎片整理。

它带来的收益是：

- 回收一部分碎片
- 降低 RSS 膨胀

但代价也别忘：

- 会额外吃 CPU

所以它本质也是取舍，不是“开了永远更好”。

## `repl-backlog-size`：复制恢复能力的重要缓冲

主从复制排障里最常见的一个点就是：

- 网络短断后能不能走增量同步

这个问题和复制 backlog 大小直接相关。

如果它太小：

- 主库写得快
- 从库断得稍久一点
- backlog 很快被覆盖

那恢复时就只能退化成全量同步。

所以这不是一个“冷门参数”，而是复制恢复成本的关键阀门。

## `hz`：后台任务的频率

Redis 有不少后台周期动作，比如：

- 过期清理
- 某些维护任务

`hz` 影响的是这类任务调度频率。  
频率高一些，后台处理会更积极，但也会带来更多 CPU 开销。

所以它不是越大越好，而是看你的业务和机器余量。

## keyspace notifications：能监听，不等于该滥用

这个配置项常在延时任务或事件监听场景里出现。

它的价值是：

- 让 Redis 能发布 key 变化事件

但边界也很明确：

- 不是可靠消息系统
- 打开后有额外成本

所以不要一看到“可以监听过期事件”就默认把它当严肃业务通知总线。

## 一个更稳的答法

如果面试官问“Redis 配置你平时关注哪些”，比较顺的回答可以是：

1. 先看 `maxmemory` 和淘汰策略，决定内存边界和满载行为。
2. 再看持久化，重点是 `appendfsync` 怎么在性能和数据安全之间平衡。
3. 如果业务里有大 key 或大量删除，会关注 lazy free。
4. 如果实例碎片重，会看 `activedefrag`。
5. 如果是主从架构，会重点看 `repl-backlog-size`，避免频繁退化成全量同步。

## 容易踩的坑

### “配置越保守越安全”

不对。比如 `appendfsync always` 虽然更安全，但可能把性能拖垮。

### “纯缓存和业务状态型 Redis 用同一套配置”

不合理。两者能容忍的数据丢失、淘汰行为和恢复方式不一样。

### “设了 maxmemory 就万事大吉”

不对。还要配套考虑淘汰策略、big key、碎片率和后台任务余量。

## 小结

- Redis 配置题本质上是在问性能、内存、数据安全和恢复成本怎么平衡。
- `maxmemory` 和淘汰策略决定实例在内存压力下怎么活。
- `appendfsync` 决定 AOF 在性能和数据安全之间的取舍。
- lazy free 和 `activedefrag` 更偏工程稳定性优化，不是可有可无的小开关。
- 主从架构里别忽略 `repl-backlog-size`，它直接影响断线恢复时能否走增量同步。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
