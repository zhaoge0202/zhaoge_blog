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

## 调优前先定目标和闭环

调 JVM 参数之前，先明确目标：

- 是降低接口 P99 延迟？
- 是减少 Full GC？
- 是避免 OOM？
- 是提升批处理吞吐？
- 是适配容器内存限制？

没有目标的调参只是碰运气。一个更稳的闭环是：

```text
明确目标
  ↓
记录基线：QPS、P99、GC 次数/耗时、堆/非堆/RSS、线程数
  ↓
确认当前 JVM 参数、JDK 版本和容器限制
  ↓
一次只改一类参数
  ↓
压测或灰度验证
  ↓
对比基线，保留回滚方案
```

最忌讳的是一次改一大串参数。指标变好了也不知道是谁起作用，变差了也不知道该回滚哪一项。

## 先拿到运行时事实

很多线上问题不是“参数不会调”，而是“以为参数生效了”。不要只看启动脚本，先确认运行中 JVM 的真实状态：

```bash
jps -lv
jcmd <pid> VM.version
jcmd <pid> VM.flags
jcmd <pid> VM.command_line
jcmd <pid> GC.heap_info
jcmd <pid> VM.metaspace
```

如果要看某个参数的最终值，可以用：

```bash
jinfo -flag MaxHeapSize <pid>
java -XX:+PrintFlagsFinal -version | grep MaxHeapSize
```

`VM.command_line` 更接近启动命令，`VM.flags` 能看到显式和部分最终标志，`PrintFlagsFinal` 适合在同版本、同容器限制下验证默认值。容器环境尤其要看实际运行时限制，不要只看宿主机内存。

## 先做内存预算，再谈堆大小

容器或机器内存不是只给 Java 堆。一个服务的内存大致可以按这条式子理解：

```text
进程内存预算
= Java Heap
+ Metaspace
+ Direct Memory
+ Thread Stack
+ Code Cache
+ JVM/native 其他开销
+ 操作系统和监控探针余量
```

所以容器限制 4G 时，`-Xmx4g` 往往是不合理的。堆满前，直接内存、线程栈、元空间或 native 分配就可能把 RSS 推到限制线，然后被容器杀掉。

一个粗略例子：

| 项目               | 估算方式或配置                     |
| ------------------ | ---------------------------------- |
| Java 堆            | `-Xms2g -Xmx2g`                    |
| 元空间             | `-XX:MaxMetaspaceSize=256m`        |
| 直接内存           | `-XX:MaxDirectMemorySize=512m`     |
| 线程栈             | `线程数 × -Xss`                    |
| Code Cache         | `-XX:ReservedCodeCacheSize=256m`   |
| 其他 native 和余量 | JIT、GC、类加载、JNI、系统页缓存等 |

这个估算不需要一开始特别精确，但必须把非堆算进去。

## 堆大小：`-Xms` 和 `-Xmx`

常见建议是把初始堆和最大堆设成一样：

```bash
-Xms4g -Xmx4g
```

这样能避免运行时堆扩缩容带来的额外抖动。

但堆不是越大越好。堆大了可以减少 GC 频率，也可能增加进程内存占用；堆太小则容易频繁 GC、对象过早晋升，甚至 OOM。不同收集器的停顿模型不同，不要把“堆大一定停顿久”说成绝对结论。

堆大小要结合这些证据：

- Full GC 后老年代是否仍然很高。
- Young GC 是否过于频繁。
- 对象分配速率是否超过回收能力。
- 容器 RSS 是否逼近限制。
- P99 延迟是否和 GC 停顿时间对应。

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

`MaxTenuringThreshold` 只是最大晋升年龄阈值之一，不代表对象一定要熬满这个次数才会进入老年代。对象是否晋升还受 Survivor 空间、目标 Survivor 使用率、对象年龄分布和收集器自适应策略影响。

判断新生代是否合适，主要看：

- Young GC 频率和单次停顿是否可接受。
- Young GC 后是否有大量对象晋升老年代。
- Survivor 是否经常放不下，导致提前晋升。
- 大对象是否绕过常规新生代路径，直接压老年代或 G1 Humongous Region。

如果只是偶发峰值，先考虑削峰、分页、流式处理；如果是长期高分配，再考虑新生代、Survivor 或业务对象生命周期。

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

调大元空间只能止血，不能修复类加载器泄漏。动态代理、脚本引擎、热部署、插件化框架都可能持续生成或持有类。

## 直接内存、线程栈和 Code Cache 也要管

很多生产内存问题不是 Java 堆导致的。

直接内存常见于 NIO、Netty、文件传输和堆外缓存：

```bash
-XX:MaxDirectMemorySize=512m
```

如果不显式限制，默认行为和 JDK 版本、启动参数、实现细节有关，线上不要靠猜。直接内存泄漏时，堆 dump 里可能只看到很小的 Java wrapper，对应的本地内存才是真正大头。

如果要看本地内存分类，需要提前开启：

```bash
-XX:NativeMemoryTracking=summary
jcmd <pid> VM.native_memory summary
```

线程栈由 `-Xss` 控制：

```bash
-Xss512k
```

`-Xss` 调大可以容纳更深调用栈，但同样内存限制下能创建的线程更少；调小可以容纳更多线程，但递归、复杂调用链更容易栈溢出。线程数暴涨时，优先治理线程池、阻塞点和队列，而不是只调小栈。

Code Cache 存放 JIT 编译后的机器码，极端情况下也会成为非堆预算的一部分：

```bash
-XX:ReservedCodeCacheSize=256m
```

普通业务很少先调 Code Cache，但做完整内存预算时要知道它存在。

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
- JDK 9 起服务端配置默认 G1，生产仍以 `VM.flags` 确认为准。
- CMS 在 JDK 9 标记废弃，并在 JDK 14 移除。
- ZGC/Shenandoah 需要看 JDK 版本和发行版支持。

如果用 G1，常见目标参数：

```bash
-XX:MaxGCPauseMillis=200
```

这是目标，不是硬保证。设得越低，GC 越可能更频繁，吞吐也可能下降。

收集器调优要围绕取舍：

| 目标         | 更关注什么                      | 常见代价               |
| ------------ | ------------------------------- | ---------------------- |
| 高吞吐       | 总执行效率、CPU 利用率          | 单次停顿可能更长       |
| 低延迟       | STW 时间、P99/P999              | CPU 和内存开销可能上升 |
| 大堆稳定性   | 并发回收、Region 管理、碎片控制 | 参数和版本边界更复杂   |
| 小服务低成本 | 简单、占用低、启动快            | 不追求复杂低延迟能力   |

不要因为“某个 GC 更新”就盲目切换。先看 JDK 版本、堆大小、停顿目标、CPU 余量和压测结果。

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

GC 日志不只是“开了就行”，还要知道看什么：

- Young GC 频率、单次停顿和总耗时。
- 每次 GC 后老年代、元空间是否下降。
- 对象晋升量、年龄分布和 Survivor 压力。
- Full GC 触发原因，比如显式 GC、元空间阈值、分配失败。
- G1 下是否有 Humongous 对象、to-space 不足或 mixed GC 追不上。
- safepoint 停顿是否来自 GC 以外的原因。

这些参数最好在服务上线前就配置好。事故发生后再补日志，通常只能看到下一次故障。

## 容器里还要注意什么？

容器内存不是只给堆。比如容器限制 4G，如果 `-Xmx` 也设 4G，直接内存、线程栈、元空间一增长，就可能被 OOM Killer 杀掉。

可以给非堆留空间，或者用百分比参数控制堆：

```bash
-XX:MaxRAMPercentage=70
-XX:InitialRAMPercentage=70
```

这里的百分比主要影响 Java heap，不是整个 JVM 进程上限。70% 也不是通用推荐值，实际比例要结合线程数、直接内存、元空间、业务峰值压测来定。`InitialRAMPercentage` 设得过高，还可能影响启动速度、弹性扩缩容和多实例密度。

容器里还要注意版本边界：较新的 JDK 通常能感知容器内存限制，JDK 8 的不同更新版本差异较大。上线前要在同样镜像、同样限制下用 `jcmd` 或 `PrintFlagsFinal` 确认最终堆大小，而不是按宿主机内存推断。

如果服务依赖大量线程或直接内存，`MaxRAMPercentage` 不能简单设得很高。堆比例越高，非堆和系统余量越小。

## `DisableExplicitGC` 能不能直接开？

显式 GC 常见参数：

```bash
-XX:+DisableExplicitGC
```

它可以阻止代码或第三方库通过 `System.gc()` 触发显式 Full GC，但不应该无脑开启。先用 GC 日志确认 Full GC 触发原因确实和显式 GC 有关，再评估组件是否依赖显式 GC 作为堆外资源清理兜底。

如果根因是老年代对象泄漏、元空间泄漏或分配速率过高，开这个参数不会解决问题，只是改变故障表现。

## 常见反模式有哪些？

JVM 调优最容易踩这些坑：

- 没有 GC 日志和监控，只靠感觉改参数。
- 一次改很多参数，无法判断效果来源。
- 只看 heap dump，不看 RSS、线程数、直接内存和容器事件。
- 看到 OOM 就调大 `-Xmx`，没有判断泄漏还是瞬时峰值。
- 把 `MetaspaceSize` 当成元空间初始容量。
- 在 G1 下强行套老年代/新生代固定比例经验。
- 线上直接手动 dump 大堆，不先确认磁盘、停顿和副本隔离。

## 小结

- JVM 调优是目标、基线、单变量变更、压测/灰度和回滚的闭环，不是参数堆砌。
- 内存预算要把堆、元空间、直接内存、线程栈、Code Cache 和 native 开销一起算。
- `-Xms/-Xmx` 决定堆容量边界，堆越大不一定越稳，必须结合 GC 和延迟指标。
- `MetaspaceSize` 更像元空间 GC 高水位，`MaxMetaspaceSize` 才是上限保护。
- 生产必须提前配置 GC 日志和 OOM dump，容器里还要验证最终生效参数。

## 参考

基于 Oracle Java SE Documentation、OpenJDK JEP、HotSpot VM 文档与 JDK 工具官方文档中 JVM、GC、类加载、监控与诊断相关内容整理。
