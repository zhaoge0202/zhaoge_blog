---
title: "G1 相比 CMS 改进了什么？"
description: "垃圾收集器对比是 JVM 面试从概念走向排障的关键题。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "ADVANCED"
  - "HIGH"
  - "DEEP_EXPLAIN"
prev:
  text: "线程池 7 个参数怎么理解？"
  link: "/java/concurrent/java-concurrency-thread-pool.html"
next:
  text: "MVCC 和 ReadView 是怎么工作的？"
  link: "/database/mysql/mysql-mvcc-read-view.html"
---

# G1 相比 CMS 改进了什么？

> 垃圾收集器对比是 JVM 面试从概念走向排障的关键题。

## 30 秒回答

CMS 以低停顿为目标但存在内存碎片和并发失败问题；G1 用 Region 管理堆，并以可预测停顿和整体收益优先作为核心目标。

## 2 分钟回答

回答时先讲 CMS 的标记清除和问题，再讲 G1 的 Region、Remembered Set、Mixed GC 和停顿预测模型。不要把 G1 简化成“更快的 CMS”。

## 深度解释

G1 的核心变化不是单点算法替换，而是堆布局和回收决策方式变化。它把堆拆成 Region，通过选择收益高的 Region 回收来控制停顿。

## 回答策略

先讲 CMS 痛点，再讲 G1 设计，再回到线上排查：GC 日志、停顿时间、对象晋升和老年代占用。

## 题目信息

- 专题：[JVM](./)
- 难度：ADVANCED
- 高频程度：HIGH
- 掌握层级：DEEP_EXPLAIN

## 追问链路

- **G1 为什么可以做可预测停顿？**：它按 Region 估算回收收益和成本，优先选择收益更高的集合。

## 常见误区

### G1 就是 CMS 的升级版，永远更快。

- 为什么错：G1 的收益取决于堆大小、对象分布和停顿目标，不能简单说永远更快。
- 正确说法：应该比较二者设计目标、堆管理方式和典型问题。

## 纠偏记录

### 避免把 G1 简化成 CMS 替代品

- 问题：很多总结只写 G1 比 CMS 好，忽略适用前提。
- 修正：比较 Region、Mixed GC、停顿目标和碎片问题。
- 证据：HotSpot G1 设计目标和 GC 日志分析实践。
- 来源：PERSONAL_REVIEW

## 项目映射

### 线上接口延迟抖动或 Full GC。

- 项目表达：说明如何查看 GC 日志、停顿时间和老年代增长。
- 风险点：只调大堆可能掩盖对象泄漏或晋升异常。
- 面试回答：我会先用 GC 日志和监控确认停顿来源，再判断是参数问题、对象分配问题还是泄漏问题。

## 参考资料

- GC 日志、JVM 参数文档和线上问题复盘更适合交叉验证收集器对比结论。
