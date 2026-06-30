---
title: "Redis 持久化为什么会导致线上卡顿？"
description: "把 fork、COW、AOF rewrite、fsync 和 big key 放大效应讲清。"
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
  text: "AOF rewrite 为什么可能造成卡顿？"
  link: "/database/redis/redis-aof-rewrite-stall.html"
next:
  text: "过期删除和内存淘汰到底有什么区别？"
  link: "/database/redis/redis-expire-eviction.html"
---

# Redis 持久化为什么会导致线上卡顿？

> Redis 持久化卡顿不是一句“磁盘慢”能解释的，真正要看 fork、页表复制、写时复制、AOF rewrite 和 fsync 如何叠加。

线上 Redis 延迟突然抖一下，排查时经常会看到这些现象：

- `latest_fork_usec` 很高
- 正在 `bgsave`
- 正在 `bgrewriteaof`
- `aof_delayed_fsync` 增长
- 实例内存接近上限
- 某些 big key 在快照期间被频繁修改

这些现象背后都和持久化有关。

## 先把主线拆开

Redis 持久化引起卡顿，主要有四条线：

| 风险点   | 发生位置               | 典型影响                   |
| -------- | ---------------------- | -------------------------- |
| fork     | RDB / AOF rewrite 前   | 主线程短暂阻塞             |
| COW      | 子进程工作期间         | 内存放大，写入延迟上升     |
| fsync    | AOF 刷盘               | 磁盘慢时拖住写路径         |
| 收尾切换 | AOF rewrite 完成阶段   | 追加缓冲、切文件时出现抖动 |
| big key  | 上面所有环节都可能放大 | 复制、写盘、释放成本变重   |

所以不要只盯磁盘。很多时候问题先出在 fork 和内存。

## fork 为什么会阻塞主线程

`bgsave` 和 `bgrewriteaof` 都会通过 fork 创建子进程。

fork 并不会把 Redis 的全部物理内存复制一份给子进程，而是复制页表，让父子进程暂时共享同一批物理页。

这比复制全量内存轻很多，但不是零成本。

Redis 主线程调用 fork 时，需要等待内核复制页表等结构。实例内存越大，页表越大，这个阶段越容易抖。

所以你会看到一个关键指标：

```text
latest_fork_usec
```

它表示最近一次 fork 耗时。这个值明显升高时，Redis 主线程确实会有感知。

## COW 为什么会放大内存和延迟

fork 完以后，子进程负责写 RDB 或重写 AOF，父进程继续处理请求。

这时如果父进程修改某个共享内存页，就会触发写时复制：

```text
fork 后：
父进程页表 ─┐
 ├── 同一块物理内存
子进程页表 ─┘

父进程写入：
父进程得到新复制页
子进程继续读取旧页
```

如果写流量很高，或者被修改的是 big key，COW 会让内存占用明显增加，也可能让写命令变慢。

所以持久化期间要格外关注内存余量。实例本来就快顶满时，COW 可能把系统推向 OOM 或 swap。

## AOF rewrite 为什么不是完全无感

AOF rewrite 在后台子进程里做，但不代表完全无感。

它至少有几个成本：

1. 开始时要 fork。
2. 子进程要扫描当前数据集，生成新的基础 AOF。
3. rewrite 期间新写入还要继续记录。
4. rewrite 完成后要让新文件接上增量，再切换 manifest 或文件。

Redis 7.0 之后采用 multi-part AOF，把 AOF 拆成 base file、incremental file 和 manifest，减少了旧模型里部分重写缓冲和切换压力。

但这不等于消除了 fork、COW 和磁盘 I/O。

所以更准确的说法是：

**multi-part AOF 改善了 AOF rewrite 的组织方式，但没有让 rewrite 变成零成本。**

## `appendfsync everysec` 为什么也可能抖

很多人会说 `appendfsync everysec` 最多丢 1 秒数据。

这个表达要谨慎。官方文档把它描述为每秒 fsync 的折中策略，但线上磁盘如果持续抖动，fsync 延迟可能堆积，Redis 也可能出现延迟写盘计数增长。

要重点关注：

```text
aof_delayed_fsync
```

它增长时，说明 AOF fsync 已经对写路径产生了压力。

所以 `everysec` 是常见平衡点，不是严格实时 SLA。

## big key 会怎样放大持久化风险

big key 不只是命令执行慢，它还会放大持久化成本：

- AOF 记录大写命令时，写入量变大。
- `appendfsync always` 下，大写入刷盘成本更明显。
- fork 后修改 big key，更容易触发大范围 COW。
- RDB 子进程写文件时，大对象序列化成本更重。
- 全量同步生成 RDB 时，big key 也会拖主库。
- 删除 big key 如果不用异步释放，释放内存也可能卡主线程。

所以 big key 治理不是只为了“命令快一点”，也是为了降低持久化、复制和迁移风险。

## 排查时看哪些指标

可以从 `INFO persistence` 和 `INFO stats` 入手：

```text
latest_fork_usec
rdb_bgsave_in_progress
rdb_last_bgsave_time_sec
rdb_last_cow_size
aof_rewrite_in_progress
aof_last_bgrewrite_status
aof_delayed_fsync
```

再结合：

- 慢日志是否有 big key 命令
- 实例内存和碎片率
- 宿主机磁盘 I/O
- 是否开启透明大页 THP
- 是否有全量复制或迁槽

如果 Redis 只是纯缓存，持久化策略也要重新评估。不是所有缓存实例都应该承担同样高的数据安全成本。

## 怎么降低这类卡顿

常见治理动作：

1. 控制单实例内存，不要把一个 Redis 撑得过大。
2. 预留足够内存给 COW，避免快照期间接近上限。
3. 避免 big key，尤其避免在持久化期间频繁修改 big key。
4. 纯缓存实例可以评估弱化持久化。
5. `appendfsync always` 只用于极少数能接受性能损耗的场景。
6. 关闭透明大页，避免 COW 粒度被放大。
7. 低峰执行手工 `BGSAVE`、`BGREWRITEAOF`。
8. 监控 `latest_fork_usec`、`aof_delayed_fsync` 和 COW 大小。

## 容易踩的坑

### “bgsave 在后台，所以不会阻塞”

不严谨。RDB 写文件在子进程，但 fork 阶段会阻塞主线程，COW 也会带来内存和写入成本。

### “AOF rewrite 是子线程做的”

不对。Redis AOF rewrite 依赖后台子进程，不是普通子线程。

### “everysec 就严格只丢 1 秒”

不能当成严格承诺。磁盘抖动和系统调度会让实际表现更复杂。

### “big key 只影响读写命令”

不完整。big key 还会放大持久化、复制、删除和迁槽成本。

## 小结

- Redis 持久化卡顿主要来自 fork、COW、fsync、rewrite 收尾和 big key 放大效应。
- fork 不复制全量物理内存，但会复制页表，实例越大越容易抖。
- COW 会在子进程工作期间放大内存占用，写多和 big key 场景尤其明显。
- Redis 7.0+ multi-part AOF 改善 rewrite 组织方式，但不能消除 fork 和 I/O 成本。
- 排查时重点看 `latest_fork_usec`、COW 大小、AOF rewrite 状态和 `aof_delayed_fsync`。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
