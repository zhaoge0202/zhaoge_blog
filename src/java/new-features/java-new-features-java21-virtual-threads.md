---
title: "Java 21 虚拟线程对传统线程池有什么影响？"
description: "从阻塞成本、线程池模型和适用边界讲清 Java 21 虚拟线程。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java"
tag:
  - "高频"
  - "进阶"
  - "项目实战"
prev:
  text: "Java 17 为什么是新的长期主线版本？"
  link: "/java/new-features/java-new-features-java17-lts.html"
next:
  text: "新版本 Java 的模式匹配、记录类、密封类适合哪些场景？"
  link: "/java/new-features/java-new-features-modern-syntax.html"
---

# Java 21 虚拟线程对传统线程池有什么影响？

> 虚拟线程降低的是阻塞等待的线程成本，不是让数据库、网络和 CPU 资源无限扩容。

## 传统线程池解决什么？

平台线程是操作系统线程，创建和切换成本高，所以传统服务会用线程池复用线程，并用队列控制并发。

虚拟线程让“一个请求一个线程”重新变得可行。阻塞 I/O 时，虚拟线程可以从载体线程上卸载，减少平台线程被白白占住的时间。

## 虚拟线程适合什么？

适合大量阻塞 I/O 场景：

- HTTP/RPC 调用。
- JDBC 查询。
- 文件或网络等待。

不适合指望它解决 CPU 密集任务。CPU 还是那些核心数，计算任务多了仍然要限流。

## 线程池会消失吗？

不会。变化的是“池化线程”这件事不再适合虚拟线程。虚拟线程通常按任务创建，用完结束。

但仍然需要：

- 数据库连接池。
- RPC 并发限流。
- 下游隔离。
- 任务队列和背压。

换句话说，线程池的复用价值下降了，资源治理价值还在。

## 小结

1. 虚拟线程降低阻塞 I/O 下的平台线程占用成本。
2. 虚拟线程不提升 CPU 核心数，也不扩大数据库连接数。
3. 不要池化虚拟线程，应该按任务创建。
4. 资源隔离、限流、连接池和超时仍然必须存在。

## 参考

基于 Oracle Java SE Documentation 与 OpenJDK JEP 中 Java 8、Java 17、Java 21、record、sealed class、pattern matching 和 virtual threads 等相关官方内容整理。
