---
title: "频繁 Full GC 怎么排查？"
description: "从监控确认、GC 日志、老年代增长到代码根因讲清 Full GC 排查路径。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "排障"
  - "项目实战"
  - "高频"
prev:
  text: "线上 OOM 怎么定位？"
  link: "/java/jvm/jvm-oom-troubleshooting.html"
next:
  text: "JVM 参数调优到底在调什么？"
  link: "/java/jvm/jvm-parameters-tuning.html"
---

# 频繁 Full GC 怎么排查？

> Full GC 排查要先确认频率和停顿，再看老年代、元空间、显式 GC、直接内存和代码分配模式。

## 第一步：确认是不是真的 Full GC

不要只听“接口慢就是 Full GC”。先看数据：

```bash
jstat -gcutil <pid> 1000 10
```

重点看：

- `YGC/YGCT`：Young GC 次数和总耗时。
- `FGC/FGCT`：Full GC 次数和总耗时。
- `O`：老年代使用率。
- `M`：元空间使用率。

如果 `FGC` 持续增长，并且接口延迟抖动时间和 `FGCT` 对得上，才进入 Full GC 排查。

## 第二步：看 GC 日志

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

GC 日志里重点看：

- Full GC 触发原因。
- Full GC 前后老年代有没有下降。
- Young GC 后对象是否快速晋升。
- 是否有 Humongous Object。
- 是否有 Metadata GC Threshold。

## 老年代持续增长怎么办？

如果每次 Full GC 后老年代仍然降不下来，优先怀疑对象长期被引用：

```bash
jmap -dump:live,format=b,file=/data/dumps/live.hprof <pid>
```

用 MAT 看：

- 最大对象是谁。
- 最大集合是谁持有。
- GC Roots 路径是什么。

常见代码根因：

- 缓存无上限。
- 消息积压在内存队列。
- 大查询结果一次性加载。
- ThreadLocal 未 remove。
- 静态 Map 持有历史数据。

## Young GC 后大量晋升怎么办？

如果 Young GC 很频繁，老年代也涨得快，可能是：

- 新生代太小。
- 瞬时大对象太多。
- Survivor 放不下，提前晋升。
- 动态年龄判定导致晋升年龄降低。

可以观察对象年龄分布。JDK 8 常用：

```bash
-XX:+PrintTenuringDistribution
```

调参方向可能是增大新生代、调整 Survivor 比例、减少一次性大对象分配。但调参前要先确认分配来源，否则只是把问题延后。

## 元空间触发 Full GC 怎么办？

如果日志里看到类似 Metadata GC Threshold，要看类加载：

```bash
jstat -class <pid> 1000 5
jcmd <pid> VM.classloader_stats
```

常见根因是动态代理、脚本、热部署、ClassLoader 泄漏。

`-XX:MetaspaceSize` 不是元空间初始容量，更像触发元空间 GC 的高水位阈值。它设置太小可能导致较早触发元空间相关 GC；但根因仍然要看类加载是否异常。

## 显式 System.gc 怎么办？

有些库或代码会调用 `System.gc()`，可能触发 Full GC。可以考虑：

```bash
-XX:+DisableExplicitGC
```

但这不是万能开关。先用 GC 日志确认触发原因，再决定是否禁用。

## 小结

- 先用 `jstat` 和监控确认 Full GC 频率、耗时和业务延迟是否对应。
- GC 日志是核心证据，要看触发原因和回收前后变化。
- Full GC 后老年代不下降，重点看 heap dump 和 GC Roots。
- Young GC 后大量晋升，要看新生代、Survivor、对象年龄和分配来源。
- 元空间和显式 GC 也可能触发 Full GC，不能只盯老年代。

## 参考

综合自《JDK 监控和故障处理工具总结》《JVM 线上问题排查和性能调优案例》《JVM 垃圾回收详解》，并按线上排查顺序重组为“确认现象 → 日志证据 → 区域定位 → 根因修复”。
