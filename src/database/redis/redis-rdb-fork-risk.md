---
title: "RDB fork 会带来哪些线上风险？"
description: "从 fork 阻塞、页表复制和写时复制讲清 RDB 快照风险。"
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
  text: "RDB、AOF 和混合持久化怎么选？"
  link: "/database/redis/redis-persistence.html"
next:
  text: "AOF rewrite 为什么可能造成卡顿？"
  link: "/database/redis/redis-aof-rewrite-stall.html"
---

# RDB fork 会带来哪些线上风险？

> RDB 快照虽然由子进程写文件，但 fork 发生在主线程路径上，大实例会因为页表复制和写时复制出现延迟抖动。

## fork 为什么不是零成本？

Redis 执行 `bgsave` 时会 fork 子进程。子进程负责把内存数据写成 RDB 文件，父进程继续处理请求。

fork 不会复制全量物理内存，但需要复制页表等内核结构。实例越大，页表越大，fork 耗时越可能升高。

这里要先区分两个命令：

| 命令     | 执行方式            | 线上风险                                              |
| -------- | ------------------- | ----------------------------------------------------- |
| `SAVE`   | 主线程同步生成 RDB  | 整个生成过程都会阻塞命令处理                          |
| `BGSAVE` | fork 子进程生成 RDB | fork 会短暂阻塞，子进程写文件期间仍有 COW 和 I/O 风险 |

生产环境讨论 RDB 风险，通常说的是 `BGSAVE`。它比 `SAVE` 友好很多，但不能理解成完全没有阻塞。

关键指标：

```text
latest_fork_usec
```

它能反映最近一次 fork 耗时。如果这个值明显变大，请求延迟也可能同步抖动。

可以这样看：

```bash
redis-cli INFO stats | grep latest_fork_usec
redis-cli INFO persistence | grep -E "rdb_bgsave_in_progress|rdb_last_bgsave_time_sec|rdb_last_cow_size"
redis-cli INFO memory | grep -E "used_memory:|used_memory_rss:"
```

`latest_fork_usec` 反映 fork 阻塞窗口，`rdb_last_bgsave_time_sec` 反映子进程写 RDB 的总耗时，`rdb_last_cow_size` 反映上次快照期间写时复制消耗了多少内存。三者要分开看：fork 慢会直接卡主线程，RDB 写得久会拉长 COW 暴露窗口，COW 大说明快照期间写入和内存页复制压力重。

## COW 为什么会放大内存？

fork 后父子进程共享物理页。父进程继续写入时，被修改的页会复制一份，这就是写时复制。

如果快照期间写入很猛，或者 big key 被频繁修改，COW 会导致内存峰值上升。内存不够时，可能触发 swap 或 OOM，延迟会更难看。

这里有个 Linux 边界：如果开启 Transparent Huge Pages（THP，透明大页），一次很小的写入也可能触发更大的页复制，COW 成本会被放大。Redis 生产环境通常建议关闭 THP。

可以检查：

```bash
cat /sys/kernel/mm/transparent_hugepage/enabled
```

如果看到当前值是 `always`，要结合运维规范调整为 `never` 或使用发行版推荐的关闭方式。

## RDB 快照会丢哪些数据？

RDB 是某个时间点的全量快照，不是连续日志。

如果 `bgsave` 开始后，主线程继续处理写请求，这些新写入不会进入当前子进程正在生成的 RDB 文件。Redis 崩溃后，最多只能恢复到最近一次成功快照的状态，快照之后的写入会丢。

所以 RDB 适合做恢复速度快、文件紧凑的快照备份；如果业务要求更小的数据丢失窗口，要配合 AOF 或混合持久化，而不是只依赖 RDB。

## 哪些场景最容易触发 RDB 抖动？

| 场景             | 为什么危险                | 处理思路                   |
| ---------------- | ------------------------- | -------------------------- |
| 单实例内存过大   | 页表复制和 RDB 写盘都更重 | 控制单实例容量，必要时拆分 |
| 写高峰触发快照   | COW 页复制增多            | 避开高峰，调整自动快照策略 |
| big key 频繁更新 | 少量命令也可能复制大量页  | 拆 key，减少大对象原地修改 |
| 磁盘 I/O 慢      | 子进程写 RDB 时间变长     | 使用稳定磁盘，监控 I/O     |
| 主库承担持久化   | 业务请求和持久化互相影响  | 可评估从库做持久化         |

## 怎么治理？

1. 控制单实例内存，不要无限做大。
2. 避免业务高峰触发快照。
3. 监控 `latest_fork_usec`、`rdb_last_bgsave_time_sec`、`rdb_last_cow_size`、内存峰值和磁盘 I/O。
4. 识别 big key，降低快照期间的大对象修改。
5. 关闭 THP，避免写时复制被大页放大。
6. 如果 Redis 只是纯缓存且能接受重建，要重新评估持久化开关和快照频率。

## 小结

1. RDB 子进程写文件，但 fork 会阻塞 Redis 主线程。
2. 实例越大，页表复制和 fork 成本越高。
3. 写时复制会放大内存，big key 修改会让问题更明显。
4. RDB 只能恢复到最近一次成功快照，快照后的写入可能丢失。
5. 线上要监控 fork 耗时、COW 内存、快照耗时、内存峰值和磁盘 I/O。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
