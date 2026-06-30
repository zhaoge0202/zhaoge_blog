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

关键指标：

```text
latest_fork_usec
```

它能反映最近一次 fork 耗时。如果这个值明显变大，请求延迟也可能同步抖动。

## COW 为什么会放大内存？

fork 后父子进程共享物理页。父进程继续写入时，被修改的页会复制一份，这就是写时复制。

如果快照期间写入很猛，或者 big key 被频繁修改，COW 会导致内存峰值上升。内存不够时，可能触发 swap 或 OOM，延迟会更难看。

## 怎么治理？

1. 控制单实例内存，不要无限做大。
2. 避免业务高峰触发快照。
3. 监控 `latest_fork_usec`、内存峰值、磁盘 I/O。
4. 识别 big key，降低快照期间的大对象修改。

## 小结

1. RDB 子进程写文件，但 fork 会阻塞 Redis 主线程。
2. 实例越大，页表复制和 fork 成本越高。
3. 写时复制会放大内存，big key 修改会让问题更明显。
4. 线上要监控 fork 耗时、内存峰值和磁盘 I/O。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
