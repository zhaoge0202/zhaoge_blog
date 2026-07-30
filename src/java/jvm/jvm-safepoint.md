---
title: "安全点是什么？为什么 GC 和偏向锁都依赖它？"
description: "从 safepoint、STW 到偏向锁撤销讲清安全点的作用与排查。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "进阶"
  - "原理深入"
  - "细节题"
prev:
  text: "JIT 编译器是怎么工作的？解释执行、C1、C2 有什么关系？"
  link: "/java/jvm/jvm-jit-compiler.html"
next:
  text: "逃逸分析、标量替换、锁消除到底优化了什么？"
  link: "/java/jvm/jvm-escape-analysis.html"
---

# 安全点是什么？为什么 GC 和偏向锁都依赖它？

线上有时会看到一个诡异现象：GC 日志显示这次 GC 总停顿很长，但实际 GC 工作时间很短——多出来的时间花在"等所有线程进入安全点"上。这个安全点（safepoint）是 JVM 里一个不起眼但很关键的概念，GC、偏向锁撤销、dump 都依赖它。

## 安全点是什么

安全点是 JVM 可以"安全暂停所有应用线程"的位置。很多操作（GC、偏向锁批量撤销、thread dump、heap dump）需要堆处于一致状态——所有线程都停住，栈上没有正在处理的关键引用，才能安心扫堆。这些操作统称 STW（Stop-The-World）。

线程只有在到达安全点时才能被安全暂停，所以 JIT 会在一些固定位置插入"轮询点"，线程跑到那里会检查"是否需要进入 safepoint"。

## 安全点都在哪些位置

常见的轮询点：

- 方法返回处
- 循环回边（loop back edge）
- 方法调用处

注意：**不是每条指令都是安全点**，只有 JIT 插了轮询的地方才是。这就埋了一个隐患——如果线程卡在一个没有安全点的循环里，其他线程就得等它。

## 进入安全点的流程

1. JVM 需要执行 STW 操作（比如 GC），触发 safepoint。
2. 各应用线程继续跑，直到碰到下一个轮询点，检测到"需要进 safepoint"的标志，把自己阻塞。
3. 所有线程都阻塞后，JVM 才开始真正的 STW 工作。
4. 工作完成，释放 safepoint，各线程恢复。

从"触发"到"所有线程都停住"的这段时间叫 **TTSP（Time To Safepoint）**。如果某个线程迟迟不进安全点，TTSP 就很长，表现为 STW 久、但 GC 本身很快——这正是常见的困惑来源。

## 偏向锁撤销为什么需要安全点

偏向锁（biased locking）的设计假设是"锁基本只被一个线程用"，所以第一次获取时直接把线程 ID 写进对象头，不用 CAS。但当出现竞争、需要撤销偏向时，要批量重偏向或撤销——这个操作要 safepoint（因为要确保所有线程都不在用这些锁）。

代价：高竞争场景下偏向锁的撤销频繁触发 safepoint，STW 开销反而大。这也是 **JDK 15 起默认禁用偏向锁**的重要原因——它在现代多核并发场景下弊大于利。

## 长循环导致安全点延迟

JDK 10 之前，`int` 类型的 counted loop（可数循环）**不插 safepoint**，因为假设它很快结束。但如果循环次数很大、循环体又简单，线程可能跑很久都不进安全点，其他线程等它等到 TTSP 飙升。

典型症状：GC 日志的 `Safepoint` 的 `Time to safepoint` 很长，但 `[GC` 实际时间短；某个线程正在跑一个大 `int` 循环。

JDK 10 引入 **Loop Striping**（及相关 safepoint 改进），给 counted loop 也插了轮询点，大幅缓解这个问题。

## 怎么排查

- JDK 9+：`-Xlog:safepoint`（统一日志），看每次 safepoint 的 `Time to safepoint` 和总时长。
- 旧版：`-XX:+PrintSafepointStatistics -XX:PrintSafepointStatisticsCount=1`。
- 重点关注 `SafepointSynchronize` 耗时、TTSP 字段。

如果发现 TTSP 长，结合业务看是不是有大循环、或某个线程在跑纯计算（不进安全点）。

## 小结

- 安全点是 JVM 可安全暂停所有线程的位置，GC、偏向锁撤销、dump 都靠它做 STW。
- 轮询点插在方法返回、循环回边、方法调用处；不是每条指令都是安全点。
- TTSP（进安全点时间）长会让 STW 久但 GC 快，常见于线程卡在无安全点的大循环里。
- 偏向锁撤销需 safepoint，高竞争下开销大，JDK 15 起默认禁用偏向锁。
- 用 `-Xlog:safepoint` 排查 TTSP，定位大循环或纯计算线程。

## 参考

本文综合公开 JVM 教材与 OpenJDK 文档，核对了安全点的轮询位置、TTSP 机制、偏向锁撤销与 safepoint 的关系，并对照了 JDK 10 的 safepoint 改进与 JDK 15 偏向锁默认禁用等版本变化。
