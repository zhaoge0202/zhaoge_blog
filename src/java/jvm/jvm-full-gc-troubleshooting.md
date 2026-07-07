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
  text: "GC 日志怎么看？如何从日志判断问题方向？"
  link: "/java/jvm/jvm-gc-log-analysis.html"
next:
  text: "如何用 JFR、async-profiler 定位 CPU、内存分配和锁竞争问题？"
  link: "/java/jvm/jvm-performance-profiling.html"
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

排查前先保住现场：

1. 记录进程启动参数、JDK 版本、容器内存限制和当前 GC。
2. 保存 GC 日志、监控曲线、关键时间点的应用日志。
3. 确认机器磁盘空间和剩余内存，再决定是否 dump。
4. 如果是集群服务，优先摘流或在副本上取证，避免排查动作放大故障。

常用快速信息：

```bash
jcmd <pid> VM.version
jcmd <pid> VM.flags
jcmd <pid> VM.command_line
```

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

可以按触发原因先分叉：

| 日志信号                          | 优先怀疑方向                       |
| --------------------------------- | ---------------------------------- |
| `Allocation Failure` 后老年代上涨 | 分配速率高、晋升过快、新生代偏小   |
| `Metadata GC Threshold`           | 类加载多、元空间阈值低、加载器泄漏 |
| `System.gc()`                     | 显式 GC 调用、第三方库主动触发     |
| `Humongous` 相关信息              | G1 大对象多，Region 利用率差       |
| Full GC 后占用不降                | 长生命周期对象或泄漏               |
| Full GC 后占用明显下降            | 瞬时压力、批任务峰值或参数水位问题 |

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

取 dump 时要注意两点：

- `jmap -dump:live` 可能先触发一次 Full GC，会改变现场；要不要用 `live` 取决于你是想看“仍活着的对象”，还是想完整保留当时堆状态。
- dump 文件可能很大，磁盘打满会造成二次事故。生产上最好提前规划 dump 目录和保留策略。

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

定位分配来源时，可以结合：

```bash
# 粗看类实例数量变化
jcmd <pid> GC.class_histogram

# 看线程是否在集中构建大对象、批量序列化或大查询
jstack <pid> > /data/dumps/thread-$(date +%s).txt
```

如果栈里大量线程都在 JSON 序列化、大 SQL 映射、Excel 导出、批量消息拉取，就要先改分配模式，而不是只放大堆。

## 元空间触发 Full GC 怎么办？

如果日志里看到类似 Metadata GC Threshold，要看类加载：

```bash
jstat -class <pid> 1000 5
jcmd <pid> VM.classloader_stats
```

常见根因是动态代理、脚本、热部署、ClassLoader 泄漏。

`-XX:MetaspaceSize` 不是元空间初始容量，更像触发元空间 GC 的高水位阈值。它设置太小可能导致较早触发元空间相关 GC；但根因仍然要看类加载是否异常。

`-XX:MaxMetaspaceSize` 则是上限保护。没有上限时，元空间增长会继续吃本地内存；有上限时，异常类加载更容易以 OOM 暴露。两者都不是“修复类加载泄漏”的手段，只是让问题更早暴露或控制影响范围。

## 显式 System.gc 怎么办？

有些库或代码会调用 `System.gc()`，可能触发 Full GC。可以考虑：

```bash
-XX:+DisableExplicitGC
```

但这不是万能开关。先用 GC 日志确认触发原因，再决定是否禁用。

如果依赖堆外内存或直接缓冲区清理，禁用显式 GC 前要验证相关组件行为。某些老代码可能把 `System.gc()` 当成堆外资源释放的兜底，这种设计本身不健康，但直接禁用也可能改变故障表现。

## 直接内存和线程栈要不要算进来？

要看，但不要默认归因成老年代 Full GC。

直接内存、线程栈、元空间都属于进程内存的一部分。容器 RSS 飙高、进程被 OOM Kill，不一定是 Java 堆老年代打满。比如 Netty 直接缓冲区泄漏、线程数量暴涨，可能主要消耗本地内存。

可以补充看：

```bash
# 看线程数量和栈现场
jstack <pid> | head

# 如果启动了 Native Memory Tracking，可看本地内存分类
jcmd <pid> VM.native_memory summary
```

这类问题更容易和 OOM、容器内存限制相关。Full GC 篇里只需要记住：当 `jstat` 里堆并不高，但进程 RSS 很高时，要跳出“老年代 Full GC”的单一路径。

## 排查顺序怎么串起来？

可以按这条链路走：

```text
确认现象
  ↓
jstat/监控确认 FGC 是否增长
  ↓
GC 日志看触发原因和回收前后变化
  ↓
老年代不降？取 dump 看 GC Roots
  ↓
晋升过快？看年龄分布、Survivor、分配来源
  ↓
元空间触发？看 class 和 ClassLoader
  ↓
显式 GC？定位调用方和组件依赖
  ↓
最后才调参数或更换 GC
```

这条顺序的核心是先找证据，再谈方案。频繁 Full GC 往往是结果，不是根因。

## 小结

- 先用 `jstat` 和监控确认 Full GC 频率、耗时和业务延迟是否对应。
- GC 日志是核心证据，要看触发原因和回收前后变化。
- Full GC 后老年代不下降，重点看 heap dump 和 GC Roots。
- Young GC 后大量晋升，要看新生代、Survivor、对象年龄和分配来源。
- 元空间和显式 GC 也可能触发 Full GC，不能只盯老年代。

## 参考

基于 Oracle Java SE Documentation、OpenJDK JEP、HotSpot VM 文档与 JDK 工具官方文档中 JVM、GC、类加载、监控与诊断相关内容整理。
