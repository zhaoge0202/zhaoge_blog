---
title: "Redis 主从复制是怎么完成全量和增量同步的？"
description: "从 PSYNC、replication id、offset 和 backlog 讲清复制机制。"
breadcrumb: true
article: true
editLink: false
category:
  - "Redis"
tag:
  - "高频"
  - "原理深入"
  - "体系化"
prev:
  text: "Redis 的高可用方案怎么理解？"
  link: "/database/redis/redis-high-availability.html"
next:
  text: "Redis Sentinel 是怎么判断故障并完成选主的？"
  link: "/database/redis/redis-sentinel-failover.html"
---

# Redis 主从复制是怎么完成全量和增量同步的？

> Redis 复制不是简单“主库发给从库”，它要在第一次同步、持续命令传播、断线重连和故障切换后尽量复用已有数据。

高可用文章里会提到主从复制解决数据副本和读扩展。

但面试继续追问时，通常会问得更细：

- 第一次复制为什么要生成 RDB？
- 断线后为什么有时能增量，有时只能全量？
- backlog 是干什么的？
- replication id 和 offset 又是什么？

这些问题都属于复制机制本身。

## 复制的三个阶段

Redis 主从复制可以分成三段：

```text
建立关系 -> 同步数据 -> 持续传播命令
```

如果从库之前没有和主库同步过，通常会走全量同步。

如果从库只是短暂断线，恢复后会优先尝试部分重同步。

## 第一次同步为什么通常是全量

第一次同步时，从库没有主库的数据基础。

典型流程是：

1. 从库向主库发起同步。
2. 主库 fork 子进程生成 RDB。
3. 主库把 RDB 发给从库。
4. 从库加载 RDB。
5. 主库把生成 RDB 期间新增的写命令补给从库。
6. 后续进入命令传播阶段。

这套流程的成本不低，因为它涉及：

- 主库 fork
- RDB 文件生成
- 网络传输
- 从库清空旧数据并加载 RDB
- 后续命令补齐

所以大量从库同时全量同步，可能反过来拖慢主库。

## 命令传播：同步完成后不是一直传 RDB

全量同步完成后，主从之间会保持连接。

主库收到写命令后，会把命令传播给从库。从库按同样顺序执行命令，让数据逐步追上主库。

Redis 官方文档明确说明复制默认是异步的。也就是说：

- 主库不会默认等从库确认后才返回客户端。
- 从库天然可能落后一小段。
- 故障窗口里可能丢失已经被主库确认、但还没传到从库的写入。

所以 Redis 复制追求的是低延迟和可接受的一致性，不是强一致复制。

## 断线后为什么能部分重同步

如果主从网络短暂断开，从库重连后不一定要重新全量同步。

它会尝试告诉主库：

```text
我之前复制的是哪个历史？
我已经处理到哪个 offset？
```

主库如果还能识别这个历史，并且缺失的那段命令还在 backlog 里，就可以只把缺的部分补给从库。

这就是部分重同步。

## replication id 和 offset 怎么理解

Redis 用 replication id 标识一段数据历史，用 offset 标识这段历史中的位置。

可以把它理解成：

```text
replication id = 这条数据历史线是谁
offset = 我走到这条线的哪个位置
```

如果两个节点 replication id 相同，offset 也相同，就说明它们在同一条历史线上走到了同一个位置，数据应该一致。

如果 replication id 相同但 offset 不同，就说明它们是同一条历史，只是一个落后一些。

## backlog 是断线恢复缓冲带

主库会维护一段 replication backlog。

它保存最近传播过的一段写命令流。断线恢复时，从库缺少的命令如果还在 backlog 里，就能部分重同步。

如果缺失范围已经被覆盖，就只能全量同步。

所以 backlog 太小、写流量太高、断线时间太长，都会让部分重同步失败。

## replication buffer 和 backlog 别混

这两个词容易混：

| 名称               | 作用                                     |
| ------------------ | ---------------------------------------- |
| replication buffer | 每个从库连接上的输出缓冲，负责发送命令流 |
| repl backlog       | 主库保存最近命令历史，用于断线后部分同步 |

replication buffer 更像“当前连接要发出去的数据”。

backlog 更像“最近一段历史记录，方便重连后补课”。

## 故障切换后为什么还有第二个 replication id

Redis 官方文档提到，实例会有主 replication id 和第二 replication id。

这是为了处理故障切换后的部分同步。

从库升主后，它会开启一条新的数据历史线，所以需要新的 replication id。但它也会在一定范围内记住旧主的历史信息，让其他从库有机会拿旧 id 和 offset 过来做部分同步。

否则每次故障切换后，所有从库都可能被迫全量同步，成本太高。

## 什么时候会退化成全量同步

常见原因：

- 从库第一次接入。
- 从库断线太久，缺失命令不在 backlog 里。
- backlog 太小，被高写入流量快速覆盖。
- 主库无法识别从库带来的 replication id。
- 从库重启后没有可用的持久化同步状态。

所以线上频繁全量同步时，不能只怪网络。要一起看 backlog、写入峰值、从库重启和主库 fork 压力。

## 小结

- Redis 第一次同步通常走全量：主库生成 RDB，从库加载后再补增量命令。
- 同步完成后进入命令传播阶段，复制默认是异步的。
- 部分重同步依赖 replication id、offset 和 backlog。
- backlog 保存最近命令历史，断线期间缺失的命令还在里面时才能增量补齐。
- replication buffer 是连接输出缓冲，backlog 是断线恢复历史，两者不要混。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
