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

## malloc 不是系统调用

`malloc` 是 C 运行库提供的内存分配函数，不是内核系统调用。它向操作系统要内存时，常见路径有两类：

- 小块内存：通过 `brk` 扩展堆顶，再由分配器在堆里切块复用。
- 大块内存：通过 `mmap` 创建匿名映射区域。

具体阈值会随 glibc 版本和运行状态调整，老资料里常见的 128KB 只能当作理解默认策略的例子，不能背成永远固定值。

## 为什么申请后不一定占物理内存？

操作系统可以先给进程一段虚拟地址。只要程序没有访问这些地址，就不一定需要分配真实物理页。

当程序第一次写入某个页时：

1. CPU 发现页表里没有有效物理映射。
2. 触发缺页异常，进入内核。
3. 内核分配物理页并更新页表。
4. 程序继续执行刚才的写入。

这也是为什么进程的 `VIRT` 很大，不代表物理内存真的用了那么多。更接近实际物理占用的是 `RES` 或 RSS。

## free 后会马上归还系统吗？

不一定。

通过 `brk` 从堆里申请的小块内存，`free` 后往往先回到 malloc 分配器的内存池，方便下次复用，不一定立刻还给操作系统。通过 `mmap` 申请的大块内存，释放后更可能直接解除映射并归还。

所以看到 Java 进程或 C/C++ 进程“业务释放了对象，但 RSS 没马上下降”，不一定就是泄漏。可能是分配器缓存、JVM 堆策略、直接内存或 Page Cache 等因素共同作用。

这里也要避免另一个绝对说法：大块 mmap 释放“更可能”归还系统，不代表任何分配器、任何版本都必然立刻让 RSS 下降。glibc arena、jemalloc size class、容器内存统计和内核回收时机都会影响观察结果。

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

## 容易踩的坑

- 不要把 `VIRT` 当成实际物理内存占用。
- 不要认为 `free` 后 RSS 必然下降。
- 不要把 `-Xmx` 当成 Java 进程总内存上限。
- 不要把 glibc 的某个 malloc 阈值说成所有版本固定行为。
- 不要忽略 `overcommit_memory`、`ulimit`、cgroup limit 和 OOM Killer 对分配结果的影响。

## 小结

- `malloc` 分配的是虚拟地址空间，不一定马上占用物理内存。
- 首次访问页面时，内核通常通过缺页异常分配物理页。
- 小块内存释放后常留在分配器内存池，大块 mmap 更可能归还系统。
- Java 进程总内存包含堆、线程栈、直接内存、元空间和 native 分配。
- 排查容器 OOM 要看 RSS、NMT、线程数和本地内存，不只看 heap dump。

## 参考

综合社区资料，并结合 JVM 本地内存与容器 OOM 排障做了边界化整理。
