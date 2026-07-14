---
title: "高可用"
description: "高可用专题，讲故障时核心链路如何顶住、如何防扩散、如何快速恢复。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "顺序消息怎么保证？分区顺序和全局顺序差在哪？"
  link: "/high-performance/high-performance-message-ordering.html"
next:
  text: "SLA、几个 9、RTO、RPO 到底是什么意思？"
  link: "/high-availability/high-availability-sla-rto-rpo.html"
---

# 高可用

## 为什么重要

高可用不是“从来不出故障”，而是系统出故障时，核心链路还能不能顶住、故障会不会扩散、恢复能不能够快。

后端面试里，很多设计题最后都会落到这一层：

- 流量突然冲高了怎么办
- 下游接口超时了怎么办
- 第三方重复回调怎么办
- 一个机房挂了怎么办

如果只能回答“加机器、加缓存、加 MQ”，但说不清限流、熔断、重试、幂等、容灾这些动作分别在保护什么，基本就会被继续追问。

## 知识主线

可用性目标与指标 -> 限流 -> 熔断 / 降级 / 隔离 -> 超时重试 -> 幂等 -> 容灾与故障转移 -> 压测与容量验证

## 怎么读这个专题

建议按“先定义目标，再设计保护，再验证效果”的顺序读：

1. 先看 `SLA / RTO / RPO`，搞清楚高可用到底在量化什么。
2. 再看限流、熔断、降级、超时、重试，理解故障发生时怎么止血。
3. 接着看幂等，把“重复请求”和“重复消费”这类高频事故点补齐。
4. 最后看容灾和压测，知道方案设计完之后怎么验证它真的能扛。

## 面试焦点

不是背概念，而是把下面这些问题讲成一条闭环：

- 业务要几个 9，意味着多大的停机预算
- 流量过高时先限流、先降级还是先熔断
- 为什么重试可能把故障放大
- 为什么幂等不只是“前端按钮防重复点击”
- 容灾和多活到底是在解决可用性还是一致性

## 前置知识

HTTP/RPC 调用基础、Redis/消息队列基础、数据库事务基础。

## 目标人群

3-5 年 Java 后端工程师。

## 子模块

### 1. 可用性目标

- SLA、几个 9、RTO、RPO 到底在约束什么

### 2. 稳定性治理

- 限流、隔离、超时、重试、熔断、降级怎么组合
- 哪些保护动作在入口做，哪些保护动作在调用方做

### 3. 幂等与重复请求

- 接口幂等怎么设计
- 支付回调、消息重复消费怎么落幂等

### 4. 容灾与验证

- 冗余、灾备、多活、故障转移的边界
- 压测、容量评估和故障演练怎么配合

## 题目列表

### 可用性目标

- [SLA、几个 9、RTO、RPO 到底是什么意思？](./high-availability-sla-rto-rpo.html) - 把可用性目标、停机预算和容灾指标放到一张图里。

### 稳定性治理

- [限流算法怎么选：固定窗口、滑动窗口、漏桶、令牌桶？](./high-availability-rate-limiting.html) - 不是背算法名，而是看你要保护谁、允许不允许突发流量。
- [熔断、降级、隔离、超时、重试怎么组合？](./high-availability-resilience-composition.html) - 把几种保护动作放回一次真实调用链里。
- [重试为什么可能放大故障？](./high-availability-retry-storm.html) - 高可用题里最容易答成“会重试就行”的反例。

### 幂等与重复请求

- [接口幂等怎么设计？](./high-availability-idempotency-design.html) - 从业务唯一键、状态机、去重表讲到锁的边界。
- [支付回调和消息重复消费怎么做幂等？](./high-availability-idempotency-cases.html) - 两个最常见的重复执行事故场景。

### 容灾与验证

- [容灾、多活、故障转移分别解决什么问题？](./high-availability-disaster-recovery.html) - 别把“多部署几台”误答成完整容灾方案。
- [压测应该测什么？容量评估怎么做？](./high-availability-performance-testing.html) - 高可用设计最后一定要回到验证。

### 可观测与诊断

- [日志、指标、链路追踪怎么分工？](./high-availability-observability-pillars.html) - 三支柱各自回答什么问题。
- [一次慢请求从网关到数据库怎么定位？](./high-availability-slow-request-tracing.html) - 分层切延迟，用证据链下钻。
- [后端该埋哪些 RED/USE 指标？](./high-availability-metrics-red-use.html) - 请求指标、资源指标和业务指标怎么配。
- [Arthas 怎么做线上诊断？](./high-availability-arthas-diagnostics.html) - watch/trace/profiler 与生产风险边界。
- [线程飙高、CPU 打满、死锁怎么标准排查？](./high-availability-thread-cpu-troubleshooting.html) - 分类取样的标准作业。
