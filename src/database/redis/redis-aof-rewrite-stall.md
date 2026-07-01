---
title: "AOF rewrite 为什么可能造成卡顿？"
description: "从重写子进程、增量缓冲和磁盘 I/O 讲清 AOF rewrite 抖动。"
breadcrumb: true
article: true
editLink: false
category:
  - "Redis"
tag:
  - "排障"
  - "原理深入"
  - "项目实战"
prev:
  text: "RDB fork 会带来哪些线上风险？"
  link: "/database/redis/redis-rdb-fork-risk.html"
next:
  text: "Redis 持久化为什么会导致线上卡顿？"
  link: "/database/redis/redis-persistence-latency.html"
---

# AOF rewrite 为什么可能造成卡顿？

> AOF rewrite 的核心风险不只是“写新文件”，还包括 fork、重写期间增量缓冲、磁盘竞争和收尾切换。

## rewrite 到底在做什么？

AOF 文件长期追加会越来越大。rewrite 会根据当前内存状态生成一份更紧凑的新 AOF 文件。

```text
fork 子进程 -> 子进程写新 AOF -> 父进程记录增量写命令 -> 收尾追加增量 -> 切换新文件
```

子进程负责重写，但父进程还要继续接收写请求，并维护 rewrite 期间的增量缓冲。

这里要纠正一个常见误解：AOF rewrite 不是把旧 AOF 文件从头读一遍再压缩。它是根据 Redis 当前内存里的最终状态，重新生成一份能恢复出同样数据的新 AOF。比如同一个 key 被改了 100 次，重写后通常只需要记录最终状态相关的命令。

## 卡顿来自哪里？

常见来源：

| 来源       | 说明                                   | 典型指标                 |
| ---------- | -------------------------------------- | ------------------------ |
| fork       | 和 RDB 一样，创建子进程会阻塞主线程    | `latest_fork_usec`       |
| COW        | rewrite 期间写入越多，内存复制越多     | `aof_last_cow_size`      |
| 磁盘竞争   | 子进程写新 AOF，主进程还可能 fsync     | 磁盘 util、iowait        |
| fsync 延迟 | everysec 下后台 fsync 太慢会反压主线程 | `aof_delayed_fsync`      |
| 收尾阶段   | 追加增量缓冲和切换文件可能抖动         | rewrite 完成瞬间延迟尖刺 |

如果磁盘慢，`aof_delayed_fsync` 增长，也说明刷盘已经影响请求路径。

可以这样观察：

```bash
redis-cli INFO persistence | grep -E "aof_rewrite_in_progress|aof_last_bgrewrite_status|aof_current_size|aof_base_size|aof_buffer_length|aof_delayed_fsync|aof_last_cow_size"
redis-cli INFO stats | grep latest_fork_usec
```

`aof_current_size` 和 `aof_base_size` 的差距可以帮助判断 rewrite 是否频繁触发；`aof_rewrite_in_progress=1` 时如果延迟同步升高，就要重点看磁盘和写入流量。

还要同时看磁盘空间和 inode：

```bash
df -h /var/lib/redis
df -i /var/lib/redis
```

rewrite 会先写新文件，再完成替换。磁盘或 inode 不足时，新文件可能写失败，但旧 AOF 不能被破坏，所以这类失败更像“重写没成功”，不是“旧数据立刻丢失”。

## Redis 7.0 之后有什么边界变化？

Redis 7.0 引入 Multi-Part AOF，把 AOF 拆成 base、incremental、history 等文件角色，解决了旧版本 rewrite 期间增量数据处理的一部分资源浪费问题。

但这不等于 AOF rewrite 没风险：

- fork 仍然存在。
- COW 仍然可能放大内存峰值。
- 子进程写 base 文件仍然会抢磁盘 I/O。
- 切换和清理历史文件仍然需要关注磁盘空间。

所以版本升级能改善一部分机制，但不能替代容量、磁盘和写入峰值治理。

## 怎么降低风险？

1. 避开业务高峰触发 rewrite。
2. 控制 AOF 文件增长和单实例内存。
3. 使用独立磁盘或更稳定的云盘规格。
4. 监控 rewrite 状态、fork 耗时、COW 内存、fsync 延迟。
5. 合理设置 `auto-aof-rewrite-min-size` 和 `auto-aof-rewrite-percentage`，避免过于频繁重写。
6. 预留磁盘空间和 inode，rewrite 失败不能影响旧 AOF 可用性。

## appendfsync 会怎么影响卡顿和丢数据？

AOF rewrite 之外，日常 AOF 刷盘策略也会影响延迟：

| 策略       | 性能影响                   | 数据丢失窗口 |
| ---------- | -------------------------- | ------------ |
| `always`   | 每次写都 fsync，延迟最敏感 | 最小         |
| `everysec` | 通常折中，后台每秒刷盘     | 一般秒级     |
| `no`       | 交给操作系统，性能最好     | 不可控       |

生产里最常见的是 `everysec`。但磁盘 I/O 抖动时，后台 fsync 仍可能拖慢主线程，所以要把 `aof_delayed_fsync` 当成磁盘健康和 AOF 反压的告警指标。

## 小结

1. AOF rewrite 会 fork 子进程，fork 本身可能阻塞主线程。
2. rewrite 期间父进程要记录增量写命令，写入越多成本越高。
3. 磁盘 I/O、fsync 抖动、COW 内存和收尾切换都会放大延迟。
4. Redis 7.0 的 Multi-Part AOF 改善了增量文件组织，但不能消除 fork、COW 和磁盘风险。
5. rewrite 要结合业务低峰、监控和容量规划治理。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
