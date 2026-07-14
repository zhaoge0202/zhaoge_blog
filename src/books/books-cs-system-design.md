---
title: "计算机基础与系统设计该怎么读书？"
description: "把网络、操作系统和系统设计书单映射到站内主线与场景题。"
breadcrumb: true
article: true
editLink: false
category:
  - "书单"
tag:
  - "基础"
  - "体系化"
prev:
  text: "数据库与中间件该怎么读书？"
  link: "/books/books-database-middleware.html"
next:
  text: "关于作者"
  link: "/about-the-author/"
---

# 计算机基础与系统设计该怎么读书？

> 基础书用来补为什么系统会这样表现，场景题用来练你会怎么取舍。

## 映射表

| 主题              | 站内先读                                                                                                                                      | 书中关注                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TCP 连接          | [三次握手](/cs-basics/network/network-tcp-three-way-handshake.html)、[TIME_WAIT](/cs-basics/network/network-tcp-four-way-wave-time-wait.html) | 状态机、队列、抓包      |
| HTTP/HTTPS        | [HTTP 版本](/cs-basics/network/network-http-versions.html)、[HTTPS](/cs-basics/network/network-https-rsa-ecdhe.html)                          | 握手、证书、性能        |
| 进程线程与 IO     | [进程线程](/cs-basics/operating-system/os-process-thread.html)、[IO 多路复用](/cs-basics/operating-system/os-io-multiplexing.html)            | 阻塞、事件驱动          |
| 内存与 Page Cache | [虚拟内存](/cs-basics/operating-system/os-virtual-memory.html)、[Page Cache](/cs-basics/operating-system/os-page-cache.html)                  | 与 Kafka/MySQL 落盘关系 |
| 设计原则与模式    | [SOLID](/system-design/basis/design-solid-principles.html)、[常用模式](/system-design/basis/design-common-patterns.html)                      | 可维护性，不堆模式      |
| 场景设计          | [秒杀](/system-design/case/design-case-seckill.html) 等 case                                                                                  | 容量、一致性、演进      |

## 建议

1. 网络 OS：只深挖后端高频路径，别做成考研复习
2. 系统设计：先写自己的方案草稿，再对照书中案例
3. 算法结构：站内最小集练手感，书用来补模板

## 小结

1. 基础书服务排障直觉。
2. 设计书服务取舍表达。
3. 场景题是检验有没有读懂的最终题。

## 参考

综合自本站计算机基础、设计基础与系统设计场景专题路径整理。
