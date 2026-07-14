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

单机扛不住之后的所有问题：服务怎么拆、怎么调、怎么协调、怎么保证一致性。

## 当前重点

### 一致性与协调

- [CAP 和 BASE](./distributed-cap-base.html)
- [Raft](./distributed-raft-overview.html)
- [ZooKeeper/ZAB](./distributed-zookeeper-zab.html)
- [分布式锁](./distributed-lock-implementations.html)
- [分布式 ID](./distributed-id-selection.html)
- [分布式事务](./distributed-transaction-selection.html)

### RPC

- [RPC 调用流程](./rpc/rpc-call-flow.html)
- [Dubbo 治理](./rpc/dubbo-discovery-loadbalance-faulttolerance.html)

### 服务治理

- [服务注册发现](./distributed-service-discovery.html)
- [配置中心](./distributed-config-center.html)
- [API 网关](./distributed-api-gateway.html)
- [灰度发布](./distributed-gray-release.html)
- [超时重试熔断放哪一层](./distributed-service-mesh-placement.html)
