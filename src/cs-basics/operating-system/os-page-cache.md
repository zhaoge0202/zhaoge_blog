---
title: "Page Cache 是什么？为什么写文件不一定马上落盘？"
description: "从缓存 IO、脏页回写、fsync 和数据库场景讲清 Page Cache。"
breadcrumb: true
article: true
editLink: false
category:
  - "操作系统"
tag:
  - "高频"
  - "原理深入"
  - "项目实战"
prev:
  text: "malloc 申请内存后真的马上占用物理内存吗？"
  link: "/cs-basics/operating-system/os-malloc-physical-memory.html"
next:
  text: "select、poll、epoll 的区别是什么？"
  link: "/cs-basics/operating-system/os-io-multiplexing.html"
---

# Page Cache 是什么？为什么写文件不一定马上落盘？

> Page Cache 是内核用内存给文件做的缓存；`write` 成功通常只代表写进内核缓存，不等于数据已经安全落到磁盘。

## Page Cache 解决什么问题？

磁盘比内存慢很多。Linux 会把文件数据缓存到内存页里，这部分缓存就是 Page Cache。读文件时，命中缓存就不用访问磁盘；写文件时，先写到缓存页，再由内核异步回写到磁盘。

这带来两个好处：

- 读缓存：热点文件、顺序读、预读都能减少磁盘 IO。
- 写合并：多次小写可以合并成更大的磁盘写，提高吞吐。

所以 `free` 看到内存被 cache 占满，不一定是坏事。Linux 会尽量用空闲内存做缓存，内存紧张时再回收干净页。

## 写文件为什么不一定马上落盘？

普通 buffered IO 的 `write(fd, data)` 大致是：

1. 用户态数据拷贝到内核 Page Cache。
2. 对应页标记为脏页。
3. `write` 返回。
4. 后台回写线程在合适时机把脏页刷到磁盘。

如果进程在第 3 步后崩溃，数据还在内核 Page Cache 中，其他进程读这个文件通常还能读到新内容。如果整台机器断电或内核崩溃，而脏页还没刷盘，这部分数据就可能丢。

要强制落盘，需要主动调用：

```c
fsync(fd);
fdatasync(fd);
```

`fsync` 更强调数据和元数据都同步，`fdatasync` 只同步必要元数据和数据。

## 和 MySQL、Redis 有什么关系？

MySQL InnoDB 有自己的 Buffer Pool，很多场景会考虑绕开或弱化 Page Cache，避免数据在 InnoDB Buffer Pool 和 Page Cache 里缓存两份。是否使用 Direct IO 取决于数据库配置和文件类型。

Redis AOF 写入也会经过操作系统缓存，`appendfsync always/everysec/no` 的取舍，本质是在吞吐和丢数据窗口之间权衡。

日志系统、消息队列、Kafka segment 文件也会利用 Page Cache。顺序写、顺序读和预读机制可以让磁盘文件表现得像内存一样快一段时间。

## 怎么观察 Page Cache？

可以先看：

```bash
free -h
cat /proc/meminfo
```

重点关注 `Cached`、`Buffers`、`Dirty`、`Writeback`。如果 `Dirty` 长期很高，说明有大量脏页尚未回写，可能受磁盘吞吐、回写参数或应用写入速度影响。

有的资料会把 Page Cache 粗略写成 `Buffers + Cached + SwapCached`，这适合建立直觉，但不要当成精确公式。不同内核版本、`Shmem`、`SReclaimable` 和统计口径都会影响你在 `/proc/meminfo` 里看到的数值。

容器场景要注意：文件 IO 产生的 Page Cache 也可能计入 cgroup 内存。应用堆不大但容器内存持续升高时，要把 Page Cache 纳入排查。

## 容易踩的坑

- `write` 成功不等于落盘成功。
- 进程崩溃和机器崩溃不是一回事：前者 Page Cache 还在，后者缓存可能丢。
- Page Cache 不是“内存泄漏”，可回收缓存和不可回收匿名内存要区分。
- Direct IO 绕开 Page Cache，但也失去内核预读、合并等优化，不是所有场景都更快。
- Direct IO 写成功也不等于绝对持久化成功，还要看磁盘缓存、RAID/控制器缓存、文件系统屏障和挂载参数。

## 小结

- Page Cache 是内核管理的文件缓存，用内存加速读写磁盘文件。
- 普通 `write` 通常先写 Page Cache，脏页稍后由内核回写。
- 要缩小机器崩溃丢数据窗口，需要 `fsync`、`fdatasync` 或应用级刷盘策略。
- MySQL、Redis AOF、Kafka 都和 Page Cache 或 Direct IO 取舍相关。
- 排查内存时要区分匿名内存、Page Cache、Dirty 和 Writeback。

## 参考

基于 Linux man-pages、Linux kernel documentation、OpenJDK 工具文档与 POSIX 相关规范中进程、线程、内存、文件系统、I/O、epoll、sendfile 等内容整理。
