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
- 服务治理：注册发现、配置中心、API 网关、灰度发布。

## 当前重点文章

### 一致性与协调

- [CAP 和 BASE 怎么理解？为什么不是简单三选二？](./distributed-cap-base.html)
- [Raft 解决了什么问题？为什么比 Paxos 更容易落地？](./distributed-raft-overview.html)
- [ZooKeeper 和 ZAB 是什么关系？](./distributed-zookeeper-zab.html)
- [分布式锁有哪些实现？Redis 锁的边界在哪里？](./distributed-lock-implementations.html)
- [分布式 ID 怎么选：雪花、号段、数据库自增？](./distributed-id-selection.html)
- [分布式事务怎么选：2PC、TCC、Saga、本地消息表？](./distributed-transaction-selection.html)

### RPC

- [RPC 一次调用经历了哪些步骤？](./rpc/rpc-call-flow.html)
- [Dubbo 的注册发现、负载均衡和容错怎么配合？](./rpc/dubbo-discovery-loadbalance-faulttolerance.html)

### 服务治理

- [服务注册发现解决什么问题？心跳、摘除、保护阈值怎么设计？](./distributed-service-discovery.html)
- [配置中心解决什么问题？动态推送、灰度、回滚怎么做？](./distributed-config-center.html)
- [API 网关做了什么？鉴权、限流、路由为什么放在入口？](./distributed-api-gateway.html)
- [灰度发布、金丝雀和蓝绿怎么落地？](./distributed-gray-release.html)

## 后续计划

- 可观测性：日志、指标、链路追踪怎么分工。
- 服务网格与超时、重试、熔断的放置层级。
