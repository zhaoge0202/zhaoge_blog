---
title: "malloc 申请内存后真的马上占用物理内存吗？"
description: "从 brk、mmap、缺页异常和 RSS 解释内存申请与实际占用。"
breadcrumb: true
article: true
editLink: false
category:
  - "操作系统"
tag:
  - "细节题"
  - "原理深入"
  - "排障"
prev:
  text: "虚拟内存解决了什么问题？"
  link: "/cs-basics/operating-system/os-virtual-memory.html"
next:
  text: "Page Cache 是什么？为什么写文件不一定马上落盘？"
  link: "/cs-basics/operating-system/os-page-cache.html"
---

# malloc 申请内存后真的马上占用物理内存吗？

> `malloc` 先拿到的是虚拟地址空间；只有真正读写对应页面时，物理内存才通常通过缺页异常建立映射。

## 进程地址空间里有哪些区域？

先把位置放清楚。一个 Linux 进程看到的是虚拟地址空间，里面大致有这些区域：

```text
低地址
  代码段 / 只读数据
  已初始化数据段
  BSS
  堆 heap              <- brk 通常扩展这里
  mmap 映射区          <- 匿名 mmap、共享库、文件映射常在这里
  线程栈 / 主线程栈
高地址
```

这只是便于理解的简化图，具体布局会受架构、ASLR、内核版本、运行库和线程数量影响。理解 `malloc` 时抓住一点就够了：小块内存常来自堆，大块内存或特殊场景常来自匿名 `mmap` 区域。

## malloc 不是系统调用

`malloc` 是 C 运行库提供的内存分配函数，不是内核系统调用。它向操作系统要内存时，常见路径有两类：

- 小块内存：通过 `brk` 扩展堆顶，再由分配器在堆里切块复用。
- 大块内存：通过 `mmap` 创建匿名映射区域。

具体阈值会随 glibc 版本和运行状态调整，老资料里常见的 128KB 只能当作理解默认策略的例子，不能背成永远固定值。

这里还要注意：`malloc(1)` 并不意味着运行库真的只向系统拿 1 字节。分配器通常会维护 chunk 元数据、对齐、空闲链表、arena 和缓存池。第一次申请很小一块内存，也可能触发分配器向内核预留一段更大的虚拟地址范围，后续小对象直接复用这段空间。

可以用 `/proc/<pid>/maps` 观察地址空间：

```bash
cat /proc/<pid>/maps
```

里面的 `[heap]` 通常对应 `brk` 扩展出来的堆；没有文件路径的匿名 `rw-p` 映射，可能来自匿名 `mmap`、线程栈、运行库或 JVM native 内存。

## 为什么申请后不一定占物理内存？

操作系统可以先给进程一段虚拟地址。只要程序没有访问这些地址，就不一定需要分配真实物理页。

当程序第一次写入某个页时：

1. CPU 发现页表里没有有效物理映射。
2. 触发缺页异常，进入内核。
3. 内核分配物理页并更新页表。
4. 程序继续执行刚才的写入。

这也是为什么进程的 `VIRT` 很大，不代表物理内存真的用了那么多。更接近实际物理占用的是 `RES` 或 RSS。

一个常见实验是：C 程序里 `malloc(1GB)` 后先暂停，此时 `VIRT` 可能明显变大，但 RSS 不一定涨很多；再对这 1GB 做 `memset`，每个页面被写入后，RSS 才会随物理页分配上涨。

排查时可以同时看虚拟映射和实际驻留：

```bash
pmap -x <pid> | tail -n 1
cat /proc/<pid>/smaps_rollup
cat /proc/<pid>/status
```

`VmSize` 更接近虚拟地址规模，`VmRSS` 才更接近当前驻留物理内存。容器里还要看 cgroup 统计，因为 Page Cache、线程栈、直接内存等也可能进入容器内存账本。

## free 后会马上归还系统吗？

不一定。

通过 `brk` 从堆里申请的小块内存，`free` 后往往先回到 malloc 分配器的内存池，方便下次复用，不一定立刻还给操作系统。通过 `mmap` 申请的大块内存，释放后更可能直接解除映射并归还。

所以看到 Java 进程或 C/C++ 进程“业务释放了对象，但 RSS 没马上下降”，不一定就是泄漏。可能是分配器缓存、JVM 堆策略、直接内存或 Page Cache 等因素共同作用。

这里也要避免另一个绝对说法：大块 mmap 释放“更可能”归还系统，不代表任何分配器、任何版本都必然立刻让 RSS 下降。glibc arena、jemalloc size class、容器内存统计和内核回收时机都会影响观察结果。

`free(ptr)` 只传一个指针，却能知道释放多大，原因是分配器通常会在用户指针附近维护 chunk 元数据，例如大小、状态、前后块关系等。具体布局依赖分配器实现，不能把某个实验里的“前面多 16 字节”背成所有系统固定行为。

## 为什么不全部用 mmap？

`mmap` 看起来释放更干净，但不能无脑替代所有小块分配。

原因有三点：

1. 每次 `mmap` / `munmap` 都要系统调用，频繁小对象分配会放大内核态切换成本。
2. 新映射首次访问仍可能触发缺页，短生命周期小对象会带来额外抖动。
3. 大量零散映射会增加地址空间管理和页表维护成本。

`brk` 的优势是分配器可以一次向系统拿一段堆空间，再在用户态快速切块复用。代价是堆顶只能整体收缩，中间释放出来的小洞未必能归还给操作系统，长时间运行后可能形成分配器内部碎片。

所以成熟分配器会在 `brk`、`mmap`、arena、线程缓存、size class 之间做取舍。线上分析 RSS 不下降时，要先判断是“还被引用的泄漏”，还是“已经释放但被分配器缓存”。

## malloc 成功就一定安全吗？

也不一定。内存申请可能在不同阶段失败：

- 虚拟地址不够：地址空间、`ulimit`、`RLIMIT_AS` 限制导致 `malloc` 返回失败。
- 提交策略限制：Linux overcommit 策略可能影响是否允许先承诺虚拟内存。
- 触页时失败：`malloc` 成功后，真正写入页面才需要物理页；物理内存和 swap 都扛不住时，可能触发 OOM Killer。
- 容器限制：宿主机还有内存，不代表当前 cgroup 还有额度。

可以先看这些入口：

```bash
ulimit -a
cat /proc/sys/vm/overcommit_memory
cat /proc/sys/vm/overcommit_ratio
cat /proc/<pid>/oom_score
cat /proc/<pid>/oom_score_adj
```

线上不要只问“`malloc` 有没有返回 null”，还要问“申请后是否触页、RSS 是否上涨、cgroup 是否接近上限、有没有 direct reclaim 或 OOM 记录”。

## 和 Java 有什么关系？

Java 代码不直接调用 `malloc` 分配普通对象，但 JVM 和本地库会大量使用本地内存：

- 线程栈。
- DirectByteBuffer。
- Metaspace。
- JIT Code Cache。
- JNI/native 库。
- 压缩、加密、网络库内部缓冲。

堆内存受 `-Xmx` 约束，本地内存不完全受它约束。线上看到容器 OOM，但 heap dump 不大时，要怀疑本地内存或线程数。

可用这些命令辅助：

```bash
pmap -x <pid> | tail -n 1
cat /proc/<pid>/smaps_rollup
jcmd <pid> VM.native_memory summary
```

NMT 需要提前打开，例如 `-XX:NativeMemoryTracking=summary`。

如果 `jcmd` 里 Java Heap 不大，但 `smaps_rollup` 的 RSS 很高，可以继续拆 DirectByteBuffer、线程栈、Metaspace、Code Cache、JNI、glibc arena 和 Page Cache。尤其是线程数异常上涨时，每个线程栈都会消耗虚拟地址空间，真正触页后也会吃掉物理内存。

## 容易踩的坑

- 不要把 `VIRT` 当成实际物理内存占用。
- 不要认为 `free` 后 RSS 必然下降。
- 不要把 `-Xmx` 当成 Java 进程总内存上限。
- 不要把 glibc 的某个 malloc 阈值说成所有版本固定行为。
- 不要忽略 `overcommit_memory`、`ulimit`、cgroup limit 和 OOM Killer 对分配结果的影响。

## 小结

- `malloc` 分配的是虚拟地址空间，不一定马上占用物理内存。
- 首次访问页面时，内核通常通过缺页异常分配物理页。
- 小块内存释放后常留在分配器内存池，大块 `mmap` 更可能归还系统，但不是跨版本绝对行为。
- `malloc` 成功不代表物理内存已经安全到位，触页、overcommit、cgroup 和 OOM 都要看。
- Java 进程总内存包含堆、线程栈、直接内存、元空间和 native 分配。
- 排查容器 OOM 要看 RSS、NMT、线程数和本地内存，不只看 heap dump。

## 参考

基于 Linux man-pages、Linux kernel documentation、glibc malloc 行为说明、OpenJDK Native Memory Tracking 文档与 POSIX 相关规范整理，并核对了 `brk`、`mmap`、overcommit、RSS、cgroup 与 Java native 内存的观察边界。
