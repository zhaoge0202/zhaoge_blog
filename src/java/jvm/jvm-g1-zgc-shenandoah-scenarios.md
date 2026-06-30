---
title: "G1、ZGC、Shenandoah 分别适合什么场景？"
description: "从停顿目标、堆大小和 JDK 版本讲清三类低延迟 GC 选型。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "高频"
  - "进阶"
  - "原理深入"
prev:
  text: "G1 相比 CMS 改进了什么？"
  link: "/java/jvm/jvm-g1-vs-cms.html"
next:
  text: "线上 OOM 怎么定位？"
  link: "/java/jvm/jvm-oom-troubleshooting.html"
---

# G1、ZGC、Shenandoah 分别适合什么场景？

> G1 是通用服务端选择，ZGC 和 Shenandoah 更偏低延迟大堆场景；选型时要看 JDK 版本、停顿目标、CPU 余量和堆大小。

## 先别问哪个更先进

GC 选型不是排行榜。你要先问：

- 服务更关注吞吐还是 P99 延迟？
- 堆有多大？
- JDK 版本是什么？
- CPU 是否紧张？
- 是否能接受更高的并发 GC 成本？

如果这些条件不清楚，直接说“用 ZGC”或“用 G1”都不严谨。

## 三者怎么定位？

| 收集器     | 典型定位       | 适合场景                           | 代价                        |
| ---------- | -------------- | ---------------------------------- | --------------------------- |
| G1         | 通用服务端 GC  | 中等堆、希望控制停顿的普通后端服务 | 停顿目标不是硬保证          |
| ZGC        | 低延迟、大堆   | 大内存、延迟敏感服务               | 需要较新 JDK，关注 CPU 成本 |
| Shenandoah | 低延迟并发整理 | 延迟敏感、希望降低 STW 的服务      | 生态和发行版支持要确认      |

G1 通过 Region、Mixed GC 和停顿预测平衡吞吐与延迟。ZGC 和 Shenandoah 目标更激进，尽量把标记、整理、转移等工作并发化。

## 面试怎么答？

可以这样回答：

1. JDK 8 老系统常见 Parallel/CMS，现代服务端常见 G1。
2. 如果是普通 Web 服务，先用 G1，结合 GC 日志和延迟目标调参。
3. 如果是大堆且对停顿极敏感，再评估 ZGC 或 Shenandoah。
4. 不管用哪个，都要用 GC 日志、P99、CPU、分配速率验证，而不是只看理论。

## 小结

1. G1 是通用服务端常见选择，兼顾吞吐和可控停顿。
2. ZGC、Shenandoah 更适合低延迟、大堆或停顿敏感场景。
3. 低延迟 GC 会消耗并发 CPU 资源，不是免费优化。
4. GC 选型必须结合 JDK 版本、堆大小、P99 和 GC 日志验证。

## 参考

基于 Oracle Java SE Documentation、OpenJDK JEP、HotSpot VM 文档与 JDK 工具官方文档中 JVM、GC、类加载、监控与诊断相关内容整理。
