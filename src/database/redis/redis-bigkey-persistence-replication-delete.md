---
title: "大 key 对持久化、复制和删除有什么影响？"
description: "从 RDB/AOF、主从复制和惰性删除讲清 Redis 大 key 风险。"
breadcrumb: true
article: true
editLink: false
category:
  - "Redis"
tag:
  - "高频"
  - "排障"
  - "项目实战"
prev:
  text: "Redis 的大 key 和热 key 怎么发现和处理？"
  link: "/database/redis/redis-bigkey-hotkey.html"
next:
  text: "Redis 卡顿了该从哪里开始排查？"
  link: "/database/redis/redis-blocking-troubleshooting.html"
---

# 大 key 对持久化、复制和删除有什么影响？

> 大 key 的危害不只是一条命令慢，它会放大持久化、复制、迁移和删除链路的成本。

## 对持久化有什么影响？

RDB 快照和 AOF rewrite 都要处理当前内存数据。大 key 会让序列化、写盘和 COW 成本变重。

如果快照期间频繁修改大 key，写时复制会复制更多内存页，导致内存峰值升高。

AOF 还多一个日常写入问题：如果 `appendfsync always`，写入大 key 后主线程要等 fsync 返回，延迟会更明显；如果是 `everysec`，通常由后台 fsync 承担，但磁盘压力大时也可能通过 `aof_delayed_fsync` 反映出来。

排查时可以一起看：

```bash
redis-cli INFO stats | grep latest_fork_usec
redis-cli INFO persistence | grep -E "rdb_last_cow_size|aof_last_cow_size|aof_delayed_fsync"
redis-cli --bigkeys
```

`--bigkeys` 建议在从库、低峰或隔离环境执行，避免扫描本身给主库增加压力。

## 对复制有什么影响？

主从复制里，大 key 会带来：

- 全量同步 RDB 更大。
- 网络传输更慢。
- 从库加载更慢。
- 增量同步里单条命令执行时间更长。

Cluster 迁槽时，大 key 也会拖慢迁移，造成局部抖动。

更具体地说，大 key 会同时影响全量同步和增量同步：

| 链路         | 大 key 的影响                                 |
| ------------ | --------------------------------------------- |
| 全量同步     | RDB 文件更大，生成、传输、加载都更慢          |
| 增量同步     | 单条大命令传播和回放时间更长                  |
| backlog      | 网络抖动后更容易追不上 offset，退化为全量同步 |
| Cluster 迁槽 | 单 key 迁移不可再拆，容易造成热点槽抖动       |

所以治理复制延迟时，不能只调 `repl-backlog-size`。backlog 可以提高断线后增量续传的概率，但如果业务持续写大 key，复制和回放仍然会被拖慢。

## 删除为什么危险？

直接 `DEL` 一个大 Hash、大 List、大 ZSet，Redis 需要释放大量对象，可能阻塞主线程。

更稳的做法：

- 使用 `UNLINK` 异步释放。
- 按 Redis 版本和场景开启 lazyfree 参数，例如 `lazyfree-lazy-eviction`、`lazyfree-lazy-expire`、`lazyfree-lazy-server-del`、`lazyfree-lazy-user-del`；其中 `lazyfree-lazy-user-del` 这类参数要以目标版本的 `redis.conf` 为准。
- 业务上拆小 key，避免单个 key 无限增长。
- 删除前先评估类型和元素数量。

如果必须清理历史大 key，建议分两层处理：

1. 业务层先停止继续写这个 key，避免一边删除一边增长。
2. 删除层优先用 `UNLINK` 或分批删除集合元素，例如对 Hash 用 `HSCAN` + `HDEL` 分批，对 ZSet 用 `ZREMRANGEBYRANK` 分段。

`UNLINK` 是 Redis 4.0 引入的异步删除命令。它能把释放内存的工作交给后台线程，但不是“瞬间没有成本”。后台释放仍然会占 CPU 和内存管理资源，所以大规模清理要限速；lazyfree 参数也只是把部分释放路径异步化，不等于所有删除、过期、淘汰都无阻塞。

## 大 key 应该怎么预防？

比起事后删除，更关键的是建模时限制增长：

| 类型   | 风险写法                  | 更稳的写法                     |
| ------ | ------------------------- | ------------------------------ |
| String | 一个 key 存超大 JSON      | 按业务维度拆字段或拆对象       |
| Hash   | 一个用户/店铺下无限字段   | 按月份、状态、分片拆 key       |
| List   | 把所有历史消息放一个 List | 只保留热窗口，历史进 MQ/数据库 |
| ZSet   | 多年排行榜放一个 ZSet     | 按时间窗口分榜单               |
| Set    | 全量用户集合无限增长      | 分桶或离线计算                 |

经验阈值只能做预警，不是硬标准。更重要的是看命令耗时、网络返回量、持久化 COW、复制延迟和删除成本有没有被放大。

## 小结

1. 大 key 会放大 RDB/AOF rewrite 的序列化、写盘和 COW 成本。
2. 大 key 会拖慢主从复制、全量同步和 Cluster 迁槽。
3. 大 key 删除可能阻塞主线程，优先考虑 `UNLINK` 和 lazyfree。
4. `UNLINK` 只是把释放转到后台，批量清理仍然要限速和观察资源。
5. 根治思路是拆分数据模型，不让单个 key 无限增长。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
