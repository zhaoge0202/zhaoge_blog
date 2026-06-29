---
title: "JVM 参数调优到底在调什么？"
description: "从堆、元空间、GC、日志和容器限制讲清 JVM 参数调优思路。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "进阶"
  - "项目实战"
  - "排障"
prev:
  text: "频繁 Full GC 怎么排查？"
  link: "/java/jvm/jvm-full-gc-troubleshooting.html"
next:
  text: "MySQL"
  link: "/database/mysql/"
---

# JVM 参数调优到底在调什么？

> JVM 调优不是背参数大全，而是围绕容量、停顿、吞吐、日志和故障现场做可观测的取舍。

## 调优前先问目标

调 JVM 参数之前，先明确目标：

- 是降低接口 P99 延迟？
- 是减少 Full GC？
- 是避免 OOM？
- 是提升批处理吞吐？
- 是适配容器内存限制？

没有目标的调参只是碰运气。每次修改都要能用 GC 日志、监控、压测结果验证。

## 堆大小：`-Xms` 和 `-Xmx`

常见建议是把初始堆和最大堆设成一样：

```bash
-Xms4g -Xmx4g
```

这样能避免运行时堆扩缩容带来的额外抖动。

但堆不是越大越好。堆大了可以减少 GC 频率，也可能让单次回收成本更高。容器里还要给元空间、直接内存、线程栈、Code Cache、操作系统留空间。

## 新生代：调的是分配和晋升

新对象通常先进入新生代。新生代太小，Young GC 频繁；Survivor 太小，对象容易提前晋升老年代。

常见参数：

```bash
-Xmn1g
-XX:NewRatio=2
-XX:SurvivorRatio=8
-XX:MaxTenuringThreshold=15
```

但现代 G1 下，不一定建议强行固定新生代大小，因为 G1 会根据停顿目标动态调整年轻代 Region 数量。调参要结合使用的收集器。

## 元空间：不要误解 MetaspaceSize

常见参数：

```bash
-XX:MetaspaceSize=128m
-XX:MaxMetaspaceSize=512m
```

`MetaspaceSize` 不是“初始元空间容量”，更接近首次触发元空间 GC 的高水位。设置 `MaxMetaspaceSize` 是为了防止类加载异常时把本地内存吃光。

如果出现 `Metaspace` OOM，别只调大，先看：

```bash
jcmd <pid> VM.classloader_stats
jstat -class <pid> 1000 5
```

## 收集器：调的是目标取舍

常见选择：

```bash
-XX:+UseG1GC
-XX:+UseParallelGC
-XX:+UseZGC
-XX:+UseShenandoahGC
```

选择时要带 JDK 版本：

- JDK 8 常见默认 Parallel。
- JDK 9+ 默认 G1。
- CMS 已废弃并在 JDK 14 移除。
- ZGC/Shenandoah 需要看 JDK 版本和发行版支持。

如果用 G1，常见目标参数：

```bash
-XX:MaxGCPauseMillis=200
```

这是目标，不是硬保证。设得越低，GC 越可能更频繁，吞吐也可能下降。

## 日志和现场：这是生产必备参数

没有 GC 日志，调优基本是在猜。

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

OOM 现场：

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/data/dumps/
```

## 容器里还要注意什么？

容器内存不是只给堆。比如容器限制 4G，如果 `-Xmx` 也设 4G，直接内存、线程栈、元空间一增长，就可能被 OOM Killer 杀掉。

更稳的做法是给非堆留空间，或者用百分比参数：

```bash
-XX:MaxRAMPercentage=70
-XX:InitialRAMPercentage=70
```

实际比例要结合线程数、直接内存、元空间、业务峰值压测来定。

## 小结

- JVM 调优先定目标，再用日志和监控验证，不要背参数乱调。
- `-Xms/-Xmx` 控制堆容量和扩缩容，堆不是越大越好。
- 新生代参数影响 Young GC、对象晋升和老年代压力。
- `MetaspaceSize` 不是初始容量，`MaxMetaspaceSize` 用来限制元空间上限。
- 生产必须配置 GC 日志和 OOM dump，容器里还要给非堆内存留空间。

## 参考

综合自《最重要的 JVM 参数总结》《JDK 监控和故障处理工具总结》《JVM 线上问题排查和性能调优案例》，并按 JDK 8/JDK 11+ 日志差异、元空间参数误区和容器内存边界做了重写。
