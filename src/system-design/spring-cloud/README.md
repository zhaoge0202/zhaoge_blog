---
title: "Spring Cloud"
description: "Spring Cloud 微服务专题，覆盖组件定位、Feign 调用链、负载均衡、网关、Sentinel、Nacos、Seata 与链路追踪。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "MyBatis 插件机制和分页插件怎么工作？"
  link: "/system-design/framework/mybatis-plugin-pagination-mechanism.html"
next:
  text: "Spring Cloud 解决的是什么问题？和 Dubbo、K8s 的边界在哪？"
  link: "/system-design/spring-cloud/spring-cloud-architecture-positioning.html"
---

# Spring Cloud

## 为什么重要

微服务面试的分水岭不在"能不能背出组件名"，而在**知不知道自己配的那几个参数会在什么情况下把系统打挂**：超时默认值太大导致线程堆死、三层重试叠加把下游放大十几倍、网关过滤器里写了阻塞调用拖垮整个入口、改了配置却不生效、全局事务回滚不干净。

这一栏按"一次请求怎么走完整个微服务链路"来组织：先看清 Spring Cloud 的定位，再顺着调用链往下走——服务发现之后怎么选实例、入口网关怎么转发、流量超了怎么挡、配置怎么热更新、跨库事务怎么兜、最后 traceId 怎么把这一串串起来。

站内 [分布式](/distributed-system/) 专题讲的是这些能力的**通用原理与选型**（注册中心、配置中心、网关职责、分布式事务方案），[高可用](/high-availability/) 专题讲限流熔断的算法与治理。这一栏讲的是**Spring Cloud 这套具体实现怎么落地、参数怎么配、坑在哪里**，两边互为上下游，不重复。

## 知识主线

```text
定位与选型（是什么、和 Dubbo/K8s 的边界）
  → 调用链（OpenFeign 代理 → 超时 → 重试放大）
  → 选实例（LoadBalancer 的装饰器链与缓存）
  → 入口（Spring Cloud Gateway 的过滤器与线程模型）
  → 流量防护（Sentinel 的槽链、滑动窗口与规则）
  → 配置与事务（Nacos 刷新链路、Seata 的补偿边界）
  → 观测（traceId 跨服务跨线程传播）
```

## 题目列表

### 定位与选型

- [Spring Cloud 解决的是什么问题？和 Dubbo、K8s 的边界在哪？](./spring-cloud-architecture-positioning.html) — 组件集合与抽象层、版本对齐、与 Dubbo/K8s 谁管什么。

### 调用链与流量治理

- [OpenFeign 一次调用经过了哪些环节？超时和重试为什么总配错？](./spring-cloud-openfeign-call-chain.html) — 动态代理、请求模板、超时预算倒挂与三层重试的放大倍数。
- [LoadBalancer 怎么挑实例？缓存、健康检查和同可用区优先怎么算？](./spring-cloud-loadbalancer-strategy.html) — 装饰器链、选择器、缓存分层，以及"扩容没流量"的排查顺序。
- [Spring Cloud Gateway 的路由和过滤器怎么工作？限流该落在哪一层？](./spring-cloud-gateway-filter-limit.html) — 断言匹配、过滤器排序、Netty 线程模型与 Redis 令牌桶限流。
- [Sentinel 的流控和熔断在内核里怎么算？和 Hystrix 差在哪？](./spring-cloud-sentinel-flow-circuit.html) — 槽链、滑动窗口统计、规则模型与推模式持久化。

### 配置、事务与观测

- [Nacos 配置动态刷新为什么有时候不生效？](./spring-cloud-nacos-config-refresh.html) — Environment 重建、配置属性重绑定、RefreshScope 的副作用与排查清单。
- [Seata 的 AT 和 TCC 差在哪？什么时候会回滚不干净？](./spring-cloud-seata-at-tcc.html) — undo_log 镜像、全局锁、空回滚与悬挂，以及"什么时候不该用分布式事务"。
- [跨服务调用的 traceId 怎么串起来？断链了去哪查？](./spring-cloud-observability-trace.html) — 传播载体、自动埋点覆盖面、线程池与 MQ 断链的六大根因。

## 怎么用这一栏

1. **先读定位篇**，把"Spring Cloud 是规范 + 实现集合"这句话立住，再去看具体组件，否则容易被组件名牵着走。
2. **每篇都盯住"会挂在哪里"**：超时、重试、缓存、阻塞、规则持久化、事务边界，这些是线上事故的固定来源，也是面试追问的落点。
3. **能画出链路再开口**：网关 → 服务 → 下游，每一跳的耗时、重试次数、trace 是否连续，都能在纸上画出来，才算真的懂。
