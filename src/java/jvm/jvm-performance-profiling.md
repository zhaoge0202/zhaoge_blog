---
title: "如何用 JFR、async-profiler 定位 CPU、内存分配和锁竞争问题？"
description: "从采样、火焰图和事件记录讲清 Java 性能诊断的证据链。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "排障"
  - "项目实战"
  - "进阶"
prev: { text: "频繁 Full GC 怎么排查？", link: "/java/jvm/jvm-full-gc-troubleshooting.html" }
next: { text: "JVM 参数调优到底在调什么？", link: "/java/jvm/jvm-parameters-tuning.html" }
---

# 如何用 JFR、async-profiler 定位 CPU、内存分配和锁竞争问题？

> 性能诊断不是先猜代码哪里慢，而是先采样拿证据，再把 CPU、分配、锁等待和 IO 等信号串成闭环。

## 先把问题类型分清楚

线上说“接口慢”“CPU 高”“偶发卡顿”，其实可能是完全不同的问题：

| 现象               | 优先看什么        | 常见证据                                   |
| ------------------ | ----------------- | ------------------------------------------ |
| CPU 使用率高       | CPU 采样          | 热点方法、 native 调用、GC/JIT 线程        |
| RT 变长但 CPU 不高 | wall/JFR 阻塞事件 | Socket/File IO、`ThreadPark`、锁等待       |
| Young GC 很频繁    | 分配采样          | 哪些调用链在持续制造对象                   |
| 偶发长尾           | JFR 事件时间线    | GC、锁、IO、异常、线程阻塞是否同一时间发生 |
| 锁竞争明显         | lock profiling    | 等哪把锁、哪条调用链进入锁最慢             |

`top`、`jstack`、`jstat` 适合快速判断方向，但它们更像“体温计”。要定位热点方法、分配来源和锁竞争调用链，还需要 JFR 或 async-profiler 这类采样工具。

## JFR 适合记录什么证据

JFR（Java Flight Recorder）是 JDK 自带的低开销事件记录能力。它不是只看 CPU 栈，而是把 JVM 和应用运行时发生的事件记录下来，比如：

- 方法执行采样：CPU 热点在哪里。
- 对象分配：哪些类型、哪些调用链在制造对象。
- GC：暂停、阶段耗时、堆变化。
- 锁与线程：`JavaMonitorEnter`、`ThreadPark`、`ThreadSleep`。
- IO：文件读写、Socket 读写耗时。
- 异常：异常抛出频率是否异常。

一个常见的线上短采样流程：

```bash
jcmd <pid> JFR.start name=profile settings=profile duration=60s filename=/tmp/app.jfr
jcmd <pid> JFR.dump name=profile filename=/tmp/app-now.jfr
jcmd <pid> JFR.stop name=profile filename=/tmp/app-final.jfr
```

也可以用 `jfr` 命令在服务器上先做文本化筛选：

```bash
jfr summary /tmp/app.jfr
jfr print --events jdk.ExecutionSample,jdk.JavaMonitorEnter,jdk.SocketRead /tmp/app.jfr
```

JFR 的优势是证据完整：一次记录里既能看到热点代码，也能看到 GC、IO、线程阻塞和锁等待。它很适合回答“慢的时候 JVM 到底在经历什么”。

## async-profiler 适合抓什么热点

async-profiler 是低开销采样 profiler，常用来生成 CPU、分配和锁竞争火焰图。它能看到 Java 栈，也能看到 native/JVM/kernel 栈，因此比单纯 `jstack` 更适合定位热点。

常用命令：

```bash
# CPU 火焰图，默认就适合先粗看热点
asprof -d 30 -f cpu.html <pid>

# 分配火焰图，找堆分配压力最大的调用链
asprof -e alloc -d 30 -f alloc.html <pid>

# 锁竞争火焰图，按线程等待进入锁的时间聚合
asprof -e lock -t -i 5ms -d 30 -f lock.html <pid>

# 同时采 CPU、分配、锁，输出 JFR 方便后续分析
asprof -e cpu,alloc,lock -d 60 -f profile.jfr <pid>
```

几个事件的含义要分清：

- `cpu`：线程真正占用 CPU 的采样，适合定位计算热点。
- `alloc`：堆分配采样，适合定位 GC 压力来源，不等于“最终泄漏对象”。
- `lock`：Java monitor 竞争，计数通常代表等待进入锁花掉的时间。
- `wall`：按墙钟时间采样所有线程，适合接口慢但 CPU 不高的阻塞型问题。

## 火焰图到底怎么看

火焰图最容易被误读。记住三点就够：

1. 横向宽度代表采样占比，不代表某一次调用耗时。
2. 纵向高度代表调用栈深度，高不等于慢。
3. 顶部宽块通常是直接消耗 CPU、分配对象或等待锁的地方，但是否是问题要结合业务预期。

举个例子：CPU 火焰图里 `JsonParser.parse` 很宽，说明采样期间很多 CPU 时间落在解析 JSON 上。它可能是 bug，也可能只是流量高、请求体大导致的正常热点。下一步要看 QPS、请求大小、是否重复解析、是否可缓存，而不是看到宽块就立刻改代码。

分配火焰图也一样。`StringBuilder.toString` 很宽，不代表泄漏，只说明这条链路制造了大量短命对象。是否需要优化，要结合 [GC 日志](/java/jvm/jvm-gc-log-analysis.html) 看 Young GC 频率、停顿和分配速率。

## CPU 高怎么查

CPU 高时可以按这个顺序走：

1. 用 `top -Hp <pid>` 看是不是 Java 进程内某些线程占 CPU。
2. 用 `jstack <pid>` 粗看高 CPU 线程是否在明显循环或 GC/JIT。
3. 用 async-profiler 抓 30 到 60 秒 CPU 火焰图。
4. 如果问题伴随 GC、IO 或线程状态变化，再补 JFR。

示例命令：

```bash
asprof -e cpu -d 45 -f /tmp/cpu.html <pid>
```

看结果时重点找：

- 是否是业务方法占比高，比如序列化、加解密、正则、排序。
- 是否是 JVM/native 栈明显，比如 GC、JIT、类加载。
- 是否是少数接口或批任务触发，而不是全站常态。

如果只用 `jstack`，你拿到的是某一瞬间线程栈；如果循环很短、热点切换很快，单次栈很容易误判。采样火焰图的价值就在于把一段时间内的栈聚合起来。

## 分配速率高怎么查

分配速率高通常表现为 Young GC 频繁、CPU 被 GC 吃掉、接口延迟抖动。先用 [GC 日志](/java/jvm/jvm-gc-log-analysis.html) 或 `jstat -gcutil` 判断是不是分配压力，再抓分配火焰图：

```bash
asprof -e alloc -d 60 -f /tmp/alloc.html <pid>
```

常见根因：

- 请求链路里重复创建大集合、临时对象、JSON 中间对象。
- 日志拼接、异常栈、正则、日期格式化导致对象爆炸。
- 缓存未命中后批量加载，制造短时间分配尖峰。
- Stream/Lambda 写法过度装箱、拆箱或中间集合过多。

分配火焰图回答的是“谁在分配”，不是“谁泄漏”。如果 Full GC 后老年代降不下来，再结合 heap dump 去看长期存活对象。

## 锁竞争和阻塞怎么查

锁竞争的现象经常是 CPU 不高，但接口 RT 抖动。先看 JFR：

- `jdk.JavaMonitorEnter`：等待进入 monitor。
- `jdk.ThreadPark`：线程 park，例如 AQS、线程池队列、`LockSupport`。
- `jdk.SocketRead` / `jdk.FileRead`：线程在 IO 上等待。

再用 async-profiler 针对锁抓图：

```bash
asprof -e lock -t -i 5ms -d 60 -f /tmp/lock.html <pid>
```

排查时要区分三种情况：

- 业务锁太粗：比如整个订单处理方法都被 `synchronized` 包住。
- 下游慢导致线程堆积：看起来都卡在锁或 park，其实根因是远程调用慢。
- 线程池资源不足：大量任务在队列或 Future 等待，表现为 `ThreadPark` 增多。

锁火焰图里的宽块表示很多等待时间聚合在这条链路上。它不是说持锁代码每次都很慢，而是这段采样期间线程总共在这里等了很多时间。

## 诊断闭环怎么落地

一次靠谱的性能诊断至少要闭环四步：

```text
现象确认
  ↓
采样取证
  ↓
定位代码/参数/资源瓶颈
  ↓
修复后复测同一指标
```

不要只保留一个火焰图截图。最好把这些信息一起保存：

- 采样时间、机器、JDK 版本、流量背景。
- 命令参数和输出文件。
- 同时间段的监控：CPU、RT、QPS、GC、线程数。
- 代码版本和配置版本。
- 修复前后的对比图或对比指标。

这样你才能回答“为什么确定是这里的问题”，而不是“我感觉这块很可疑”。

## 容易踩的坑

- CPU 高就只看 `top + jstack` 不够，单次栈只能粗定位，热点方法要靠时间窗口内的采样。
- 火焰图最宽的栈不一定是 bug，它只是采样占比高，还要结合业务预期和流量。
- 分配火焰图不是泄漏报告，它主要说明堆分配压力来源。
- JFR 里的事件阈值会影响结果，短时间、低于阈值的阻塞可能不会被记录。
- 线上采样要控制时长和范围，Heap Statistics 这类更重的能力不要随手开。

## 小结

1. JFR 更像事件黑匣子，适合把 CPU、GC、锁、IO、异常放在同一条时间线上看。
2. async-profiler 更适合抓热点火焰图，CPU、alloc、lock、wall 分别对应不同问题。
3. 火焰图宽度代表采样占比，不代表单次调用耗时，不能脱离业务预期解释。
4. 分配采样定位的是“谁制造对象”，泄漏还要看 Full GC 后存活对象和 heap dump。
5. 性能优化必须复测同一指标，否则只是把猜测写成了结论。

## 参考

综合自本地资料《JDK 监控和故障处理工具总结》《JVM 实战》，并对照 Oracle JDK 25 Troubleshooting Guide、`jcmd` 手册和 async-profiler 4.4 文档校准了 JFR 命令、采样模式和火焰图解释。
