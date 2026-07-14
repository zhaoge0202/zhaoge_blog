---
title: "3-5 年 Java 后端四周怎么复习？"
description: "按周拆成可执行路径，把知识库串成面试准备节奏，而不是盲目刷题。"
breadcrumb: true
article: true
editLink: false
category:
  - "面试准备"
tag:
  - "必会"
  - "体系化"
  - "项目实战"
prev:
  text: "面试准备"
  link: "/interview-preparation/"
next:
  text: "项目经验怎么用 STAR 讲清楚？"
  link: "/interview-preparation/interview-prep-project-star.html"
---

# 3-5 年 Java 后端四周怎么复习？

工作三五年再准备面试，最容易踩的坑不是"不会"，而是"记不成体系"。平时用得顺手的东西，一到面试官追问"为什么"就卡壳；背过的八股，换个场景问法就答不上来。四周时间不算多，堆知识点刷不完，也刷不深，所以这份计划的思路是：**先把项目故事理清楚，再拿知识库补盲区，最后用模拟面试倒逼输出**。

## 复习前提：先有项目故事，再补知识

在打开任何一篇技术文章之前，先做一件事：把简历上写的 2-3 个项目，按"背景-问题-方案-结果"捋一遍，尤其是那些能报出具体数字的地方（QPS、延迟、故障时长、成本）。原因很直接——面试官问"线程池怎么用"，真正想听的不是参数定义，而是"你在哪个项目里因为什么问题调过线程池"。没有项目锚点，知识点背得再熟也是空中楼阁，还容易被"你们线上到底是怎么配的"这种追问打回原形。

所以这四周不是简单地把知识库文章过一遍，而是：**每读一篇，就问自己"我的项目里有没有对应的影子，如果没有，怎么补一句合理的经历"**。这也是每天安排里"项目挂钩"这一栏存在的意义。

## 四周总览

| 周次   | 主题                                | 核心产出                                     |
| ------ | ----------------------------------- | -------------------------------------------- |
| Week 1 | Java 并发 + JVM + 集合高频          | 能脱稿讲清线程池、锁、JMM、GC 的原理和取舍   |
| Week 2 | MySQL + Redis + SQL                 | 能从一条慢 SQL 讲到索引、锁、事务、主从      |
| Week 3 | 分布式治理 + MQ + 高可用            | 能讲清服务发现、分布式事务、限流熔断怎么组合 |
| Week 4 | Spring + 安全 + 设计基础 + 模拟面试 | 项目故事定稿，具备完整一轮技术面的输出能力   |

每周节奏基本一致：**2-3 篇精读 + 口述 10 分钟 + 1 个项目挂钩**。精读不是通读，是带着"面试官会怎么追问"去读；口述是关掉文章，用自己的话把流程图和结论讲一遍，卡壳的地方就是没吃透的地方；项目挂钩是把知识点钉到具体的代码或配置上，哪怕是"如果当时这么改好"的复盘也算。

## 每天大概怎么分配时间

按下班后能挤出 1.5-2 小时算：

- **精读 40-50 分钟**：读第一篇文章时正常速度，读完立刻合上，在纸上或备忘录里写 3-5 个关键词（不是抄句子，是自己复述的关键词）。第二篇文章开始只看和第一篇不重叠的部分，重叠的原理（比如线程池和并发容器都会提到锁）一带而过。
- **口述 10 分钟**：手机计时，对着空气或者录音讲。讲不下去就翻开文章看断在哪一段，那一段就是当天真正要补的内容，而不是从头再读一遍。
- **项目挂钩 15-20 分钟**：翻自己的代码仓库或者回忆配置文件，找到对应的类、配置项、监控图。找不到就诚实写"没做过，如果做会怎么设计"，这也是一种答案，比编一个假场景更经得起追问。
- **剩余时间**：留给通勤路上或碎片时间的补充清单，不需要正襟危坐地读，扫一遍标题和加粗结论就够。

如果只能挤出 40 分钟，优先保证口述，精读可以只看一篇，项目挂钩用睡前 5 分钟脑内过一遍也行——顺序不能反，读了不讲等于没读。

---

## Week 1：Java 并发 + JVM + 集合高频

这是整个复习里权重最高的一周，也是面试官最爱刨根问底的领域。并发不是背概念，是要能画出线程池的执行流程图、讲清 CAS 为什么会有 ABA 问题；JVM 不是背参数，是要能说出"这个现象该看哪块内存、用什么工具"。

| Day  | 主题               | 精读                                                                                                                                                                                                                                                               | 口述话题                                        | 项目挂钩                                                      |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------- |
| 周一 | 线程与线程池       | [线程创建方式与生命周期](/java/concurrent/java-concurrency-basics.html)、[线程池 7 个参数](/java/concurrent/java-concurrency-thread-pool.html)                                                                                                                     | 核心线程→队列→非核心线程→拒绝策略这条路径       | 项目里自定义过的线程池配置，corePoolSize 怎么定的             |
| 周二 | 可见性与有序性     | [JMM 与 happens-before](/java/concurrent/java-concurrency-jmm.html)、[volatile 的能力边界](/java/concurrent/java-concurrency-volatile.html)                                                                                                                        | volatile 能保证什么、不能保证什么，各举一个例子 | 项目里用 volatile 做状态标志位的场景                          |
| 周三 | 锁与 CAS           | [synchronized 底层与锁优化](/java/concurrent/java-concurrency-synchronized.html)、[CAS 原理与 ABA](/java/concurrent/java-concurrency-cas.html)、[ReentrantLock 与 AQS](/java/concurrent/java-concurrency-reentrantlock.html)                                       | AQS 的双向队列和 state 是怎么配合加锁的         | 项目里 synchronized 和 ReentrantLock 各用在什么地方，为什么   |
| 周四 | 并发工具与容器     | [协调工具类怎么选](/java/concurrent/java-concurrency-coordination-tools.html)、[ThreadLocal 与内存泄漏](/java/concurrent/java-concurrency-threadlocal.html)、[并发容器怎么选](/java/concurrent/java-concurrency-concurrent-collections.html)                       | ThreadLocal 内存泄漏的根因和怎么规避            | 项目里 ThreadLocal 传递链路信息的用法                         |
| 周五 | 异步编排与新特性   | [CompletableFuture 编排](/java/concurrent/java-concurrency-completablefuture.html)、[ForkJoin 与 parallelStream 的坑](/java/concurrent/java-concurrency-forkjoin-parallelstream.html)、[虚拟线程解决了什么](/java/concurrent/java-concurrency-virtual-thread.html) | 虚拟线程和平台线程的关系，什么场景该用          | 项目里有没有并行调用多个下游、用 CompletableFuture 编排的地方 |
| 周六 | JVM 内存与对象     | [JVM 内存区域划分](/java/jvm/jvm-memory-areas.html)、[对象生命周期](/java/jvm/jvm-object-lifecycle.html)、[类加载与双亲委派](/java/jvm/jvm-class-loading.html)                                                                                                     | 哪些区域会 OOM，双亲委派解决了什么问题          | 项目里遇到过的 OOM 或类加载冲突                               |
| 周日 | GC 排障 + 集合高频 | [G1 相比 CMS 改进了什么](/java/jvm/jvm-g1-vs-cms.html)、[线上 OOM 怎么定位](/java/jvm/jvm-oom-troubleshooting.html)、[HashMap 底层结构与扩容](/java/collection/java-collection-hashmap-structure.html)                                                             | 一次线上 GC 问题排查的完整思路                  | 项目里做过的 JVM 参数调整或排障复盘                           |

**集合部分补充清单**（本周时间紧张，周日只够啃一篇 HashMap，剩下几篇挑晚上碎片时间补，别跳过）：

- [ConcurrentHashMap 从分段锁到 CAS+synchronized](/java/collection/java-collection-concurrenthashmap.html) —— 面试问"线程安全的 Map"必考
- [CopyOnWriteArrayList 适合什么场景](/java/collection/java-collection-copyonwritearraylist.html) —— 读多写少场景的经典对照
- [ArrayList 和 LinkedList 到底怎么选](/java/collection/java-collection-arraylist-linkedlist.html) —— 基础但常被问到扩容细节
- [LinkedHashMap 为什么适合做 LRU](/java/collection/java-collection-linkedhashmap-lru.html) —— 手写 LRU 常考的原理支撑

本周结束时自测：能不能在白板上画出线程池执行流程图、AQS 加锁流程图、HashMap 扩容流程图，三张图不看资料能画出来，才算过关。

---

## Week 2：MySQL + Redis + SQL

数据库这块的面试套路很固定：从一条慢 SQL 或一次线上抖动切入，一路问到索引、锁、事务、主从。所以复习顺序也照着这条链路走，而不是按知识点罗列。

| Day  | 主题                    | 精读                                                                                                                                                                                                                 | 口述话题                                          | 项目挂钩                                                    |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| 周一 | SQL 执行链路 + 索引设计 | [一条 SQL 是怎么执行的](/database/mysql/mysql-architecture-sql-execution.html)、[索引怎么设计和使用](/database/mysql/mysql-index-design.html)                                                                        | SQL 执行经过了哪些模块，Server 层和引擎层各做什么 | 项目里主表的索引设计思路，有没有踩过冗余索引的坑            |
| 周二 | 索引失效 + 锁           | [索引为什么会失效](/database/mysql/mysql-index-invalidation.html)、[行锁怎么加](/database/mysql/mysql-lock-rules.html)、[next-key lock 锁了什么范围](/database/mysql/mysql-next-key-lock-range.html)                 | 间隙锁和临键锁的边界，怎么用间隙锁防幻读          | 项目里遇到过的索引失效案例，怎么发现和修复的                |
| 周三 | 事务隔离 + MVCC + 日志  | [事务隔离级别怎么理解](/database/mysql/mysql-transaction-isolation.html)、[MVCC 和 ReadView](/database/mysql/mysql-mvcc-read-view.html)、[redo/undo/binlog 的分工](/database/mysql/mysql-logs.html)                  | ReadView 怎么判断一行记录对当前事务可不可见       | 项目里对事务隔离级别做过的取舍或踩过的坑                    |
| 周四 | 主从复制 + 排障         | [主从复制原理与延迟](/database/mysql/mysql-replication.html)、[慢 SQL 排查顺序](/database/mysql/mysql-slow-query-troubleshooting.html)、[死锁怎么产生和避免](/database/mysql/mysql-deadlock.html)                    | 拿到一条慢 SQL，从哪一步开始排查                  | 项目里真实处理过的慢查询或死锁事故                          |
| 周五 | Redis 核心结构          | [Redis 数据类型怎么选](/database/redis/redis-data-structures.html)、[SDS/dict/skiplist 解决什么问题](/database/redis/redis-internal-data-structures.html)、[RDB/AOF 怎么选](/database/redis/redis-persistence.html)  | ZSet 为什么用跳表不用红黑树                       | 项目里用 Redis 数据结构实现过的具体功能（排行榜、计数器等） |
| 周六 | Redis 一致性与高可用    | [缓存和数据库一致性怎么保证](/database/redis/redis-cache-consistency.html)、[雪崩击穿穿透怎么治理](/database/redis/redis-cache-problems.html)、[分布式锁能不能用 Redis](/database/redis/redis-distributed-lock.html) | 延迟双删和订阅 binlog 两种方案的取舍              | 项目里缓存不一致的真实案例，怎么发现和补救的                |
| 周日 | SQL 高频语法            | [SELECT 逻辑执行顺序](/database/sql/sql-execution-order.html)、[窗口函数解决什么问题](/database/sql/sql-window-functions.html)、[深度分页怎么优化](/database/sql/sql-pagination.html)                                | 手写一道用窗口函数求分组 TopN 的题                | 项目报表或统计功能里用过的复杂 SQL                          |

Redis 高可用这块如果时间够，加读一篇 [Sentinel 怎么判断故障并选主](/database/redis/redis-sentinel-failover.html)，很多人只知道"哨兵能自动切换"，讲不清楚具体的投票和确认流程，容易被面试官一句话戳穿。

本周自测：给一条真实的慢 SQL，能不能在 5 分钟内说出排查顺序（看执行计划→看索引→看锁等待→看主从延迟），说不利索就是这周没吃透。

**MySQL/Redis 补充清单**（碎片时间读，按面试概率从高到低排）：

- [count(\*)、count(1)、count(字段) 有什么区别](/database/mysql/mysql-count.html) —— 送分题，但很多人答不全原因
- [InnoDB 和 MyISAM 有什么区别](/database/mysql/mysql-innodb-vs-myisam.html) —— 引出为什么现在都用 InnoDB
- [Buffer Pool 是怎么提速的](/database/mysql/mysql-buffer-pool.html) —— 追问"为什么改了配置没生效"常考
- [Redis 大 key 热 key 怎么发现和处理](/database/redis/redis-bigkey-hotkey.html) —— 线上排障高频，别只背定义
- [Redis 单线程为什么还能这么快](/database/redis/redis-single-thread-performance.html) —— 常被当作开场题，答案要落到 IO 多路复用
- [Redis 做分布式限流为什么经常配 Lua](/database/redis/redis-rate-limiting.html) —— 和 Week 3 的限流算法呼应，提前留个印象

---

## Week 3：分布式治理 + MQ + 高可用

这一周的知识点单独看都不难，难的是"组合起来讲"——面试官很少只问"什么是分布式锁"，更常见的是"你们服务挂了会怎么样，是怎么兜住的"。所以口述环节尤其重要，尽量把几篇文章串成一条链路讲。

| Day  | 主题                  | 精读                                                                                                                                                                                                                                                             | 口述话题                                         | 项目挂钩                                                 |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| 周一 | CAP + 服务治理基础    | [CAP 和 BASE 怎么理解](/distributed-system/distributed-cap-base.html)、[分布式 ID 怎么选](/distributed-system/distributed-id-selection.html)、[服务注册发现怎么设计](/distributed-system/distributed-service-discovery.html)                                     | 心跳、摘除、保护阈值分别解决什么问题             | 项目用的注册中心，心跳间隔和摘除策略是怎么配的           |
| 周二 | 分布式锁 + 一致性协议 | [分布式锁有哪些实现](/distributed-system/distributed-lock-implementations.html)、[ZooKeeper 和 ZAB 的关系](/distributed-system/distributed-zookeeper-zab.html)、[Raft 解决了什么问题](/distributed-system/distributed-raft-overview.html)                        | Redis 锁的边界在哪里，fencing token 解决什么问题 | 项目里用分布式锁防重的具体场景                           |
| 周三 | 分布式事务 + 配置中心 | [分布式事务怎么选](/distributed-system/distributed-transaction-selection.html)、[配置中心解决什么问题](/distributed-system/distributed-config-center.html)、[API 网关做了什么](/distributed-system/distributed-api-gateway.html)                                 | 2PC、TCC、Saga、本地消息表分别适合什么场景       | 项目里的跨服务操作，用没用到分布式事务，怎么保证最终一致 |
| 周四 | MQ 基础               | [消息队列解决了什么问题](/high-performance/high-performance-message-queue-role.html)、[Kafka/RocketMQ/RabbitMQ 怎么选](/high-performance/high-performance-mq-selection.html)、[MQ 如何保证消息不丢](/high-performance/high-performance-message-reliability.html) | 生产端、broker、消费端三层分别怎么保证不丢消息   | 项目里选型 MQ 时的取舍理由                               |
| 周五 | MQ 进阶               | [重复消费和幂等怎么处理](/high-performance/high-performance-message-idempotency.html)、[顺序消息怎么保证](/high-performance/high-performance-message-ordering.html)、[消息积压怎么排查](/high-performance/high-performance-message-backlog.html)                 | 分区顺序和全局顺序的差别，积压了先做什么         | 项目里处理过的消息积压或重复消费事故                     |
| 周六 | 限流熔断降级          | [限流算法怎么选](/high-availability/high-availability-rate-limiting.html)、[熔断降级隔离超时重试怎么组合](/high-availability/high-availability-resilience-composition.html)、[重试为什么会放大故障](/high-availability/high-availability-retry-storm.html)       | 令牌桶和漏桶的差别，重试风暴是怎么形成的         | 项目里配置过的限流阈值或熔断策略                         |
| 周日 | 幂等 + 容灾           | [接口幂等怎么设计](/high-availability/high-availability-idempotency-design.html)、[支付回调怎么做幂等](/high-availability/high-availability-idempotency-cases.html)、[容灾多活故障转移](/high-availability/high-availability-disaster-recovery.html)             | 幂等键怎么选，容灾和多活的区别                   | 项目里支付或订单场景的幂等实现                           |

如果面的公司大量用 Dubbo 或者自研 RPC，周三或周四挤时间加读 [RPC 一次调用经历了哪些步骤](/distributed-system/rpc/rpc-call-flow.html)，这是"你们服务是怎么互相调用的"这类问题的标准答案框架。

本周自测：假设线上一个下游服务突然变慢，能不能一口气讲清楚"限流不生效会怎样→熔断怎么触发→降级返回什么→重试要不要做、怎么做"，讲不成一条链就回去补高可用那三篇。

**分布式/高可用补充清单**（时间紧就先挑前两条）：

- [SLA、几个 9、RTO、RPO 到底是什么意思](/high-availability/high-availability-sla-rto-rpo.html) —— 面 P7 以上或者带团队背景的岗位常问，能报出数字更加分
- [压测应该测什么，容量评估怎么做](/high-availability/high-availability-performance-testing.html) —— 大促、双十一类项目背景必备
- [灰度发布、金丝雀和蓝绿怎么落地](/distributed-system/distributed-gray-release.html) —— 和配置中心、网关那几篇能串成一条发布链路
- [Dubbo 的注册发现、负载均衡和容错怎么配合](/distributed-system/rpc/dubbo-discovery-loadbalance-faulttolerance.html) —— 用 Dubbo 的团队优先看，用 Spring Cloud 的可以跳过

---

## Week 4：Spring + 安全 + 设计基础 + 模拟面试 + 项目打磨

最后一周不再铺新广度，重心转向"讲出来"和"项目故事定稿"。前五天补 Spring 和安全的高频知识盲区，后两天全部留给模拟面试和项目打磨。

| Day  | 主题                      | 精读                                                                                                                                                                                                                                                        | 口述话题                                      | 项目挂钩                                                                 |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| 周一 | Spring IOC                | [Bean 生命周期与扩展点](/system-design/framework/spring-bean-lifecycle-extension-points.html)、[IOC 容器启动流程](/system-design/framework/spring-ioc-container-startup.html)                                                                               | Bean 从定义到可用经历了哪些扩展点             | 项目里自定义过的 BeanPostProcessor 或 FactoryBean                        |
| 周二 | Spring AOP + 事务         | [AOP 动态代理与织入](/system-design/framework/spring-aop-proxy-weaving.html)、[事务失效的常见场景](/system-design/framework/spring-transaction-failure-cases.html)、[循环依赖怎么解决](/system-design/framework/spring-circular-dependency-resolution.html) | @Transactional 在哪些调用方式下会失效         | 项目里踩过的事务失效坑，怎么发现的                                       |
| 周三 | SpringMVC + Boot 自动配置 | [SpringMVC 请求处理流程](/system-design/framework/spring-mvc-request-processing.html)、[SpringBoot 自动配置原理](/system-design/framework/spring-boot-auto-configuration-principles.html)                                                                   | DispatcherServlet 到 Controller 的完整链路    | 项目里写过的自定义 Starter 或自动配置类                                  |
| 周四 | 安全                      | [JWT 和 Session 怎么选](/system-design/security/security-jwt-vs-session.html)、[SSO 流程怎么走](/system-design/security/security-sso-flow.html)、[认证鉴权怎么设计](/system-design/security/security-authentication-authorization.html)                     | JWT 怎么做续期和注销，SSO 的票据怎么校验      | 项目里的登录鉴权方案，token 怎么存和刷新                                 |
| 周五 | 设计基础 + 项目模式复盘   | [SOLID 原则怎么落地](/system-design/basis/design-solid-principles.html)、[常见设计模式怎么选](/system-design/basis/design-common-patterns.html)                                                                                                             | 项目里用过的 2-3 个设计模式，解决了什么问题   | 逐个梳理项目代码里实际用到的设计模式，别硬编一个没用过的                 |
| 周六 | 模拟面试第一轮            | 从 Week1-3 里挑 8-10 道高频题限时口述                                                                                                                                                                                                                       | 每道题控制在 3 分钟内，讲完立刻对照原文找漏洞 | 把口述中暴露的项目细节缺口记下来，当晚补                                 |
| 周日 | 模拟面试第二轮 + 项目定稿 | 补第二轮模拟面试，重点问追问题                                                                                                                                                                                                                              | 把周六暴露的问题重新讲一遍，直到不卡壳        | 项目故事最终定稿：STAR 结构 + 关键数据 + 可能被追问的 3 个点提前想好答案 |

模拟面试建议找人对练或者自己录音回放，自己看自己写的答案没用——面试考的是临场组织语言的能力，不是默写能力。周六周日暴露出来的问题，不是回去重读文章，而是先补项目挂钩：这个知识点在我的项目里到底有没有对应场景，编不出来就诚实地说"我们当时没这么做，但如果重做我会这样优化"，比硬编一个不存在的细节安全得多。

**Spring/安全补充清单**（如果目标公司明确要看 MyBatis 相关，优先补前两条）：

- [MyBatis 一二级缓存的坑在哪里](/system-design/framework/mybatis-cache-pitfalls.html) —— 一级缓存脏读、二级缓存跨 session 的经典问题
- [MyBatis 分页插件的原理](/system-design/framework/mybatis-plugin-pagination-mechanism.html) —— 讲清楚拦截器怎么改写 SQL
- [常见密码学算法怎么选](/system-design/security/security-crypto-algorithms.html) —— 对称/非对称/摘要算法的适用场景
- [数据脱敏和加密怎么做](/system-design/security/security-data-masking-encryption.html) —— 涉及用户敏感信息的项目会被追问
- [找回密码流程怎么设计才安全](/system-design/security/security-password-reset.html) —— 常被当作系统设计小题考

## 模拟面试题库怎么挑

Week 4 周末的模拟面试，题目不要临时现想，提前从四周内容里挑好，覆盖到"深度题+场景题+反问题"三种类型：

- **深度题**（考原理）：线程池执行流程、AQS 加锁流程、MVCC 可见性判断、Redis 主从复制流程，各挑一道要求脱稿画图讲解。
- **场景题**（考取舍）：给一个"秒杀场景怎么防超卖"或"接口偶发超时怎么排查"的开放问题，逼自己组合多个知识点作答，而不是单点回答。
- **反问题**（考边界意识）：故意问"这个方案有什么问题""如果并发量再翻十倍呢"，检验是不是只会背正确答案，不会讲局限性。

每轮模拟面试控制在 40-50 分钟、8-10 道题，讲完立刻记录三类问题：完全不会的、讲得啰嗦没重点的、和项目对不上号的。这三类问题就是周日晚上最后冲刺的清单，而不是把整本知识库再翻一遍。

---

## 根据自己的情况调整节奏

这份计划按"四周都从头系统过一遍"设计，但每个人的底子不一样，照搬未必是最优解。

- **并发和 JVM 平时用得多、比较熟**：Week 1 可以压缩到 4 天，把省下的 2-3 天挪给 Week 2 的 MySQL 锁和事务隔离，这块通常是薄弱区，也是面试官爱刨根问底的重灾区。
- **做的是中台或 To B 业务，很少碰 MQ 和分布式事务**：不要跳过 Week 3，反而要多花时间，因为这恰恰是简历上写了但答不出细节的地方，面试官一问就露馅。
- **临近面试只剩两周**：优先级排序是 Week1 并发线程池锁 > Week2 MySQL 索引锁事务 > Week3 限流熔断 > Week4 Spring，安全和设计模式可以先跳过，模拟面试无论如何都要留出最后一天。
- **已经面试过几轮、知道具体方向**：把这份计划当索引用，只挑面试官问过或者岗位 JD 里提到的关键词对应的文章精读，其余部分按标题扫一遍留个印象即可。

核心原则不变：**不确定该不该跳过某一篇，就用"面试官会不会顺着简历问到这里"来判断**，而不是这篇文章"看起来"重不重要。

---

## 常见踩坑

- **背文章原文，不会拆开重组**：面试官换个提问角度就露馅。检验标准是关掉文章能不能画出流程图、举出反例。
- **知识点和项目脱节**：讲原理头头是道，一问"你们线上怎么配的"就语塞。每天把知识点映射回自己的项目不是选做项，是必做项。
- **平均分配时间**：四周 28 天，并发和 JVM 权重最高，别因为"还没看完"就压缩模拟面试的两天，输出能力比知识覆盖面更影响最终结果。
- **跳过日志分析类文章**：像 [GC 日志怎么看](/java/jvm/jvm-gc-log-analysis.html)、[死锁日志怎么看](/database/mysql/mysql-deadlock-log-analysis.html) 这类文章容易被当作"进阶选读"跳过，但排障能力恰恰是 3-5 年经验候选人和应届生的分水岭，有空一定要补。
- **模拟面试留太少时间**：很多人把四周全用来读文章，最后两天草草带过。讲出来和写下来是两种能力，没有输出练习，读得再多也发挥不出来。
- **只准备一套项目故事，不做拆分**：同一个项目要能拆成"整体介绍版"（2 分钟）、"技术深挖版"（针对某个模块展开 5 分钟）、"故障复盘版"（讲一次线上事故的完整处理过程），面试官问法不同，讲法也要跟着变，不是一套话术打天下。
- **把"知道"当成"会讲"**：读完文章觉得都懂了，一开口才发现组织不出完整的句子。这就是为什么口述这一步不能省，读和讲之间隔着一层，只有讲出来才知道哪里是真懂、哪里是眼熟。

四周说长不长，说短也够把主线捋顺。比起临阵刷题刷到麻木，把知识点和自己的项目经历对上号，回答才会有底气，被追问也不会慌。祝面试顺利。

## 小结

1. 四周复习先理项目故事，再补知识盲区，最后用模拟面试倒逼输出。
2. 优先级通常是：并发/JVM → MySQL/Redis → 分布式与高可用 → Spring/安全/设计与模拟。
3. 每天精读要能口述，并挂回自己的项目配置与踩坑。
4. 临近面试时宁可压缩覆盖面，也要保住输出练习。
5. 用“简历会不会被追到这里”决定读不读，而不是按目录刷完。

## 参考

综合自本站 Java、数据库、分布式、高性能与高可用专题的实际篇目结构，按 3-5 年 Java 后端面试节奏重排为四周可执行路径。
