---
title: "并发"
description: "围绕线程模型、等待唤醒、JMM、锁、AQS、线程池、并发工具与虚拟线程的进阶面试专题。"
article: true
breadcrumb: true
editLink: false
next:
  text: "线程有哪几种创建方式？生命周期状态怎么转换？"
  link: "/java/concurrent/java-concurrency-basics.html"
---

# 并发

## 为什么重要

并发是区分 CRUD 熟练工和能处理复杂服务端问题的核心模块。面试官从一道"线程池参数"切入，就能探出你对 JMM、等待唤醒、锁、AQS、ThreadLocal 的理解深度。

## 知识主线

线程模型 → 等待唤醒 → 内存模型（JMM / happens-before）→ 锁与同步（synchronized / CAS / AQS）→ 协作工具与线程池 → 并发工具与集合 → 虚拟线程

## 题目列表

### 线程基础与内存模型

- [线程有哪几种创建方式？生命周期状态怎么转换？](./java-concurrency-basics.html) — 线程创建与状态机，并发入门第一篇。
- [JMM 是什么？happens-before 原则怎么理解？](./java-concurrency-jmm.html) — Java 内存模型、主内存与工作内存、happens-before 八条规则。
- [volatile 能保证什么？不能保证什么？](./java-concurrency-volatile.html) — 可见性、禁止重排序原理与能力边界。

### 锁与同步

- [synchronized 的底层原理是什么？锁优化怎么回事？](./java-concurrency-synchronized.html) — 对象头、Monitor、偏向锁废弃、轻量级/重量级锁升级。
- [wait/notify、Condition、LockSupport 有什么区别？](./java-concurrency-wait-notify-locksupport.html) — monitor 等待集、Condition 条件队列与 park/unpark 许可模型。
- [CAS 是怎么实现原子操作的？有哪些问题？](./java-concurrency-cas.html) — Unsafe.compareAndSwap、ABA 问题、自旋开销。
- [ReentrantLock 和 AQS 是怎么配合的？](./java-concurrency-reentrantlock.html) — AQS 队列结构、独占/共享模式、公平与非公平锁。

### 协作工具与线程池

- [CountDownLatch、CyclicBarrier、Semaphore、Phaser 分别解决什么问题？](./java-concurrency-coordination-tools.html) — 任务等待、阶段汇合、并发许可与动态参与者协作。
- [BlockingQueue 怎么选？它和线程池是什么关系？](./java-concurrency-blockingqueue.html) — 有界队列、直接移交、延迟队列与线程池执行流程。
- [线程池 7 个参数怎么理解？执行流程是怎样的？](./java-concurrency-thread-pool.html) — 7 参数配置、执行流程、拒绝策略、线上排障。

### 并发工具与集合

- [ThreadLocal 原理是什么？为什么会内存泄漏？](./java-concurrency-threadlocal.html) — ThreadLocalMap 弱引用链路、内存泄漏成因与清理时机。
- [ConcurrentHashMap 是怎么保证线程安全的？](./java-concurrency-concurrent-collections.html) — JDK 7 分段锁 → JDK 8 CAS + synchronized 演进。
- [CompletableFuture 怎么做异步任务编排？](./java-concurrency-completablefuture.html) — 链式编排、异常处理、线程池绑定与常见陷阱。
- [ForkJoinPool 和 parallelStream 适合什么场景？有哪些坑？](./java-concurrency-forkjoin-parallelstream.html) — 任务拆分、工作窃取、公共线程池与并行流边界。

### 虚拟线程

- [虚拟线程解决了什么问题？和平台线程什么关系？](./java-concurrency-virtual-thread.html) — JDK 21 虚拟线程、Pinning 问题、JDK 24 改进与适用场景。

## 前置知识

Java 基础、集合、线程基础

## 目标人群

3-5 年 Java 后端工程师
