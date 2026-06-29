---
title: "select、poll、epoll 的区别是什么？"
description: "从文件描述符集合、就绪事件和触发模式讲清 IO 多路复用。"
breadcrumb: true
article: true
editLink: false
category:
  - "操作系统"
tag:
  - "高频"
  - "原理深入"
  - "必会"
prev:
  text: "Page Cache 是什么？为什么写文件不一定马上落盘？"
  link: "/cs-basics/operating-system/os-page-cache.html"
next:
  text: "零拷贝到底少拷了什么？"
  link: "/cs-basics/operating-system/os-zero-copy.html"
---

# select、poll、epoll 的区别是什么？

> IO 多路复用让少量线程等待大量 socket 的就绪事件，关键差别在于“怎么告诉内核关注谁”和“怎么拿到已就绪的谁”。

## 为什么需要 IO 多路复用？

最朴素的服务端模型是一个连接一个线程。连接少时简单，连接上万后，线程栈、上下文切换和调度队列都会压垮系统。

IO 多路复用的思路是：把很多 socket 注册给内核，让一个线程阻塞在 `select/poll/epoll_wait` 上。哪个 socket 可读、可写，内核通知应用，应用再处理对应事件。

它解决的是“等 IO”这件事，不等于业务处理也必须单线程。Netty、Nginx、Redis 都在这个基础上做了不同的事件模型。

## select 和 poll 为什么不够好？

`select` 每次调用都要把关注的文件描述符集合传给内核，内核遍历检查，再把结果返回。用户态还要再遍历一遍找就绪项。

它的问题有：

- 文件描述符数量通常受 `FD_SETSIZE` 限制。
- 每次调用都要拷贝集合。
- 内核和用户态都要线性扫描。

`poll` 用数组描述文件描述符，突破了 `select` 的固定 bitmap 限制，但核心仍然是每次传入一批 fd，内核线性扫描，再返回结果。

## epoll 改进在哪里？

`epoll` 把“注册关注对象”和“等待就绪事件”拆开：

- `epoll_ctl`：增删改要关注的 fd。
- `epoll_wait`：等待并返回已经就绪的事件。

内核维护关注集合和就绪队列。应用不用每次把全部 fd 传进去，也不用每次扫描全部连接，只处理就绪事件。

对大量连接但活跃连接较少的场景，`epoll` 的优势非常明显。这也是高并发网络服务在 Linux 上普遍使用 epoll 的原因。

## LT 和 ET 怎么理解？

epoll 支持两种触发模式：

| 模式        | 行为                         | 编程要求                               |
| ----------- | ---------------------------- | -------------------------------------- |
| LT 水平触发 | 只要条件还满足，就会反复通知 | 编程更简单                             |
| ET 边缘触发 | 状态变化时通知一次           | 必须配合非阻塞 IO，循环读写到 `EAGAIN` |

举例：socket 接收缓冲区里有数据。LT 模式下，只要你没读完，`epoll_wait` 还会继续提醒；ET 模式下，数据从无到有时提醒一次，如果你没一次读干净，后续可能不再提醒。

所以 ET 更容易减少通知次数，但也更容易写出 bug。

## 和 Java/Netty 怎么连接？

Java NIO 的 `Selector` 在 Linux 上底层通常会使用 epoll。Netty 的 `EpollEventLoopGroup` 则直接使用 Linux epoll 能力，适合 Linux 生产环境。

常见排障点：

- 连接数上不去，先看文件描述符限制：`ulimit -n`。
- EventLoop 线程被业务逻辑阻塞，会导致它负责的连接都延迟。
- 使用 ET 时必须非阻塞读写到 `EAGAIN`，否则会丢事件感知。

## 小结

- IO 多路复用让少量线程等待大量 fd 的就绪事件。
- `select` 有 fd 数量限制，且每次需要拷贝和扫描集合。
- `poll` 放宽数量表达，但仍然线性扫描。
- `epoll` 拆分注册和等待，用就绪队列减少无效扫描。
- epoll ET 模式通常要配合非阻塞 IO，并循环读写到 `EAGAIN`。

## 参考

综合社区资料，并结合 Java NIO、Netty epoll 与 Linux fd 排障场景做了改写。
