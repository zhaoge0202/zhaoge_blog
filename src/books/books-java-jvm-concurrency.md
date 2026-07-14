---
title: "Java、JVM 与并发该怎么读书？"
description: "把 Java 并发和 JVM 书单映射到站内专题，按问题读而不是按页码读。"
breadcrumb: true
article: true
editLink: false
category:
  - "书单"
tag:
  - "基础"
  - "体系化"
prev:
  text: "书单"
  link: "/books/"
next:
  text: "数据库与中间件该怎么读书？"
  link: "/books/books-database-middleware.html"
---

# Java、JVM 与并发该怎么读书？

> 书是加深用的，站内专题是串联和纠偏用的。先有问题再打开书。

## 怎么用这本书单

1. 先在站内把对应专题主线过一遍
2. 面试或项目卡在边界时，再读相关章节
3. 读完用口述检验：不看目录能否讲清流程和代价

## 推荐映射

| 主题             | 站内先读                                                                                                                                   | 书里重点看什么               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 线程池与任务模型 | [线程池七参数](/java/concurrent/java-concurrency-thread-pool.html)                                                                         | 工作队列、拒绝策略、饱和处理 |
| 锁与 AQS         | [synchronized](/java/concurrent/java-concurrency-synchronized.html)、[ReentrantLock](/java/concurrent/java-concurrency-reentrantlock.html) | 管程、AQS 排队、条件变量     |
| 内存模型         | [JMM](/java/concurrent/java-concurrency-jmm.html)                                                                                          | happens-before、重排序边界   |
| 虚拟线程         | [虚拟线程](/java/concurrent/java-concurrency-virtual-thread.html)                                                                          | 与平台线程差异、阻塞点       |
| 堆与 GC          | [内存区域](/java/jvm/jvm-memory-areas.html)、[G1 vs CMS](/java/jvm/jvm-g1-vs-cms.html)                                                     | 分代、停顿、收集器取舍       |
| 排障             | [OOM](/java/jvm/jvm-oom-troubleshooting.html)、[Full GC](/java/jvm/jvm-full-gc-troubleshooting.html)                                       | dump、日志、采样思路         |
| 集合             | [HashMap](/java/collection/java-collection-hashmap-structure.html)、[CHM](/java/collection/java-collection-concurrenthashmap.html)         | 结构演化与并发风险           |

## 阅读顺序建议

1. 并发工具与线程池（高频、易追问）
2. JMM 与锁（把可见/原子/有序讲圆）
3. JVM 内存与 GC（能连到线上）
4. 集合源码边界（够用即可，别陷细节）

## 小结

1. 书单服务问题，不服务“读完”。
2. 每读一章都回到站内专题做口述。
3. 并发与 JVM 的终点是排障和取舍，不是名词。

## 参考

综合自本站 Java 并发、JVM 与集合专题的阅读路径整理。
