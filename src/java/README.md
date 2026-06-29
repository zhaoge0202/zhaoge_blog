---
title: "Java"
article: false
breadcrumb: true
editLink: false
---

# Java

Java 部分按知识域组织，而不是按“专题 / 题库”拆开。当前优先补齐集合、并发和 JVM：集合看源码与工程边界，并发看线程模型与同步机制，JVM 看内存、GC 和线上排障。

## 当前子域

- [集合](./collection/)：List、Map、Set、并发集合与队列，从源码路径讲到工程选型。
- [并发](./concurrent/)：线程模型、JMM、锁、AQS、线程池、并发工具与虚拟线程。
- [JVM](./jvm/)：内存区域、GC、类加载和线上排障。

## 当前重点文章

- [ArrayList 和 LinkedList 到底怎么选？](./collection/java-collection-arraylist-linkedlist.html)
- [HashMap 的底层结构和扩容流程是什么？](./collection/java-collection-hashmap-structure.html)
- [ConcurrentHashMap 是怎么从分段锁演进到 CAS + synchronized 的？](./collection/java-collection-concurrenthashmap.html)
- [JVM 内存区域怎么划分？](./jvm/jvm-memory-areas.html)
- [线上 OOM 怎么定位？](./jvm/jvm-oom-troubleshooting.html)
- [线程池 7 个参数怎么理解？](./concurrent/java-concurrency-thread-pool.html)
- [JMM 是什么？happens-before 原则怎么理解？](./concurrent/java-concurrency-jmm.html)
- [ReentrantLock 和 AQS 是怎么配合的？](./concurrent/java-concurrency-reentrantlock.html)
- [虚拟线程解决了什么问题？和平台线程什么关系？](./concurrent/java-concurrency-virtual-thread.html)
- [G1 相比 CMS 改进了什么？](./jvm/jvm-g1-vs-cms.html)

## 后续计划

- IO 与网络 IO
- Java 新特性与工程实践
