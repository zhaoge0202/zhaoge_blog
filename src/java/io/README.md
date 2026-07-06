---
title: "IO"
description: "Java IO 专题，从 BIO、NIO 到 Netty，讲高并发网络编程的 IO 模型底座。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "JVM 参数调优到底在调什么？"
  link: "/java/jvm/jvm-parameters-tuning.html"
next:
  text: "Java IO 流体系是怎么组织的？字节流和字符流有什么区别？"
  link: "/java/io/java-io-streams.html"
---

# IO

## 为什么重要

从文件读写到网络编程，IO 一头连着 Java 语言本身的流体系，一头连着操作系统的阻塞/非阻塞、多路复用和事件驱动模型。很多中间件为什么用 Netty、为什么强调 Reactor，本质都要回到这里。

## 知识主线

流体系与编码桥接 → 装饰器/适配器 → BIO / NIO / AIO → NIO 三大组件 → Netty

## 题目列表

- [Java IO 流体系是怎么组织的？字节流和字符流有什么区别？](./java-io-streams.html) — 从四大抽象基类、编码桥接到缓冲流，先把 IO 类谱系看明白。
- [Java IO 里用到了哪些设计模式？](./java-io-design-patterns.html) — 重点拆装饰器和适配器，再补 NIO 里的工厂与观察者影子。
- [BIO、NIO、AIO 有什么区别？分别适合什么场景？](./java-io-models.html) — 先把同步/异步、阻塞/非阻塞两组概念分开，再谈三种模型。
- [NIO 的 Channel、Buffer、Selector 是怎么配合的？](./java-io-nio-components.html) — 讲清缓冲区指针模型、通道和多路复用器的协作。
- [Netty 的线程模型是怎样的？为什么高性能？](./java-io-netty.html) — 从主从 Reactor、无锁串行化、零拷贝到内存池串起 Netty。
