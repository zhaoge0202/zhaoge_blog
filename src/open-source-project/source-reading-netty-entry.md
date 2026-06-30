---
title: "读 Netty 源码应该先理解 Reactor 还是 ByteBuf？"
description: "从 Reactor 线程模型、ChannelPipeline 和 ByteBuf 讲清 Netty 阅读顺序。"
breadcrumb: true
article: true
editLink: false
category:
  - "开源项目"
tag:
  - "进阶"
  - "原理深入"
  - "体系化"
prev:
  text: "读 MyBatis 源码应该先看 Executor 还是 Mapper 代理？"
  link: "/open-source-project/source-reading-mybatis-entry.html"
next:
  text: "面试里怎么把源码阅读讲成项目能力？"
  link: "/open-source-project/source-reading-project-expression.html"
---

# 读 Netty 源码应该先理解 Reactor 还是 ByteBuf？

> Netty 阅读建议先抓 Reactor 和事件流，再看 ChannelPipeline，最后深入 ByteBuf 内存管理。

## 为什么先看 Reactor？

Netty 的核心问题是：少量线程怎么处理大量连接。

所以先理解：

- BossGroup 接收连接。
- WorkerGroup 处理读写事件。
- EventLoop 绑定 Channel。
- Selector 监听就绪事件。

这条线能和操作系统里的 epoll、Reactor 模型接上。

## ByteBuf 什么时候看？

ByteBuf 很重要，但它是数据载体和内存管理问题。如果一开始就钻引用计数、池化分配，容易失去主线。

建议顺序：

```text
Reactor -> Channel -> ChannelPipeline -> Handler -> ByteBuf
```

这样能先讲清请求怎么进来、怎么流转，再讲字节数据怎么存和释放。

## 小结

1. Netty 源码先看 Reactor 和 EventLoop，抓住高并发线程模型。
2. ChannelPipeline 解释请求处理链和业务扩展点。
3. ByteBuf 适合在理解事件流后再深入内存管理。
4. 面试里要把 Netty 和 epoll、零拷贝、Reactor 连接起来。

## 参考

基于 Spring Framework、Spring Boot、MyBatis、Netty 官方文档与公开源码中启动流程、生命周期、执行链路、Reactor 和 ByteBuf 等相关内容整理。
