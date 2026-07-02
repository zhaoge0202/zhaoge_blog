---
title: "RPC"
article: false
breadcrumb: true
editLink: false
prev:
  text: "分布式事务怎么选：2PC、TCC、Saga、本地消息表？"
  link: "/distributed-system/distributed-transaction-selection.html"
next:
  text: "RPC 一次调用经历了哪些步骤？"
  link: "/distributed-system/rpc/rpc-call-flow.html"
---

# RPC

## 为什么重要

微服务之间怎么像调本地方法一样调远程服务，是分布式架构的基础设施，也是 Dubbo / gRPC 这类框架的核心。

## 知识主线

调用模型 -> 序列化 -> 网络传输 -> 服务治理

## 当前重点文章

- [RPC 一次调用经历了哪些步骤？](./rpc-call-flow.html) — 从代理、服务发现、负载均衡、编解码到响应回包讲清一次调用的完整主线。
- [Dubbo 的注册发现、负载均衡和容错怎么配合？](./dubbo-discovery-loadbalance-faulttolerance.html) — 从 `Directory`、路由、负载均衡和 cluster 容错层看一次 Dubbo 调用如何收口。

## 后续计划

- 序列化协议对比（Hessian、Protobuf、JSON）。
- gRPC、Thrift 等框架选型。
