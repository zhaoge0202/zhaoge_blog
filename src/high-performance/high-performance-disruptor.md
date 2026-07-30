---
title: "Disruptor 为什么比 BlockingQueue 快？无锁环形队列怎么做到的？"
description: "从 RingBuffer、Sequence 到伪共享讲清 Disruptor 的无锁高性能设计。"
breadcrumb: true
article: true
editLink: false
category:
  - "高性能"
tag:
  - "进阶"
  - "原理深入"
  - "项目实战"
prev:
  text: "容量治理怎么和限流、扩容、压测联动？"
  link: "/high-performance/high-performance-capacity-governance.html"
next:
  text: "百万级数据导出和全表扫描怎么不撑爆内存？"
  link: "/high-performance/high-performance-deep-pagination.html"
---

# Disruptor 为什么比 BlockingQueue 快？无锁环形队列怎么做到的？

提到高性能队列，Java 里第一反应是 `ArrayBlockingQueue` / `LinkedBlockingQueue`，但金融、撮合、日志这类对吞吐和延迟极端敏感的场景，往往会用 LMAX 的 **Disruptor**——单线程每秒能处理上千万次事件，比 `ArrayBlockingQueue` 快一个数量级。它为什么这么快，答案是"无锁 + 环形缓冲 + 干掉伪共享"。

## Disruptor 是什么

Disruptor 是 LMAX 交易所开源的高性能内存消息组件，本质是一个**无锁的环形缓冲区（RingBuffer）**，生产者往里写事件，消费者从里读事件。它最初是为撮合引擎设计的，后来被很多框架（比如 Log4j 2 的 AsyncLogger、Hystrix 的调度）拿来做异步队列。

## 核心组件

| 组件           | 作用                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| RingBuffer     | 环形数组，存事件槽位，预分配、大小为 2 的幂                                 |
| Sequence       | 单调递增的 long，标记"写到哪 / 读到哪"，是 Disruptor 的核心                 |
| EventProcessor | 消费者线程包装，循环取事件回调                                              |
| EventHandler   | 业务回调接口（onEvent）                                                     |
| Sequencer      | 单生产者（SingleProducerSequencer）或多生产者（MultiProducerSequencer）协调 |
| WaitStrategy   | 消费者等待策略（阻塞、自旋、yield、sleep）                                  |

RingBuffer 是个数组而非链表，槽位**预分配**，事件对象复用——这避免了链表的节点分配和 GC 压力。

## 为什么比 BlockingQueue 快

### 1. 无锁（CAS）而非加锁

`ArrayBlockingQueue` 用一把 `ReentrantLock`，入队出队竞争同一把锁；`LinkedBlockingQueue` 用两把锁（入 / 出分离），仍是锁。Disruptor 单生产者用 CAS 申请槽位，无竞争时连 CAS 都省（单线程直接写）；多生产者用 CAS 抢占槽位，避免阻塞。

### 2. 环形数组 + 预分配

RingBuffer 固定大小，写到尾绕回头部，**永不扩容、永不分配新节点**。事件对象初始化时一次创建，后续复用，几乎零 GC。BlockingQueue 每入队一个元素要么用已有数组槽（有限容量），要么新建链表节点（LinkedBlockingQueue 每次入队 new Node）。

### 3. 消除伪共享（缓存行填充）

这是 Disruptor 最出名的细节。CPU 缓存以缓存行（通常 64 字节）为单位，如果两个 volatile 变量落在同一缓存行，一个线程改其中一个，会让另一个变量所在的整个缓存行失效，导致另一个线程缓存未命中——这就是**伪共享**，看起来没共享实际互相拖累。

Disruptor 的 `Sequence` 用缓存行填充（`Sequence` 类里前后补 long 占位），确保一个 Sequence 独占一个缓存行，多个消费者的 Sequence 互不干扰。

```java
// 简化示意：前后填充 long 让核心 value 独占缓存行
class PaddedAtomicLong {
    long p1, p2, p3, p4, p5, p6;
    volatile long value; // 核心
    long p7, p8, p9, p10, p11, p12;
}
```

> `@Contended` 注解（JDK 8 起需要 `-XX:-RestrictContended`）是官方的做法，Disruptor 自己手动填充。

### 4. 内存屏障精确控制

Disruptor 用 `Unsafe` 的 `putOrderedLong` / `loadFence` 等轻量屏障，在保证可见性的前提下避免 `volatile` 的全屏障开销，单生产者场景下写入更接近普通变量。

## 生产者-消费者模型

Disruptor 支持多种消费者依赖拓扑：

- 单生产者 → 多消费者（每个消费者都处理全部事件）
- 多生产者 → 多消费者
- 消费者之间依赖（C2 等 C1 处理完再处理）

消费者通过 `Sequence` 告诉 RingBuffer"我处理到哪了"，生产者写入时检查"最慢的消费者还有多少未消费"，避免覆盖未读事件——这就是**可用容量 = RingBuffer 容量 - 最慢消费者落后量**。

## 等待策略（WaitStrategy）

| 策略     | 方式             | 适用                     |
| -------- | ---------------- | ------------------------ |
| Blocking | LockSupport.park | CPU 不敏感、吞吐要求不高 |
| Sleeping | Thread.sleep     | 低延迟、低 CPU 占用折中  |
| Yielding | Thread.yield     | 中等延迟、CPU 可接受     |
| BusySpin | 死循环自旋       | 极致低延迟、CPU 可满载   |

撮合引擎、网关这类对延迟敏感的选 `BusySpin`（吃 CPU 换延迟），一般异步日志选 `Blocking`（省 CPU）。

## 什么时候用 Disruptor

- 高频事件流转：撮合、行情分发、网关异步日志、采集上报
- 单机内生产者-消费者，需要低延迟、高吞吐
- 不适合：跨进程 / 跨机器通信用 MQ；普通业务异步用 `ExecutorService` / `CompletableFuture` 足够，引入 Disruptor 反而增加复杂度

## 小结

- Disruptor 是无锁环形缓冲，比 ArrayBlockingQueue 快一个数量级，靠无锁 CAS、数组预分配、缓存行填充和精确内存屏障。
- RingBuffer 数组预分配、事件对象复用，几乎零 GC；Sequence 用缓存行填充消除伪共享。
- 消费者用 Sequence 协调，可用容量 = 容量 - 最慢消费者落后量，避免覆盖。
- 等待策略从 Blocking 到 BusySpin 四档，按 CPU 与延迟取舍。
- 适合单机高频低延迟事件流，跨机通信用 MQ，普通业务别过度引入。

## 参考

本文综合 Disruptor 官方文档与公开高性能队列教材，核对了 RingBuffer、Sequence、伪共享消除、内存屏障等机制，并对照了与 BlockingQueue 的性能差异原因。
