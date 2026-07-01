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

历史上还会区分 Page Cache 和 Buffer Cache：前者偏文件页缓存，后者偏块设备缓存。现代 Linux 里两者关系已经不像早期那样割裂，很多工程语境会把文件缓存、块缓存放在一起讨论。但排查时不能把 `Buffers`、`Cached`、`SwapCached` 粗暴相加后当成精确 Page Cache，内核版本、`Shmem`、`SReclaimable`、容器统计口径都会影响结果。

## 文件页和匿名页有什么区别？

内存回收时，Page Cache 对应的文件页和进程堆栈这类匿名页，处理成本不一样：

| 类型       | 来源                               | 回收方式                 | 成本 |
| ---------- | ---------------------------------- | ------------------------ | ---- |
| 干净文件页 | 读文件、文件映射、缓存命中后未修改 | 直接丢弃，需要时再读文件 | 低   |
| 脏文件页   | 写文件后还没刷盘                   | 先回写磁盘，再释放       | 中高 |
| 匿名页     | 堆、栈、匿名 mmap                  | 通常要依赖 swap 才能换出 | 高   |

这也是为什么文件缓存占内存不一定可怕：干净文件页可回收。真正容易造成抖动的是大量脏页回写、匿名页 swap、直接内存回收。

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

再补一个 `sync`：

| 调用        | 刷新范围                   | 常见用途                             |
| ----------- | -------------------------- | ------------------------------------ |
| `fsync`     | 指定文件的数据和相关元数据 | 数据库、日志、关键文件强一致刷盘     |
| `fdatasync` | 指定文件数据和必要元数据   | 只关心文件内容持久化，少刷部分元数据 |
| `sync`      | 系统范围内的脏数据提交回写 | 管理操作，不适合业务请求频繁调用     |

脏页回写通常有三个触发来源：应用主动调用刷盘接口；内核后台线程按周期或脏页比例回写；内存回收发现脏页时先写回再释放。第三类最容易和延迟抖动绑在一起，因为业务线程可能被直接回收路径拖住。

可以看这些参数理解回写策略：

```bash
cat /proc/sys/vm/dirty_ratio
cat /proc/sys/vm/dirty_background_ratio
cat /proc/sys/vm/dirty_expire_centisecs
cat /proc/sys/vm/dirty_writeback_centisecs
```

参数名会让人误以为调大一定提高性能，但脏页攒太多会放大机器故障丢数据窗口，也可能在集中回写时制造 IO 尖峰。

## 和 MySQL、Redis 有什么关系？

MySQL InnoDB 有自己的 Buffer Pool，很多场景会考虑绕开或弱化 Page Cache，避免数据在 InnoDB Buffer Pool 和 Page Cache 里缓存两份。是否使用 Direct IO 取决于数据库配置和文件类型。

Redis AOF 写入也会经过操作系统缓存，`appendfsync always/everysec/no` 的取舍，本质是在吞吐和丢数据窗口之间权衡。

日志系统、消息队列、Kafka segment 文件也会利用 Page Cache。顺序写、顺序读和预读机制可以让磁盘文件表现得像内存一样快一段时间。

顺序读还有预读机制。应用只请求当前页时，内核可能把后续相邻页也读进 Page Cache。日志扫描、Kafka 顺序消费、冷文件顺序读取会受益；但如果访问模式很随机，预读命中率低，就可能变成额外 IO 和缓存污染。

Direct IO 的价值是绕开 Page Cache，减少双缓存并让应用自己管理缓存策略。它不等于“所有场景更快”，也不等于“写成功就绝对持久化”。设备缓存、控制器缓存、RAID、文件系统屏障、挂载参数都会影响最终落盘语义。

## 怎么观察 Page Cache？

可以先看：

```bash
free -h
cat /proc/meminfo
```

重点关注 `Cached`、`Buffers`、`Dirty`、`Writeback`。如果 `Dirty` 长期很高，说明有大量脏页尚未回写，可能受磁盘吞吐、回写参数或应用写入速度影响。

有的资料会把 Page Cache 粗略写成 `Buffers + Cached + SwapCached`，这适合建立直觉，但不要当成精确公式。不同内核版本、`Shmem`、`SReclaimable` 和统计口径都会影响你在 `/proc/meminfo` 里看到的数值。

容器场景要注意：文件 IO 产生的 Page Cache 也可能计入 cgroup 内存。应用堆不大但容器内存持续升高时，要把 Page Cache 纳入排查。

进一步定位可以看：

```bash
cat /proc/meminfo | egrep 'Cached|Buffers|Dirty|Writeback|Active|Inactive|SReclaimable'
iostat -xz 1
pidstat -d 1
vmstat 1
```

如果 `Dirty`、`Writeback` 高，同时 `iostat` 里磁盘利用率、await、队列长度也高，就要怀疑写入速度超过了设备回写能力。若容器内存上涨但 Java 堆平稳，可以同时看 cgroup memory、进程 RSS、应用写文件量和 Page Cache。

## 容易踩的坑

- `write` 成功不等于落盘成功。
- 进程崩溃和机器崩溃不是一回事：前者 Page Cache 还在，后者缓存可能丢。
- Page Cache 不是“内存泄漏”，可回收缓存和不可回收匿名内存要区分。
- Direct IO 绕开 Page Cache，但也失去内核预读、合并等优化，不是所有场景都更快。
- Direct IO 写成功也不等于绝对持久化成功，还要看磁盘缓存、RAID/控制器缓存、文件系统屏障和挂载参数。
- 容器里“堆不大但内存高”不能只怪 JVM，文件 IO 造成的 Page Cache 也可能被记账。

## 小结

- Page Cache 是内核管理的文件缓存，用内存加速读写磁盘文件。
- 普通 `write` 通常先写 Page Cache，脏页稍后由内核回写。
- 要缩小机器崩溃丢数据窗口，需要 `fsync`、`fdatasync` 或应用级刷盘策略。
- 干净文件页回收成本低，脏页和匿名页回收更容易带来 IO 抖动。
- MySQL、Redis AOF、Kafka 都和 Page Cache、预读、回写或 Direct IO 取舍相关。
- 排查内存和 IO 时要区分匿名内存、Page Cache、Dirty、Writeback、cgroup 记账和磁盘压力。

## 参考

基于 Linux man-pages、Linux kernel documentation、文件系统刷盘接口说明、数据库与日志系统常见刷盘策略、POSIX 相关规范整理，并核对了 Page Cache、脏页回写、Direct IO、容器内存记账与数据库缓存的工程边界。
