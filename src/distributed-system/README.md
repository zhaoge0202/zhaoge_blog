---
title: "分布式"
description: "分布式知识域入口，讲服务拆分、调用、协调与一致性，覆盖单机扛不住之后的进阶主线。"
article: false
breadcrumb: true
editLink: false
next:
  text: "CAP 和 BASE 怎么理解？为什么不是简单三选二？"
  link: "/distributed-system/distributed-cap-base.html"
---

# 分布式

单机扛不住之后的所有问题：服务怎么拆、怎么调、怎么协调、怎么保证一致性。3-5 年后端绕不开的进阶主线。

## 子域

- [分布式基础](./distributed-cap-base.html)：CAP、BASE、一致性协议、分布式锁、分布式 ID 和分布式事务，决定后面所有一致性与可用性取舍怎么谈。
- [RPC](./rpc/)：远程调用原理、序列化、常见框架。

## 当前重点文章

- [CAP 和 BASE 怎么理解？为什么不是简单三选二？](./distributed-cap-base.html)
- [Raft 解决了什么问题？为什么比 Paxos 更容易落地？](./distributed-raft-overview.html)
- [ZooKeeper 和 ZAB 是什么关系？](./distributed-zookeeper-zab.html)
- [分布式锁有哪些实现？Redis 锁的边界在哪里？](./distributed-lock-implementations.html)
- [分布式 ID 怎么选：雪花、号段、数据库自增？](./distributed-id-selection.html)
- [分布式事务怎么选：2PC、TCC、Saga、本地消息表？](./distributed-transaction-selection.html)
- [RPC 一次调用经历了哪些步骤？](./rpc/rpc-call-flow.html)
- [Dubbo 的注册发现、负载均衡和容错怎么配合？](./rpc/dubbo-discovery-loadbalance-faulttolerance.html)

## 后续计划

- 服务注册发现、配置中心、API 网关。
- ZooKeeper、一致性协议（Paxos / Raft / ZAB）。
