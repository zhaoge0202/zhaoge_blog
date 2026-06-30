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

## 卡顿来自哪里？

常见来源：

| 来源     | 说明                                |
| -------- | ----------------------------------- |
| fork     | 和 RDB 一样，创建子进程会阻塞主线程 |
| COW      | rewrite 期间写入越多，内存复制越多  |
| 磁盘竞争 | 子进程写新 AOF，主进程还可能 fsync  |
| 收尾阶段 | 追加增量缓冲和切换文件可能抖动      |

如果磁盘慢，`aof_delayed_fsync` 增长，也说明刷盘已经影响请求路径。

## 怎么降低风险？

1. 避开业务高峰触发 rewrite。
2. 控制 AOF 文件增长和单实例内存。
3. 使用独立磁盘或更稳定的云盘规格。
4. 监控 rewrite 状态、fork 耗时、fsync 延迟。

## 小结

1. AOF rewrite 会 fork 子进程，fork 本身可能阻塞主线程。
2. rewrite 期间父进程要记录增量写命令，写入越多成本越高。
3. 磁盘 I/O 和 fsync 抖动会放大延迟。
4. rewrite 要结合业务低峰、监控和容量规划治理。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
