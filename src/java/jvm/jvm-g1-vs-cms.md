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
  text: "线上 OOM 怎么定位？"
  link: "/java/jvm/jvm-oom-troubleshooting.html"
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

## 容易踩的坑

1. G1 不是“更快的 CMS”，它的堆布局和回收决策都不同。
2. `MaxGCPauseMillis` 是目标，不是 SLA 硬保证。
3. CMS 已经移除，新项目不要再推荐 CMS。
4. G1 减少碎片，不代表不会 Full GC。
5. 大对象、晋升过快、堆过小都会让 G1 表现变差。

## 小结

- CMS 低停顿但有碎片、浮动垃圾、并发失败和 CPU 敏感问题。
- G1 用 Region 管理堆，通过复制回收减少碎片。
- Mixed GC 可以同时回收年轻代和部分老年代 Region。
- G1 的停顿预测基于历史成本估算，是目标而不是绝对保证。
- 对比 G1 和 CMS 时必须带上 JDK 版本边界。

## 参考

综合自《JVM 垃圾回收详解》《最重要的 JVM 参数总结》，并结合 CMS 在 JDK 9 废弃、JDK 14 移除以及 G1 成为 JDK 9+ 默认 GC 的版本事实做了重写。
