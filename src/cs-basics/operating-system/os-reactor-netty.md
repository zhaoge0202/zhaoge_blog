---
title: "Reactor 模型为什么支撑 Netty？"
description: "从事件分发、主从 Reactor 和 EventLoop 讲清 Netty 的线程模型。"
breadcrumb: true
article: true
editLink: false
category:
  - "操作系统"
tag:
  - "进阶"
  - "原理深入"
  - "项目实战"
prev:
  text: "零拷贝到底少拷了什么？"
  link: "/cs-basics/operating-system/os-zero-copy.html"
next:
  text: "数据结构"
  link: "/cs-basics/data-structure/"
---

# Reactor 模型为什么支撑 Netty？

> Reactor 的本质是事件分发：少量线程监听 IO 就绪事件，再把连接、读写和业务处理组织成可扩展的流水线。

## 从一个连接一个线程说起

如果每个 TCP 连接都创建一个线程，连接数上来后会遇到三个问题：

- 线程栈占内存。
- 上下文切换变多。
- 大量线程阻塞在 `read` 上，CPU 利用率不稳定。

epoll 解决了“少量线程等待大量连接就绪”的问题，但直接写 epoll 代码很偏过程式。Reactor 模型在它上面抽象了一层：监听事件、分发事件、处理事件。

## Reactor 里有哪些角色？

可以把它拆成三类：

| 角色     | 职责                 |
| -------- | -------------------- |
| Reactor  | 等待 IO 事件并分发   |
| Acceptor | 处理新连接           |
| Handler  | 处理读、写、业务回调 |

事件来了，Reactor 不自己做完所有事，而是根据事件类型分发给对应处理器。这让网络 IO 和业务处理的边界更清晰。

## 三种常见 Reactor 模型

**单 Reactor 单线程**
一个线程负责 accept、read、write 和业务处理。实现简单，适合业务极快的场景，比如 Redis 的经典事件循环思路。

**单 Reactor 多线程**
一个 Reactor 负责 IO 事件，业务处理丢给工作线程池。问题是 Reactor 自己仍可能成为瓶颈，而且主线程和工作线程之间需要协调响应写回。

**主从 Reactor 多线程**
主 Reactor 负责接收新连接，从 Reactor 负责已连接 socket 的读写事件。多个 IO 线程分摊连接，业务耗时任务再交给业务线程池。这是 Netty 常见线程模型的基础。

## Netty 怎么落地？

Netty 里常见配置是：

- BossGroup：接收新连接，类似主 Reactor。
- WorkerGroup：处理连接上的读写事件，类似从 Reactor。
- EventLoop：一个线程绑定一个事件循环，管理一批 Channel。
- ChannelPipeline：把解码、编码、业务 handler 串成处理链。

关键点是：不要在 EventLoop 线程里做阻塞业务。比如慢 SQL、远程 RPC、大文件压缩都不应该直接占住 IO 线程，否则这个 EventLoop 管理的其他连接也会被拖慢。

## Reactor 和 Proactor 怎么区分？

Reactor 感知的是“可以读/可以写”的就绪事件，应用还要主动调用读写。Linux 高性能网络编程常用这一套。

Proactor 感知的是“读写已经完成”的完成事件，内核负责完成 IO 后再通知应用。Windows IOCP 更接近完整 Proactor。Linux 上网络 socket 的主流高性能模型仍然是 Reactor。

## 容易踩的坑

- 不能把 Reactor 简化成“就是 epoll”。epoll 是机制，Reactor 是事件分发模式。
- EventLoop 不是业务线程池，不要执行长时间阻塞任务。
- Netty 线程少不是因为连接少，而是因为连接等待 IO 的时间远大于真正处理事件的时间。
- 多 Reactor 不是越多越好，线程数通常要结合 CPU 核数和业务处理方式配置。

## 小结

- Reactor 用事件分发模型组织 IO 多路复用，让少量线程管理大量连接。
- 单 Reactor 简单但容易被业务处理拖慢。
- 主从 Reactor 把接连接和处理读写拆开，更适合高并发网络服务。
- Netty 的 BossGroup、WorkerGroup、EventLoop 是 Reactor 思路的工程化实现。
- EventLoop 线程必须避免阻塞，否则会拖慢同一事件循环上的所有连接。

## 参考

综合社区资料，并结合 Netty BossGroup、WorkerGroup、EventLoop 和 Linux 网络编程边界做了整理。
