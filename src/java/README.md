---
title: "Java"
description: "Java 知识域入口，覆盖基础、集合、并发、JVM、IO 与新特性。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "面试里最容易答飘的点有哪些？"
  link: "/interview-preparation/interview-prep-common-traps.html"
---

# Java

Java 部分按知识域组织，而不是按“专题 / 题库”拆开。现在已经覆盖基础、集合、并发、JVM、IO 和新特性几条主线：基础看语言设计，集合看源码与工程边界，并发看线程模型与同步机制，JVM 看内存与排障，IO 看网络编程底座，新特性看版本升级的现实取舍。

## 当前子域

- [基础](./basis/)：从值传递、字符串、泛型、反射、代理到 SPI，补齐 Java 语言本身的高频追问。
- [集合](./collection/)：List、Map、Set、并发集合与队列，从源码路径讲到工程选型。
- [并发](./concurrent/)：线程模型、JMM、锁、AQS、线程池、并发工具与虚拟线程。
- [JVM](./jvm/)：内存区域、GC、类加载和线上排障。
- [IO](./io/)：流体系、BIO/NIO/AIO、NIO 三大组件和 Netty。
- [新特性](./new-features/)：Java 8 之后的版本演进、虚拟线程和现代语法。

## 当前重点文章

- [Java 是编译型语言还是解释型语言？](./basis/java-basis-compile-and-run.html)
- [String 为什么不可变？和 StringBuilder、常量池是什么关系？](./basis/java-basis-string.html)
- [ArrayList 和 LinkedList 到底怎么选？](./collection/java-collection-arraylist-linkedlist.html)
- [HashMap 的底层结构和扩容流程是什么？](./collection/java-collection-hashmap-structure.html)
- [ConcurrentHashMap 是怎么从分段锁演进到 CAS + synchronized 的？](./collection/java-collection-concurrenthashmap.html)
- [BIO、NIO、AIO 有什么区别？分别适合什么场景？](./io/java-io-models.html)
- [Netty 的线程模型是怎样的？为什么高性能？](./io/java-io-netty.html)
- [JVM 内存区域怎么划分？](./jvm/jvm-memory-areas.html)
- [线上 OOM 怎么定位？](./jvm/jvm-oom-troubleshooting.html)
- [线程池 7 个参数怎么理解？](./concurrent/java-concurrency-thread-pool.html)
- [JMM 是什么？happens-before 原则怎么理解？](./concurrent/java-concurrency-jmm.html)
- [ReentrantLock 和 AQS 是怎么配合的？](./concurrent/java-concurrency-reentrantlock.html)
- [虚拟线程解决了什么问题？和平台线程什么关系？](./concurrent/java-concurrency-virtual-thread.html)
- [G1 相比 CMS 改进了什么？](./jvm/jvm-g1-vs-cms.html)
- [Java 21 虚拟线程对传统线程池有什么影响？](./new-features/java-new-features-java21-virtual-threads.html)
