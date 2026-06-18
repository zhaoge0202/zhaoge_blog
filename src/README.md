---
home: true
title: "Java 面试进阶指南"
description: "面向 3-5 年 Java 后端工程师的面试进阶知识站，围绕并发、JVM、MySQL、Redis、系统设计、项目表达和复盘纠偏组织内容。"
heroText: "Java 面试进阶指南"
tagline: "面向 3-5 年后端工程师，把高频题、底层原理、项目表达和复盘纠偏整理成可持续阅读的知识体系。"
actions:
  - text: "开始复习"
    link: "#面试准备"
    type: "primary"
  - text: "进入题库"
    link: "/questions/"
    type: "default"
highlights:
  - header: "先建立主线，再进入专题"
    description: "首页不只放文章列表，而是把面试准备、核心专题、项目表达和复盘路径组织成一个入口页。"
    features:
      - title: "面试准备"
        details: "明确复习顺序、题目优先级和表达目标，避免只背零散八股。"
        link: "#面试准备"
      - title: "Java 核心"
        details: "围绕并发、JVM、集合、基础语义等高频题建立可追问的解释链。"
        link: "#java-核心"
      - title: "数据库与缓存"
        details: "重点覆盖 MySQL 事务、索引、MVCC、Redis 缓存一致性和工程取舍。"
        link: "#数据库与缓存"
      - title: "系统设计"
        details: "用场景题串起高并发、高可用、缓存、消息队列和架构演进。"
        link: "#系统设计与项目表达"
      - title: "项目表达"
        details: "把技术点转成面试里能讲清楚的业务背景、方案权衡和排障结果。"
        link: "#系统设计与项目表达"
      - title: "复盘纠偏"
        details: "记录容易混淆、容易被追问和资料之间存在冲突的地方。"
        link: "/journey/"
---

<div class="home-entry-grid">
  <section class="home-entry-card home-entry-card--primary">
    <p class="home-entry-kicker">核心入口</p>
    <h2>后端面试主线</h2>
    <p>从准备路径进入，再按专题补齐原理、题目和项目表达。目标不是堆资料，而是把每个高频点讲成可追问、可落地的答案。</p>
    <div class="home-entry-actions">
      <a href="#面试准备">查看准备路径</a>
      <a href="/questions/">浏览高频题</a>
    </div>
  </section>
  <section class="home-entry-card">
    <p class="home-entry-kicker">当前覆盖</p>
    <h2>4 个核心专题</h2>
    <p>并发、JVM、MySQL、Redis 先作为第一批核心内容，后续再补 Spring、消息队列、系统设计和项目专题。</p>
  </section>
  <section class="home-entry-card">
    <p class="home-entry-kicker">内容标准</p>
    <h2>纠偏优先</h2>
    <p>同一个问题会尽量说明概念边界、常见误区、项目讲法和追问方向，而不是只给一段标准答案。</p>
  </section>
</div>

## 面试准备

- **复习顺序**：[专题总览](./topics/) -> [高频题库](./questions/) -> [复盘记录](./journey/)。先建立知识地图，再刷题，最后补表达和纠偏。
- **题目优先级**：先看能连接项目经验的题，比如线程池参数、G1 与 CMS、MVCC、缓存一致性。
- **回答目标**：每道题至少讲清楚概念、核心流程、适用场景、常见坑和项目里的取舍。
- **复盘方式**：记录资料冲突、自己讲不顺的点、面试官可能继续追问的方向。

## Java 核心

### 并发

**当前重点**：

- [线程池 7 个参数怎么理解？](./questions/java-concurrency/java-concurrency-thread-pool.html)
- [并发专题入口](./topics/java-concurrency/)

**后续补充方向**：

- AQS、ReentrantLock、synchronized、volatile、JMM、ThreadLocal、CompletableFuture。
- 线程池隔离、队列选择、拒绝策略、线上压测和故障排查。

### JVM

**当前重点**：

- [G1 相比 CMS 改进了什么？](./questions/jvm/jvm-g1-vs-cms.html)
- [JVM 专题入口](./topics/jvm/)

**后续补充方向**：

- 内存区域、对象生命周期、类加载、垃圾回收日志、常用 JVM 参数和线上排查工具。

## 数据库与缓存

### MySQL

**当前重点**：

- [MVCC 和 ReadView 是怎么工作的？](./questions/mysql/mysql-mvcc-read-view.html)
- [MySQL 专题入口](./topics/mysql/)

**后续补充方向**：

- 索引结构、事务隔离级别、锁、redo log、binlog、undo log、执行计划和慢 SQL 排查。

### Redis

**当前重点**：

- [如何保证缓存和数据库一致性？](./questions/redis/redis-cache-consistency.html)
- [Redis 专题入口](./topics/redis/)

**后续补充方向**：

- 缓存穿透、击穿、雪崩、热 key、大 key、持久化、主从复制、集群和分布式锁。

## 系统设计与项目表达

- **高并发场景**：限流、降级、熔断、缓存、异步化和容量评估。
- **高可用场景**：多副本、故障转移、超时重试、幂等和数据一致性。
- **项目表达**：业务背景、原问题、备选方案、最终选择、上线效果和复盘指标。
- **排障表达**：现象、监控、定位路径、根因、修复动作和防复发机制。

## 精选题目

<div class="question-radar">
  <a href="./questions/java-concurrency/java-concurrency-thread-pool.html">
    <span>并发</span>
    <strong>线程池 7 个参数怎么理解？</strong>
    <em>参数、队列、拒绝策略、项目调优</em>
  </a>
  <a href="./questions/jvm/jvm-g1-vs-cms.html">
    <span>JVM</span>
    <strong>G1 相比 CMS 改进了什么？</strong>
    <em>分区、停顿预测、并发标记、适用场景</em>
  </a>
  <a href="./questions/mysql/mysql-mvcc-read-view.html">
    <span>MySQL</span>
    <strong>MVCC 和 ReadView 是怎么工作的？</strong>
    <em>事务隔离、版本链、可见性判断</em>
  </a>
  <a href="./questions/redis/redis-cache-consistency.html">
    <span>Redis</span>
    <strong>如何保证缓存和数据库一致性？</strong>
    <em>延迟双删、旁路缓存、最终一致性</em>
  </a>
</div>

## 最近复盘

- [从资料汇总转向内容纠偏](./journey/2026-06-16-note-1.html)：这个站点的价值不是简单聚合资料，而是筛选、纠错、解释取舍并沉淀自己的判断。
