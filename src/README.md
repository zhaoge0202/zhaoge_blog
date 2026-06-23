---
home: true
title: "Java 面试进阶指南"
description: "面向 3-5 年 Java 后端工程师的进阶知识库，按 Java、计算机基础、数据库、系统设计与工具实践组织内容，并保留独立博客记录实战与随笔。"
heroText: "Java 面试进阶指南"
tagline: "不是把资料一股脑堆上来，而是按知识域整理主线，再把实战、复盘和随笔单独沉淀。"
actions:
  - text: "开始复习"
    link: "/interview-preparation/"
    type: "primary"
  - text: "进入博客"
    link: "/blog/"
    type: "default"
highlights:
  - header: "先分知识域，再进入文章"
    description: "主线入口不再按专题 / 题库拆开，而是直接按 Java、计算机基础、数据库、系统设计和工具实践组织。"
    features:
      - title: "面试准备"
        details: "先看复习顺序、回答目标和纠偏方法，再进入具体知识域。"
        link: "/interview-preparation/"
      - title: "Java"
        details: "围绕并发和 JVM 建立 Java 主线，后续再补基础、集合、IO 和新特性。"
        link: "/java/"
      - title: "计算机基础"
        details: "操作系统、计算机网络、数据结构与算法，撑起后端面试的底层功底。"
        link: "/cs-basics/"
      - title: "数据库"
        details: "先把 MySQL 和 Redis 讲透，再外扩到 SQL、ES 和 MongoDB。"
        link: "/database/"
      - title: "系统设计"
        details: "系统设计为主线，串联分布式、高性能、高可用的场景题表达。"
        link: "/system-design/"
      - title: "工具实践"
        details: "把工具链、写作流和工程小实践从知识库主线里单独分离出来。"
        link: "/tools/"
      - title: "AI 应用开发"
        details: "后端工程师怎么把大模型和 AI 编程接进业务，作为知识库的外延方向。"
        link: "/ai/"
      - title: "博客"
        details: "单独保留实战记录、随笔和复盘，不再和知识库栏目混成一团。"
        link: "/blog/"
---

<div class="home-entry-grid">
  <section class="home-entry-card home-entry-card--primary">
    <p class="home-entry-kicker">核心入口</p>
    <h2>知识库主线 + 博客支线</h2>
    <p>先按面试准备、Java、数据库这些知识域建立主线，再把实战、复盘和随笔沉淀到博客。目标不是堆资料，而是把高频点讲成可追问、可落地的答案。</p>
    <div class="home-entry-actions">
      <a href="/interview-preparation/">查看准备路径</a>
      <a href="/blog/">浏览博客</a>
    </div>
  </section>
  <section class="home-entry-card">
    <p class="home-entry-kicker">当前覆盖</p>
    <h2>4 篇核心知识文章</h2>
    <p>并发、JVM、MySQL、Redis 先作为第一批核心内容，先把这四条主线讲透，再继续外扩到系统设计和更多基础域。</p>
  </section>
  <section class="home-entry-card">
    <p class="home-entry-kicker">内容标准</p>
    <h2>纠偏优先</h2>
    <p>同一个问题会尽量说明概念边界、常见误区、项目讲法和追问方向，而不是只给一段标准答案。</p>
  </section>
</div>

## 面试准备

- **复习顺序**：[面试准备](./interview-preparation/) -> [Java](./java/) / [数据库](./database/) -> [博客](./blog/)。先建立知识地图，再刷核心文章，最后补表达和纠偏。
- **题目优先级**：先看能连接项目经验的题，比如线程池参数、G1 与 CMS、MVCC、缓存一致性。
- **回答目标**：每道题至少讲清楚概念、核心流程、适用场景、常见坑和项目里的取舍。
- **复盘方式**：记录资料冲突、自己讲不顺的点、面试官可能继续追问的方向。

## Java

### 并发

**当前重点**：

- [线程池 7 个参数怎么理解？](./java/concurrent/java-concurrency-thread-pool.html)
- [并发入口页](./java/concurrent/)

**后续补充方向**：

- AQS、ReentrantLock、synchronized、volatile、JMM、ThreadLocal、CompletableFuture。
- 线程池隔离、队列选择、拒绝策略、线上压测和故障排查。

### JVM

**当前重点**：

- [G1 相比 CMS 改进了什么？](./java/jvm/jvm-g1-vs-cms.html)
- [JVM 入口页](./java/jvm/)

**后续补充方向**：

- 内存区域、对象生命周期、类加载、垃圾回收日志、常用 JVM 参数和线上排查工具。

## 数据库与缓存

### MySQL

**当前重点**：

- [MVCC 和 ReadView 是怎么工作的？](./database/mysql/mysql-mvcc-read-view.html)
- [MySQL 入口页](./database/mysql/)

**后续补充方向**：

- 索引结构、事务隔离级别、锁、redo log、binlog、undo log、执行计划和慢 SQL 排查。

### Redis

**当前重点**：

- [Redis 常见数据类型怎么选？](./database/redis/redis-data-structures.html)
- [RDB、AOF 和混合持久化怎么选？](./database/redis/redis-persistence.html)
- [Redis 的大 key 和热 key 怎么发现和处理？](./database/redis/redis-bigkey-hotkey.html)
- [Redis 卡顿了该从哪里开始排查？](./database/redis/redis-blocking-troubleshooting.html)
- [缓存雪崩、击穿、穿透怎么治理？](./database/redis/redis-cache-problems.html)
- [如何保证缓存和数据库一致性？](./database/redis/redis-cache-consistency.html)
- [Redis 入口页](./database/redis/)

**后续补充方向**：

- Redis Cluster 工程细节、Pipeline/Lua、布隆过滤器、排行榜/计数器专题，以及更偏实战的运维治理。

## 系统设计与后端进阶

- **系统设计**：[系统设计入口](./system-design/) 承载框架、设计模式、安全和场景题表达。
- **分布式**：[分布式入口](./distributed-system/) 覆盖 RPC、分布式 ID、分布式锁与事务。
- **高性能**：[高性能入口](./high-performance/) 覆盖缓存、读写分离、分库分表与消息队列。
- **高可用**：[高可用入口](./high-availability/) 覆盖限流、降级、熔断、超时重试与幂等。
- **计算机基础**：[计算机基础入口](./cs-basics/) 沉淀操作系统、网络、数据结构与算法。
- **工具实践**：[工具实践入口](./tools/) 沉淀 Docker、Git、Maven、Gradle 与写作链路。
- **博客支线**：[博客入口](./blog/) 用来放实战、复盘和随笔。

## 精选题目

<div class="question-radar">
  <a href="./java/concurrent/java-concurrency-thread-pool.html">
    <span>并发</span>
    <strong>线程池 7 个参数怎么理解？</strong>
    <em>参数、队列、拒绝策略、项目调优</em>
  </a>
  <a href="./java/jvm/jvm-g1-vs-cms.html">
    <span>JVM</span>
    <strong>G1 相比 CMS 改进了什么？</strong>
    <em>分区、停顿预测、并发标记、适用场景</em>
  </a>
  <a href="./database/mysql/mysql-mvcc-read-view.html">
    <span>MySQL</span>
    <strong>MVCC 和 ReadView 是怎么工作的？</strong>
    <em>事务隔离、版本链、可见性判断</em>
  </a>
  <a href="./database/redis/redis-cache-consistency.html">
    <span>Redis</span>
    <strong>如何保证缓存和数据库一致性？</strong>
    <em>延迟双删、旁路缓存、最终一致性</em>
  </a>
</div>

## 最近博客

- [从资料汇总转向内容纠偏](./blog/essays/2026-06-16-note-1.html)：这个站点的价值不是简单聚合资料，而是筛选、纠错、解释取舍并沉淀自己的判断。
- [把本地 Markdown 媒体同步接到 R2 的一次实战](./blog/practice/2026-06-18-r2-media-sync-tutorial.html)：工具链要真的能跑通，卡住你的往往不是脚本，而是凭据链路。
