---
title: "常见垃圾收集器怎么选？"
description: "按吞吐、延迟、内存占用和 JDK 版本讲清常见 GC 选择边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "高频"
  - "进阶"
  - "体系化"
prev:
  text: "如何判断对象可以被回收？"
  link: "/java/jvm/jvm-object-recycling.html"
next:
  text: "G1 相比 CMS 改进了什么？"
  link: "/java/jvm/jvm-g1-vs-cms.html"
---

# 常见垃圾收集器怎么选？

> GC 选择不是背“谁更先进”，而是在吞吐、延迟、内存占用、CPU 成本和 JDK 版本之间做取舍。

## 先看目标：吞吐还是低延迟？

垃圾收集器大致在几个目标之间取舍：

| 目标     | 含义                      | 典型关注             |
| -------- | ------------------------- | -------------------- |
| 吞吐量   | 用户代码运行时间占比高    | 批处理、离线任务     |
| 低延迟   | 单次停顿尽量短            | 交易、网关、实时接口 |
| 内存占用 | 额外元数据和复制空间少    | 小规格机器           |
| CPU 成本 | GC 并发线程不要抢太多 CPU | CPU 紧张服务         |

所以不存在“最强 GC”。只有“这个服务在这个 JDK、这个堆大小、这个延迟目标下更合适”。

## 常见收集器怎么定位？

| 收集器     | 典型定位                   | 版本边界                          |
| ---------- | -------------------------- | --------------------------------- |
| Serial     | 单线程、小堆、工具类应用   | 现代服务端少用                    |
| Parallel   | 吞吐优先，批处理友好       | JDK 8 常见默认                    |
| CMS        | 历史上的低停顿方案         | JDK 9 废弃，JDK 14 移除           |
| G1         | 通用服务端，兼顾停顿和吞吐 | JDK 9+ 默认                       |
| ZGC        | 大堆、低延迟               | JDK 15 生产可用，JDK 21+ 分代演进 |
| Shenandoah | 低延迟，和应用并发整理     | JDK 15 生产可用                   |

如果是新项目，不要再推荐 CMS。它适合当历史系统知识和排障背景，而不是现代 JDK 的新选择。

## Parallel GC 适合什么？

Parallel 关注吞吐量。比如离线报表、批量计算、后台任务，停顿几百毫秒不敏感，但希望总体跑得快。

JDK 8 常见默认是 Parallel Scavenge + Parallel Old。可以用：

```bash
java -XX:+PrintCommandLineFlags -version
```

确认当前 JVM 实际启用的收集器。

## G1 为什么成为通用选择？

G1 把堆切成很多 Region，不再只按传统连续新生代/老年代大块管理。它会估算每个 Region 的回收收益和成本，在停顿目标内优先回收收益高的 Region。

它适合多数中大型 Java 服务：

- 堆比较大。
- 希望停顿可控。
- 不想维护 CMS 的碎片和并发失败问题。
- 使用 JDK 9+ 默认配置。

但 G1 也不是永远更快。停顿目标设得过低、堆太小、对象分配过猛，都可能让它付出更高 CPU 成本。

## ZGC 和 Shenandoah 适合什么？

ZGC 和 Shenandoah 都属于低延迟方向，目标是把大部分 GC 工作与应用线程并发执行，减少 STW 时间。

适合：

- 大堆。
- 延迟敏感接口。
- 不能接受长时间 Full GC 的服务。

代价是：

- 可能牺牲一部分吞吐。
- 需要较新 JDK。
- 观测指标和调优方式与传统分代 GC 不完全一样。

版本边界要说清：

- ZGC：JDK 11 实验，JDK 15 生产可用。
- 分代 ZGC：JDK 21 引入，后续版本持续演进。
- Shenandoah：JDK 12 实验，JDK 15 生产可用。

## 怎么用数据判断选型？

先开启 GC 日志，再谈调优。

JDK 8：

```bash
-XX:+PrintGCDetails
-XX:+PrintGCDateStamps
-Xloggc:/var/log/app/gc-%t.log
-XX:+UseGCLogFileRotation
-XX:NumberOfGCLogFiles=14
-XX:GCLogFileSize=50M
```

JDK 11+：

```bash
-Xlog:gc*,safepoint:file=/var/log/app/gc-%t.log:time,uptime,level,tags:filecount=14,filesize=50M
```

运行时先看：

```bash
jstat -gcutil <pid> 1000 10
```

重点观察 Young GC、Full GC 次数和耗时，老年代是否持续上升，GC 后是否能明显回落。

## 小结

- GC 选择本质是在吞吐、延迟、CPU、内存和版本之间做取舍。
- JDK 8 常见默认是 Parallel，JDK 9+ 默认是 G1。
- CMS 已废弃并移除，新项目不要推荐 CMS。
- G1 是通用服务端常见选择，但不是所有场景都更快。
- ZGC 和 Shenandoah 面向低延迟、大堆场景，要结合 JDK 版本和观测数据选择。

## 参考

综合自《JVM 垃圾回收详解》《最重要的 JVM 参数总结》，并结合 CMS 移除、ZGC/Shenandoah 生产可用和分代 ZGC 的版本边界做了更新整理。
