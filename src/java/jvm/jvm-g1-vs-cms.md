---
title: "G1 相比 CMS 改进了什么？"
description: "从 Region、Mixed GC、停顿预测和碎片问题对比 G1 与 CMS。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "进阶"
  - "高频"
  - "原理深入"
prev:
  text: "常见垃圾收集器怎么选？"
  link: "/java/jvm/jvm-gc-collectors.html"
next:
  text: "G1、ZGC、Shenandoah 分别适合什么场景？"
  link: "/java/jvm/jvm-g1-zgc-shenandoah-scenarios.html"
---

# G1 相比 CMS 改进了什么？

> CMS 解决了“老年代回收别停太久”的问题，G1 更进一步，用 Region 和收益优先模型来控制停顿和碎片。

## 先说版本边界

CMS 是历史上非常重要的低停顿收集器，但它已经不是现代 JDK 新项目的推荐选择：

- JDK 9：CMS 被标记为废弃。
- JDK 14：CMS 被移除。
- JDK 9 起：G1 成为主线默认 GC。

所以面试里讲 CMS，更多是为了理解低停顿 GC 的演进和老系统排障。

## CMS 的核心问题是什么？

CMS 全称 Concurrent Mark Sweep，目标是降低老年代回收停顿。它的大部分标记和清除工作可以和用户线程并发执行。

但它有几个典型问题：

| 问题     | 说明                                           |
| -------- | ---------------------------------------------- |
| 内存碎片 | CMS 基于标记-清除，清完后空间可能不连续        |
| 浮动垃圾 | 并发清理时用户线程还在产生新垃圾，只能下次再收 |
| 并发失败 | 老年代预留空间不足时可能退化为更重的 Full GC   |
| CPU 敏感 | 并发 GC 线程会和业务线程抢 CPU                 |

碎片问题尤其典型：明明总空闲不少，但找不到连续空间分配大对象，仍可能触发 Full GC。

CMS 的主要阶段可以这样记：

```text
初始标记(STW)
  ↓
并发标记(业务线程继续跑)
  ↓
重新标记(STW，修正并发期间变化)
  ↓
并发清除(业务线程继续跑)
```

它降低的是“老年代标记清除全程停顿”的时间，但不是全程无停顿。初始标记和重新标记仍然会 STW；并发阶段还会消耗 CPU，并产生浮动垃圾。

## G1 的堆布局有什么变化？

G1 不再把堆简单看成连续的新生代和老年代大块，而是拆成许多大小相等的 Region。

```text
Heap
├── Region 1  Eden
├── Region 2  Survivor
├── Region 3  Old
├── Region 4  Humongous
└── ...
```

Region 的角色可以动态变化。G1 回收时会选择一组 Region 组成 Collection Set，把存活对象复制到其他 Region，然后整体回收原 Region。

从整体看，G1 更接近标记-整理；从局部看，它通过复制回收 Region，能减少 CMS 那种碎片问题。

Humongous Region 是 G1 里必须额外关注的点。大对象会占用一个或多个连续 Region，如果大对象分配很猛，可能导致 Region 利用率差、Mixed GC 压力升高，严重时仍可能走向 Full GC。

## Mixed GC 为什么重要？

CMS 主要面对老年代并发标记清除。G1 则可以在一次 Mixed GC 中回收整个年轻代和一部分收益高的老年代 Region。

它会估算：

- 这个 Region 有多少垃圾。
- 回收它大概要花多少时间。
- 在停顿目标内选哪些 Region 最划算。

这就是 Garbage-First 的含义：优先回收垃圾最多、收益最高的区域。

## G1 怎么做停顿预测？

G1 可以设置期望最大停顿：

```bash
-XX:MaxGCPauseMillis=200
```

这不是硬保证，而是目标。G1 会根据历史统计估算回收成本，尽量在目标时间内选择合适数量的 Region。

如果业务对象分配太快、堆太小、停顿目标设得过低，G1 也可能达不到目标，甚至频繁 GC。

G1 的回收阶段大致可以理解成：

```text
Young GC
  └── 回收年轻代 Region

并发标记周期
  ├── 初始标记
  ├── 并发标记
  ├── 重新标记
  └── 清理统计

Mixed GC
  └── 年轻代 + 一部分高收益老年代 Region
```

这和 CMS 最大的差异是：G1 不只是“并发标记老年代”，它还会基于 Region 收益选择一部分老年代加入停顿内回收。停顿可预测性来自这种选择模型，而不是魔法般消除停顿。

## 线上怎么观察？

先看 GC 日志，不要只背概念。

JDK 11+ 示例：

```bash
-XX:+UseG1GC
-Xlog:gc*,safepoint:file=/var/log/app/gc-%t.log:time,uptime,level,tags:filecount=14,filesize=50M
```

观察重点：

- Young GC 是否过于频繁。
- Mixed GC 是否发生。
- 老年代占用是否持续上升。
- Humongous Object 是否过多。
- 每次停顿是否接近或超过目标。

运行时粗看：

```bash
jstat -gcutil <pid> 1000 10
```

如果日志里出现这些信号，要继续往下查：

| 信号                        | 可能含义                         |
| --------------------------- | -------------------------------- |
| `Humongous` 相关日志很多    | 大对象过多，Region 利用率变差    |
| Mixed GC 后老年代仍持续上升 | 回收收益不足或分配/晋升过快      |
| `to-space exhausted`        | 疏散空间不足，可能退化到更重回收 |
| Full GC                     | G1 正常节奏被打断，要看触发原因  |
| 停顿长期超过目标            | 目标过低、堆配置不合理或负载过高 |

所以 G1 的排查不能只看“用了 G1”。要看 Young、Concurrent Mark、Mixed、Full 这些阶段是否按预期发生。

## 什么时候还会遇到 CMS？

新项目不推荐 CMS，但存量 JDK 8 系统里仍可能遇到。排障时重点关注：

- 老年代碎片导致的大对象分配失败。
- `concurrent mode failure` 这类并发失败信号。
- Full GC 是否由 CMS 退化到串行老年代回收。
- CPU 是否被并发 GC 线程抢占。
- 是否存在升级 JDK 或迁移 G1 的空间。

如果业务还停留在 CMS，调参只能缓解一部分问题；当堆越来越大、停顿目标越来越严格时，迁移到较新 JDK 和新收集器通常更值得评估。

## 容易踩的坑

1. G1 不是“更快的 CMS”，它的堆布局和回收决策都不同。
2. `MaxGCPauseMillis` 是目标，不是 SLA 硬保证。
3. CMS 已经移除，新项目不要再推荐 CMS。
4. G1 减少碎片，不代表不会 Full GC。
5. 大对象、晋升过快、堆过小都会让 G1 表现变差。
6. Mixed GC 不是 Full GC，它只回收年轻代和部分老年代 Region。

## 小结

- CMS 低停顿但有碎片、浮动垃圾、并发失败和 CPU 敏感问题。
- G1 用 Region 管理堆，通过复制回收减少碎片。
- Mixed GC 可以同时回收年轻代和部分老年代 Region。
- G1 的停顿预测基于历史成本估算，是目标而不是绝对保证。
- 对比 G1 和 CMS 时必须带上 JDK 版本边界。

## 参考

基于 Oracle Java SE Documentation、OpenJDK JEP、HotSpot VM 文档与 JDK 工具官方文档中 JVM、GC、类加载、监控与诊断相关内容整理。
