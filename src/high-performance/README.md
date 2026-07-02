---
title: "高性能"
description: "高性能专题，讲系统变慢、流量变大时如何定位瓶颈、如何排定优化优先级。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "Dubbo 的注册发现、负载均衡和容错怎么配合？"
  link: "/distributed-system/rpc/dubbo-discovery-loadbalance-faulttolerance.html"
next:
  text: "系统性能瓶颈应该怎么定位？"
  link: "/high-performance/high-performance-bottleneck-analysis.html"
---

# 高性能

## 为什么重要

高性能不是“会背缓存、分库分表、消息队列”这几个词，而是当系统变慢、流量变大、数据库扛不住时，知道瓶颈到底在哪一层，先做什么、后做什么。

这类题在面试里特别容易从场景切进来：

- 为什么接口 P99 突然变高
- 为什么慢 SQL 优化完了系统还是扛不住
- 为什么读写分离后反而查到旧数据
- 为什么上了 MQ 之后系统没有更稳，反而更复杂

所以高性能专题真正要补的是“定位路径”和“取舍能力”，不是单个组件百科。

## 知识主线

瓶颈定位 -> SQL 与访问路径优化 -> 读写分离 -> 分库分表 -> MQ 异步 / 削峰 / 解耦 -> 可靠性 / 幂等 / 积压治理

## 怎么读这个专题

建议按“先找瓶颈，再决定方案”的顺序读：

1. 先看系统瓶颈怎么定位，避免一上来就拍脑袋说“上缓存、上分库分表”。
2. 再看 SQL、深分页、索引优化，补齐数据库性能排查主线。
3. 然后看读写分离和分库分表，理解为什么容量扩展会把一致性和查询复杂度一起带上来。
4. 最后看消息队列，重点不是会不会用，而是知道它解决什么问题，又引入什么问题。

## 面试焦点

不是单点知识，而是能把下面几条线串起来：

- 系统慢，到底慢在入口、应用、缓存、数据库，还是消息链路
- 为什么慢 SQL、深分页、索引失效要放在同一条排查链里
- 为什么读写分离和分库分表不只是“扩容动作”，还会引入一致性和事务复杂度
- 为什么 MQ 可以削峰，但也会带来丢消息、重复消费、消息积压和顺序问题

## 前置知识

MySQL 索引与事务基础、Redis 缓存基础、RPC / 分布式基础。

## 目标人群

3-5 年 Java 后端工程师。

## 子模块

### 1. 性能定位与 SQL 排查

- 系统性能瓶颈怎么分层定位
- 慢 SQL、索引、深分页怎么串成同一条排查链

### 2. 数据库扩展与一致性

- 读写分离适合什么场景，会带来哪些一致性问题
- 分库分表之后，查询、事务、扩容和迁移会复杂在哪里

### 3. 消息队列与异步链路

- MQ 解决了什么问题
- 可靠性、幂等、积压和选型该怎么答

### 4. 后续扩展

- 负载均衡、CDN、冷热数据分离、流量入口治理

## 题目列表

### 性能定位与 SQL 排查

- [系统性能瓶颈应该怎么定位？](./high-performance-bottleneck-analysis.html) - 从入口到数据库、MQ、下游，先把证据链走对。
- [慢 SQL、深分页、索引优化如何串成排查链路？](./high-performance-sql-optimization-chain.html) - 不把这三个点串起来，高性能题很容易答散。

### 数据库扩展与一致性

- [读写分离会带来哪些一致性问题？](./high-performance-read-write-splitting-consistency.html) - 重点不是“怎么路由”，而是写后读一致性和主从延迟边界。
- [分库分表之后查询、事务、扩容会变复杂在哪里？](./high-performance-sharding-tradeoffs.html) - 这题答得好不好，能直接看出你是不是只会喊口号。

### 消息队列与异步链路

- [消息队列解决了什么问题？又引入了什么问题？](./high-performance-message-queue-role.html) - 先讲收益，再讲代价，才像真实工程判断。
- [MQ 如何保证消息不丢？](./high-performance-message-reliability.html) - 可靠性要按生产者、Broker、消费者三段拆开讲。
- [MQ 如何处理重复消费和幂等？](./high-performance-message-idempotency.html) - 和高可用里的幂等设计是同一条线，但这里更偏消息语义。
- [MQ 消息积压怎么排查？](./high-performance-message-backlog.html) - 真到线上，最忌讳只会说“加消费者”。
- [Kafka、RocketMQ、RabbitMQ 怎么选？](./high-performance-mq-selection.html) - 技术选型题常见收口点。

## 后续计划

- 负载均衡和请求分发。
- CDN 与静态资源加速。
- 冷热数据分离与归档策略。
- 高性能和高可用联动的容量治理。
