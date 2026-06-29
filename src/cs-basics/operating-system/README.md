---
title: "操作系统"
description: "围绕进程线程、内存、Page Cache 与高性能 IO 的操作系统专题。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "计算机网络"
  link: "/cs-basics/network/"
next:
  text: "进程和线程有什么区别？为什么线程更轻量？"
  link: "/cs-basics/operating-system/os-process-thread.html"
---

# 操作系统

## 为什么重要

Java 后端遇到线程池打满、RSS 飙升、磁盘写入慢、Netty 连接数上不去时，表面看是框架问题，往下追通常是操作系统在分配 CPU、内存、文件缓存和网络事件。

这组文章不按教材目录铺开，而是围绕后端最常被追问的主线组织：进程线程 -> 内存 -> 文件系统 -> IO 模型 -> 网络编程。

## 进程与线程

- [进程和线程有什么区别？为什么线程更轻量？](./os-process-thread.md)
- [上下文切换为什么会影响性能？](./os-context-switch.md)
- [线程数量能无限增加吗？](./os-thread-count-limit.md)
- [进程间通信有哪些方式？Java 后端常遇到哪些？](./os-ipc.md)
- [死锁产生的条件是什么？线上怎么避免？](./os-deadlock.md)

## 内存与文件系统

- [虚拟内存解决了什么问题？](./os-virtual-memory.md)
- [malloc 申请内存后真的马上占用物理内存吗？](./os-malloc-physical-memory.md)
- [Page Cache 是什么？为什么写文件不一定马上落盘？](./os-page-cache.md)

## 网络 IO

- [select、poll、epoll 的区别是什么？](./os-io-multiplexing.md)
- [零拷贝到底少拷了什么？](./os-zero-copy.md)
- [Reactor 模型为什么支撑 Netty？](./os-reactor-netty.md)

## 学习建议

先把进程、线程、上下文切换和线程数量限制讲清楚，再看虚拟内存、Page Cache、零拷贝。最后把 epoll 和 Reactor 串起来，就能把 Redis、Nginx、Netty、Kafka 这类高性能组件的共同底座讲明白。
