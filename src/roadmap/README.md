---
title: "学习路线"
description: "把拾级知识库按 3-5 年 Java 后端面试节奏串成可执行路线。"
article: false
breadcrumb: true
editLink: false
next:
  text: "3-5 年 Java 后端四周怎么复习？"
  link: "/interview-preparation/interview-prep-four-week-plan.html"
---

# 学习路线

这份路线服务一个目标：**3-5 年 Java 后端面试能讲清原理、边界和项目取舍**。不是把所有文章读完，而是按主线推进。

## 总览

```text
面试准备（节奏）
  → Java 并发/JVM/集合
  → MySQL/Redis
  → 分布式治理 + MQ + 高可用/可观测
  → Spring/安全/设计基础
  → 系统设计场景
  → 算法数据结构补强
  → 工具链与复盘
```

## 1. 先定节奏

- [四周复习计划](/interview-preparation/interview-prep-four-week-plan.html)
- [项目 STAR](/interview-preparation/interview-prep-project-star.html)
- [高频追问树](/interview-preparation/interview-prep-followup-trees.html)
- [容易答飘的点](/interview-preparation/interview-prep-common-traps.html)

## 2. 语言与运行时

- [Java 专区](/java/)：并发、JVM、集合优先
- 必打透：线程池、锁、JMM、G1/OOM 排查

## 3. 数据层

- [MySQL](/database/mysql/)：索引、事务、锁、日志、复制
- [Redis](/database/redis/)：结构、持久化、缓存一致性、集群
- [SQL](/database/sql/)：会写会优化

## 4. 分布式与稳定性

- [分布式](/distributed-system/)：CAP、锁、事务、注册配置、网关灰度
- [高性能](/high-performance/)：瓶颈、分库分表、MQ、多级缓存、容量
- [高可用](/high-availability/)：限流熔断、幂等、容灾、可观测诊断

## 5. 工程与设计

- [框架](/system-design/framework/)：Spring / MyBatis
- [安全](/system-design/security/)：认证授权、JWT、RBAC
- [设计基础](/system-design/basis/)：SOLID、模式、接口、分层
- [系统设计场景](/system-design/case/)：秒杀、短链、订单、Feed、调度、热 key

## 6. 基本功与工具

- [网络 / OS](/cs-basics/)
- [数据结构](/cs-basics/data-structure/) / [算法](/cs-basics/algorithms/)：最小可上机集
- [工具实践](/tools/)：Docker / Git / Maven / Gradle

## 7. 书单怎么用

不要从第一页硬啃。按主题回链：

- [Java/JVM/并发书单](/books/books-java-jvm-concurrency.html)
- [数据库与中间件书单](/books/books-database-middleware.html)
- [计算机基础与系统设计书单](/books/books-cs-system-design.html)

读一章，就回到站内对应专题做口述，比“读完再复习”有效。

## 完成标准（可自检）

1. 能用 STAR 讲 2 个项目，带指标和代价
2. 线程池 / MVCC / 缓存一致性 / MQ 不丢不重 能追问到第 3 层
3. 能画一条下单链路：网关 → 服务 → 缓存/DB → MQ → 观测
4. 能独立做一次慢请求或 CPU 飙高的证据链排查
5. 至少讲清楚一个系统设计场景的取舍

## 不建议的路径

- 从冷门边角 API 开始刷
- 只收藏不口述
- 跳过项目故事只背八股
- 未做幂等就大谈重试与高可用
