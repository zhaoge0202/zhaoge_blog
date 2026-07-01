---
title: "线上 OOM 怎么定位？"
description: "按现象保留、内存区域判断、dump 分析和止血复盘讲清 OOM 排查。"
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
  text: "G1、ZGC、Shenandoah 分别适合什么场景？"
  link: "/java/jvm/jvm-g1-zgc-shenandoah-scenarios.html"
next:
  text: "频繁 Full GC 怎么排查？"
  link: "/java/jvm/jvm-full-gc-troubleshooting.html"
---

# 线上 OOM 怎么定位？

> OOM 排查的第一步不是调大内存，而是保留现场、判断区域、拿证据，再决定止血和根因修复。

## 先分清是哪一种 OOM

线上说“OOM”时，至少可能指三类问题：

| 现象                                     | 关键区别                   | 先看哪里                                |
| ---------------------------------------- | -------------------------- | --------------------------------------- |
| Java 抛 `java.lang.OutOfMemoryError`     | JVM 主动抛异常，通常有堆栈 | 应用日志、heap dump、GC 日志            |
| 容器显示 `OOMKilled`                     | 进程被容器或内核杀掉       | 容器事件、`dmesg`、RSS、cgroup 内存限制 |
| 机器内存紧张但 Java 堆不高，进程还在运行 | 可能是堆外、线程栈、元空间 | NMT、线程数、直接内存、进程 RSS         |

这三类问题不能混着查。Java heap dump 能解释堆对象为什么多，但解释不了所有本地内存问题；容器 OOMKilled 也不一定会留下 Java 异常栈。

## 排查链路怎么走？

可以按这条链路收敛：

```text
保留现场
  ↓
确认是 Java OOM、容器 OOMKilled，还是 RSS 异常
  ↓
根据错误信息判断内存区域
  ↓
低侵入采样：jstat / jcmd / jstack / GC 日志 / 监控
  ↓
必要时 dump：heap dump、线程栈、NMT
  ↓
先止血：摘流、扩容、限流、回滚、重启
  ↓
再修根因：泄漏、无界缓存、线程失控、大对象、参数预算
```

这条链路的重点是：先把证据留下来，再做会改变现场的动作。比如重启、扩容和 `jmap -dump:live` 都可能让原始状态消失。

## 现场要保留哪些东西？

线上 OOM 最怕进程被重启后什么证据都没了。生产 JVM 建议提前加：

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/data/dumps/
-XX:+ExitOnOutOfMemoryError
```

`ExitOnOutOfMemoryError` 是否开启要看部署体系：如果有容器或守护进程自动拉起，失败退出比半死不活更可控。

如果进程还活着，先拿基础信息：

```bash
jps -lv
jcmd <pid> VM.version
jcmd <pid> VM.flags
jcmd <pid> VM.command_line
jcmd <pid> GC.heap_info
jstat -gcutil <pid> 1000 10
```

还要同步确认三件事：

1. dump 目录磁盘空间是否足够，堆很大时 dump 文件也会很大。
2. 进程是否在核心链路上，必要时先摘流到副本再取证。
3. OOM 前后的监控时间点，包括堆、非堆、RSS、GC、线程数、接口耗时。

## 根据错误信息判断内存区域

不同错误指向不同区域：

| 错误信息                                   | 常见方向                                | 第一手证据                    |
| ------------------------------------------ | --------------------------------------- | ----------------------------- |
| `Java heap space`                          | 堆对象过多、缓存/集合膨胀、查询结果过大 | heap dump、GC 日志            |
| `GC overhead limit exceeded`               | GC 很努力但回收效果很差                 | Full GC 前后堆变化、分配速率  |
| `Requested array size exceeds VM limit`    | 单个数组或集合申请过大                  | 异常栈、请求参数、批量大小    |
| `Metaspace`                                | 动态类太多、类加载器泄漏                | 类加载数量、ClassLoader 统计  |
| `Direct buffer memory`                     | NIO 直接内存泄漏或上限不足              | NMT、直接内存指标、组件指标   |
| `unable to create new native thread`       | 线程数过多、栈空间或系统限制            | 线程栈、线程数、`ulimit`/pids |
| 容器 `OOMKilled`，Java 日志里没有 OOM 异常 | 进程 RSS 超过容器限制                   | 容器事件、cgroup、系统日志    |

不要只看 heap dump。直接内存、线程栈、元空间都可能让进程 RSS 很高，但 heap dump 看起来不大。

## 堆 OOM：是泄漏还是瞬时峰值？

堆 OOM 优先拿 dump：

```bash
jmap -dump:live,format=b,file=/data/dumps/app.hprof <pid>
```

线上执行 `jmap` 可能触发停顿，尤其大堆服务要谨慎。`-dump:live` 通常会先做一次 Full GC，只保留仍然存活的对象，适合看泄漏，但也会改变现场。如果想完整保留当时堆状态，可以不用 `live`，或者更依赖 OOM 自动 dump。

拿到 dump 后用 MAT、VisualVM、JProfiler 等工具看：

- Dominator Tree：谁占用内存最多。
- Leak Suspects：可能泄漏链。
- GC Roots Path：对象为什么还活着。
- 大集合、大 Map、大 byte[]、大 String 是否异常。

堆 OOM 不一定都是“泄漏”，要先区分两种模式：

| 模式         | 典型表现                               | 修复方向                          |
| ------------ | -------------------------------------- | --------------------------------- |
| 长期泄漏     | Full GC 后堆仍降不下来，对象被稳定引用 | 找 GC Roots，清理引用链和生命周期 |
| 瞬时分配峰值 | 某个时间段请求、批任务或导出造成堆顶满 | 限制批量、分页、流式处理、削峰    |

典型根因包括：

- 本地缓存没有容量上限。
- 一次查出过多数据。
- ThreadLocal 没清理。
- 异步队列堆积。
- 大对象反复创建，晋升老年代。
- JSON/Excel/报表导出把全量数据聚合到内存。

如果错误是 `GC overhead limit exceeded`，重点不是“GC 触发了 OOM”，而是 JVM 把大部分时间都耗在 GC 上，但每次只能回收很少空间。它通常说明堆里有大量仍被引用的对象，或者分配速率远高于回收能力。

## 元空间 OOM 怎么分析？

`Metaspace` OOM 重点看类加载数量和 ClassLoader 是否泄漏：

```bash
jcmd <pid> VM.classloader_stats
jstat -class <pid> 1000 5
```

常见原因：

- 动态代理/CGLIB 持续生成新类。
- 脚本引擎反复加载类。
- 热部署后旧 ClassLoader 被线程、静态变量或缓存持有。

临时止血可以设置或调整上限：

```bash
-XX:MaxMetaspaceSize=512m
```

但这只是影响暴露方式：上限太小会更早 OOM；没有上限则可能继续吃本地内存。根因还是要找到为什么类卸不掉，或者为什么动态类持续生成。

`MetaspaceSize` 也容易被误解，它更像元空间触发 GC 的高水位阈值，不是“预分配这么多元空间”。如果元空间增长导致频繁 Full GC，要同时看 `MetaspaceSize`、类加载数量和加载器引用链。

## 直接内存和 RSS 异常怎么分析？

如果错误是 `Direct buffer memory`，关注 NIO、Netty、文件传输、堆外缓存。

如果进程 RSS 很高但 Java 堆不高，也要把直接内存、线程栈、元空间、Code Cache 和 native 库内存算进去。可用：

```bash
jcmd <pid> VM.native_memory summary
```

前提是启动时开了：

```bash
-XX:NativeMemoryTracking=summary
```

如果要做更细的本地内存对比，可以在可接受开销的前提下使用 `detail`，并在问题前后做 baseline/diff：

```bash
jcmd <pid> VM.native_memory baseline
jcmd <pid> VM.native_memory detail.diff
```

还要看是否设置了：

```bash
-XX:MaxDirectMemorySize=512m
```

Netty 场景还要结合 allocator 指标和是否存在 ByteBuf 未释放。不要只靠 heap dump 判断，因为 DirectByteBuffer 的 Java 对象很小，真正占用的是本地内存。

## 线程创建失败怎么查？

`unable to create new native thread` 往往不是堆满，而是线程太多、每个线程栈太大，或系统/容器限制太低。

先拿线程现场：

```bash
jcmd <pid> Thread.print > /data/dumps/thread.txt
ps -eLf | grep <pid> | wc -l
```

再看限制：

```bash
cat /proc/<pid>/limits
cat /sys/fs/cgroup/pids.max 2>/dev/null
```

常见根因：

- 线程池没有上限，外部依赖慢导致线程堆积。
- 定时任务或异步任务反复创建线程。
- `-Xss` 设得过大，同样内存下能创建的线程数变少。
- 容器 `pids` 限制或系统 `ulimit -u` 太小。

临时调小 `-Xss` 可能缓解线程上限，但不能替代线程池治理。真正要修的是阻塞点、线程池边界和任务堆积。

## 止血和根因修复要分开

线上事故里，先恢复服务和最终修复是两件事：

| 动作           | 作用             | 风险或边界                     |
| -------------- | ---------------- | ------------------------------ |
| 摘流/降级/限流 | 降低分配速率     | 只能缓解，不能解释为什么泄漏   |
| 扩容或调大内存 | 拉长崩溃时间     | 可能掩盖泄漏，让下次事故更大   |
| 回滚版本       | 快速回到稳定状态 | 需要保留新版本现场，否则难复盘 |
| 重启进程       | 释放内存         | 会清空现场，重启前尽量取证     |
| 修代码/调参数  | 解决根因         | 必须通过压测、灰度和监控验证   |

复盘时至少补齐这些项：

1. 是否提前配置了 GC 日志和 OOM dump。
2. dump 路径是否有足够空间，文件是否被采集和归档。
3. 堆、非堆、RSS、线程数是否都有告警水位。
4. 是否能在压测或回放环境复现分配模式。
5. 修复后 Full GC、老年代、线程数和接口 P99 是否回到基线。

## 小结

- OOM 先分清 Java 异常、容器 OOMKilled 和 RSS 异常，不能所有问题都按堆泄漏处理。
- 排查顺序是保留现场、判断区域、低侵入采样、必要时 dump，再止血和修根因。
- 堆 OOM 要区分长期泄漏和瞬时峰值，核心证据是 heap dump、GC Roots 和 GC 前后变化。
- 元空间、直接内存、线程栈都属于进程内存预算，heap dump 不能解释全部 OOM。
- 扩容、重启、摘流是止血手段，最终还要回到代码生命周期、容量边界和参数预算。

## 参考

基于 Oracle Java SE Documentation、OpenJDK JEP、HotSpot VM 文档与 JDK 工具官方文档中 JVM、GC、类加载、监控与诊断相关内容整理。
