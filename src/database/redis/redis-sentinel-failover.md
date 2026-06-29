---
title: "Redis Sentinel 是怎么判断故障并完成选主的？"
description: "讲清主观下线、客观下线、quorum、leader 选举和故障转移。"
breadcrumb: true
article: true
editLink: false
category:
  - "Redis"
tag:
  - "高频"
  - "原理深入"
  - "细节题"
prev:
  text: "Redis 主从复制是怎么完成全量和增量同步的？"
  link: "/database/redis/redis-replication-internals.html"
next:
  text: "Redis Cluster 为什么是 16384 个槽？扩缩容和路由怎么理解？"
  link: "/database/redis/redis-cluster-details.html"
---

# Redis Sentinel 是怎么判断故障并完成选主的？

> Sentinel 的关键不是“有哨兵会自动切主”，而是它怎么避免误判、怎么拿到授权、怎么挑新主、怎么把新配置通知出去。

主从复制解决了数据副本问题，但它不会自动把从库提升成主库。

主库挂了以后，如果没有 Sentinel，就要人工做几件事：

1. 判断主库是不是真的不可用。
2. 从多个从库里选一个升主。
3. 让其他从库复制新主。
4. 通知客户端连接新主。
5. 旧主回来后让它变成从库。

Sentinel 的价值就是把这套流程自动化。

## Sentinel 做三件事

可以先背成三个词：

| 职责 | 含义                       |
| ---- | -------------------------- |
| 监控 | 判断主从节点是否可达       |
| 选主 | 主库故障时挑一个从库升主   |
| 通知 | 把新主信息通知从库和客户端 |

但真正难点在第一步：怎么判断“真的故障”。

## 主观下线：一个 Sentinel 自己觉得它挂了

Sentinel 会周期性向主从节点发请求。

如果某个 Sentinel 在 `down-after-milliseconds` 时间内没有收到主库有效响应，它会把主库标为主观下线。

主观下线只代表：

**这个 Sentinel 从自己的视角看，主库不可达。**

这不一定说明主库真的挂了。可能只是这个 Sentinel 到主库的网络有问题。

## 客观下线：多个 Sentinel 达成故障判断

为了避免单点误判，Sentinel 集群会互相询问。

当足够多 Sentinel 都认为主库不可达，主库才会被标记为客观下线。

这里会用到 `quorum`。

例如：

```text
sentinel monitor mymaster 10.0.0.1 6379 2
```

最后的 `2` 表示至少需要 2 个 Sentinel 同意主库不可达，才能触发客观下线判断。

## quorum 不是 failover 多数派的全部含义

这是最容易答错的点。

Redis 官方文档明确区分了两件事：

1. `quorum` 用于判定主库是否 ODOWN。
2. 真正执行 failover，还需要 Sentinel 多数派授权 leader。

也就是说：

**quorum 负责“能不能认为它挂了”，多数派授权负责“能不能开始切主”。**

如果只有少数 Sentinel 存活，即使凑够了某个较小 quorum，也可能因为拿不到多数派授权而无法执行故障转移。

这也是为什么 Sentinel 一般至少部署 3 个，并且常用奇数个。

## 谁来执行故障转移

当主库进入客观下线后，Sentinel 之间会选出一个 leader。

只有拿到授权的 leader Sentinel 才会执行主从切换。

这样做是为了避免多个 Sentinel 同时各切各的，导致配置冲突。

leader 拿到的是一次 failover 的配置版本，也就是 epoch。后续其他 Sentinel 会接受更高版本的新配置。

## 新主怎么选

Sentinel 不是随机挑一个从库升主。

它会先过滤掉不合适的从库，比如：

- 已经下线的从库
- 和旧主断连太久的从库
- 复制状态明显不健康的从库

然后再按规则排序：

1. 优先级更高的从库优先。
2. 优先级相同，看复制进度，越接近旧主越好。
3. 还相同，再比较运行 ID。

所以更准确的表达是：

**Sentinel 会尽量选一个健康、优先级高、复制进度靠前的从库作为新主。**

## 故障转移四步

leader Sentinel 选好新主后，大致会做四件事：

1. 向被选中的从库发送 `REPLICAOF NO ONE`，让它升主。
2. 让其他从库改为复制新主。
3. 向客户端和其他 Sentinel 发布新主配置。
4. 旧主恢复后，把旧主改成新主的从库。

切换完成不代表所有从库已经完全追上新主。它表示新主已经确立，配置开始向外传播。

## 客户端怎么知道新主

Sentinel 不只是内部切换工具，也充当客户端服务发现来源。

支持 Sentinel 的客户端会向 Sentinel 查询当前 master 地址。如果发生 failover，客户端应该重新获取新 master 地址。

所以业务里用 Sentinel 时，客户端必须显式支持 Sentinel 模式。只把 Redis 地址写死成旧主地址，并不会因为有 Sentinel 就自动神奇切走。

## Sentinel 也不是强一致方案

Sentinel 建在 Redis 异步复制之上。

异步复制意味着：主库确认的写入，可能还没同步到从库。如果此时主库宕机，从库被提升，刚才那部分写入就可能丢失。

所以 Sentinel 解决的是自动故障转移，不是把 Redis 变成强一致系统。

这个边界面试里一定要主动说。

## 容易踩的坑

### “quorum 就是多数派”

不准确。quorum 用于故障判定；failover 还需要多数 Sentinel 授权。

### “一个 Sentinel 就能高可用”

不对。单 Sentinel 本身就是单点，还容易误判。

### “Sentinel 切主后数据一定不丢”

不保证。Redis 复制默认异步，故障窗口内仍可能丢写。

### “客户端不需要改造”

不一定。客户端需要支持 Sentinel 服务发现，否则可能还连着旧地址。

## 小结

- Sentinel 的核心职责是监控、选主和通知。
- 主观下线只是单个 Sentinel 的判断，客观下线需要达到 quorum。
- quorum 用于故障判定，真正执行 failover 还要多数 Sentinel 授权 leader。
- 新主选择会过滤不健康从库，再比较优先级、复制进度和 ID。
- Sentinel 提供自动故障转移，但不提供强一致保证。

## 参考

- 综合社区资料和现有 Redis 高可用文章重写。
- 对照 Redis 官方 Sentinel 文档与 Sentinel client spec，校准 `quorum`、多数派授权、ODOWN、failover 和客户端服务发现边界。
