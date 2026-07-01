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

## 先别问哪个更先进，先问服务怕什么

GC 选型不是排行榜。一个订单服务、一个离线导出任务、一个推荐召回服务，对 GC 的痛点完全不同。

先把这几个问题问清楚：

- 服务更关注吞吐还是 P99 延迟？
- 堆多大，老年代常态占用多高？
- JDK 版本和发行版是什么？
- CPU 是否紧张，GC 线程能不能抢到时间片？
- 对短暂停顿、偶发长停顿、吞吐下降分别能接受到什么程度？

如果这些条件不清楚，直接说“用 ZGC”或“用 G1”都不严谨。低延迟 GC 能把 STW 压得很短，但它要用并发线程、读写屏障和更多运行时机制换取这个结果；CPU 本来就打满的服务，贸然切过去可能只是把停顿问题换成吞吐问题。

## 三者怎么定位？

| 收集器     | 典型定位          | 更适合的场景                              | 主要代价与边界                       |
| ---------- | ----------------- | ----------------------------------------- | ------------------------------------ |
| G1         | 通用服务端 GC     | 中等堆、普通 Web/RPC 服务、希望停顿可控   | 停顿目标不是硬保证，极低延迟不一定够 |
| ZGC        | 可扩展低延迟 GC   | 大堆、延迟敏感、不能接受长时间 STW 的服务 | 需要较新 JDK，关注 CPU 与分配速率    |
| Shenandoah | 低停顿并发压缩 GC | 延迟敏感、希望把移动整理也并发化的服务    | 要确认发行版支持，调优资料相对更分散 |

G1 通过 Region、Mixed GC 和停顿预测，在吞吐和停顿之间做平衡。它适合大多数常规后端服务，因为维护成本低、默认行为稳、资料和排障经验也多。

ZGC 和 Shenandoah 的目标更激进：尽量把标记、整理、转移这些工作并发化，让应用线程只在很短的阶段暂停。它们不是“更快的 G1”，而是拿更多并发开销换更短停顿。

## 版本边界怎么说才不露怯？

版本边界是 GC 选型里很容易答错的点。

| 时间线 | 关键变化                                                        |
| ------ | --------------------------------------------------------------- |
| JDK 9  | G1 成为 HotSpot 服务端默认 GC。                                 |
| JDK 11 | ZGC 作为实验特性进入 JDK。                                      |
| JDK 12 | Shenandoah 作为实验特性进入 JDK。                               |
| JDK 15 | ZGC 和 Shenandoah 都转为生产可用特性。                          |
| JDK 21 | 引入分代 ZGC，可通过 `-XX:+UseZGC -XX:+ZGenerational` 启用。    |
| JDK 23 | `-XX:+UseZGC` 默认使用分代 ZGC，非分代模式开始走向移除。        |
| JDK 24 | ZGC 非分代模式被移除，`-XX:-ZGenerational` 不再回到非分代实现。 |
| JDK 25 | 分代 Shenandoah 成为产品特性，但 Shenandoah 默认仍是单代模式。  |

所以面试里别只说“ZGC 适合大堆低延迟”。更完整的说法是：**JDK 15 起 ZGC 进入生产可用，JDK 21 引入分代 ZGC，JDK 23 起 `-XX:+UseZGC` 默认就是分代模式，JDK 24 已移除非分代模式**。如果团队还在 JDK 8 或 JDK 11，能不能直接用、怎么启用、发行版是否支持，都要单独确认。

## 普通后端服务为什么通常先看 G1？

假设一个订单服务：

- JDK 17 或 JDK 21。
- 堆 4GB 到 16GB。
- 接口 P99 在几十到几百毫秒。
- 业务更怕吞吐下降和 CPU 飙高，不一定追求单次 GC 停顿小于 5ms。

这种场景一般先用 G1，而不是一上来切 ZGC。

原因有四个：

1. G1 是现代 JDK 的默认通用选择，线上经验最多。
2. G1 的 Region 和 Mixed GC 能处理大多数中等堆服务的停顿问题。
3. G1 的日志、参数、监控指标更容易被团队理解和接手。
4. 如果 P99 目标没有那么极端，低延迟 GC 的并发成本未必划算。

G1 常见启动参数可以很克制：

```bash
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-Xlog:gc*,safepoint:file=/var/log/app/gc-%t.log:time,uptime,level,tags:filecount=14,filesize=50M
```

这里的 `MaxGCPauseMillis` 只是目标，不是 SLA。业务分配速率太高、堆太小、Humongous Object 太多、老年代回收跟不上时，G1 仍然可能出现长停顿甚至 Full GC。

## 什么情况下再评估 ZGC？

ZGC 更适合这种服务：

- 堆很大，比如几十 GB 甚至更高。
- P99/P999 延迟对 GC 停顿非常敏感。
- 长时间 STW 会直接影响交易、网关、搜索、推荐等核心链路。
- 机器有足够 CPU 余量，能让 GC 并发线程追上应用分配速度。
- 团队使用 JDK 21、25 或更新版本，并愿意按新版 ZGC 指标重新观测。

一个常见例子是大内存缓存型服务。对象常驻多、堆很大，如果用传统分代 GC，偶发老年代回收可能把接口停顿拉长。ZGC 的价值是把绝大部分工作放到并发阶段，让 STW 阶段尽量短。

JDK 23+ 使用 ZGC 时，通常只需要：

```bash
-XX:+UseZGC
-Xlog:gc*,safepoint:file=/var/log/app/gc-%t.log:time,uptime,level,tags:filecount=14,filesize=50M
```

但切 ZGC 前要特别看两类风险：

- **Allocation Stall**：应用分配速度超过 ZGC 回收速度，线程可能被迫等内存。
- **CPU 抢占**：GC 并发线程和业务线程抢 CPU，整体吞吐可能下降。

如果服务本来 CPU 就长期 80% 以上，切 ZGC 前要先扩容、降分配速率或优化对象生命周期，否则可能没有余量让并发 GC 工作完成。

## Shenandoah 适合怎么讲？

Shenandoah 和 ZGC 一样面向低停顿，但实现路线不同。它通过并发标记、并发撤离和并发引用更新，尽量把对象移动整理过程也放到应用运行期间完成。

它适合这样表达：

- 目标也是低停顿，不是吞吐优先。
- JDK 15 起是生产可用特性。
- 在一些 OpenJDK/Red Hat 系发行版里实践较多，但具体发行版是否打包、是否启用，要以实际 JDK 为准。
- JDK 25 里分代 Shenandoah 已成为产品特性，但默认模式仍不是分代模式。

启用示例：

```bash
-XX:+UseShenandoahGC
-Xlog:gc*,safepoint:file=/var/log/app/gc-%t.log:time,uptime,level,tags:filecount=14,filesize=50M
```

如果要评估分代 Shenandoah，还要确认当前 JDK 版本和参数语义。JDK 24 里它还是实验模式，JDK 25 才去掉实验特性限制，但默认仍继续使用单代模式。

## 怎么用数据验证选型？

不要只看“平均停顿”。GC 选型至少要跑一轮压测或灰度，观察这些指标：

| 指标                       | 看什么                                              |
| -------------------------- | --------------------------------------------------- |
| GC pause P99/P999          | 是否真的压住尾延迟，而不是只降低平均值              |
| Allocation rate            | 分配速率是否过高，GC 是否追得上                     |
| Heap after GC              | GC 后堆占用是否持续抬升，是否有泄漏或缓存失控       |
| CPU usage                  | 切低延迟 GC 后 CPU 是否明显上升                     |
| Safepoint time             | 停顿是否来自 GC，还是类卸载、偏向锁撤销等安全点问题 |
| Full GC / Allocation Stall | 是否出现退化路径或分配阻塞                          |

可以用这些命令先抓粗粒度现场：

```bash
jcmd <pid> VM.flags
jcmd <pid> GC.heap_info
jstat -gcutil <pid> 1000 10
```

如果要分析尾延迟，GC 日志和 JFR 更重要：

```bash
jcmd <pid> JFR.start name=gc-check settings=profile filename=/tmp/gc-check.jfr
```

观察时要把 GC 时间线和业务 RT、CPU、线程池队列、RPC 超时放在一起看。很多所谓“GC 问题”，最后其实是慢 SQL、对象分配暴涨、缓存无限增长或线程池堆积导致的。

## 面试怎么答？

可以按这个顺序回答：

1. 先说明 GC 没有绝对最优，核心是在吞吐、延迟、CPU、堆大小和 JDK 版本之间取舍。
2. 普通 Java 后端服务优先用 G1，因为它是现代 JDK 默认通用选择，停顿可控、运维经验成熟。
3. 如果堆很大、P99/P999 对停顿极敏感，并且 CPU 有余量，再评估 ZGC 或 Shenandoah。
4. ZGC 要说清 JDK 21 分代、JDK 23 默认分代、JDK 24 移除非分代模式这些边界。
5. 不管选哪个，都要用 GC 日志、JFR、P99、CPU 和分配速率验证，而不是只看理论。

## 容易踩的坑

1. **把 ZGC 说成“没有停顿”**：它只是把停顿压得很短，仍然有 STW 阶段，也可能有分配阻塞。
2. **把 `MaxGCPauseMillis` 当硬保证**：G1 会努力贴近目标，但业务压力超过能力时照样超。
3. **只看堆大小，不看分配速率**：同样 16GB 堆，一个服务每秒分配 50MB，另一个每秒分配 2GB，GC 压力完全不同。
4. **忽略 CPU 余量**：低延迟 GC 靠并发工作换停顿，CPU 紧张时收益会打折。
5. **忽略版本和发行版**：ZGC、Shenandoah 的状态随 JDK 版本变化很大，面试和上线都要说清楚边界。

## 小结

1. G1 是通用服务端常见选择，兼顾吞吐和可控停顿。
2. ZGC、Shenandoah 更适合低延迟、大堆或停顿极敏感场景。
3. 低延迟 GC 会消耗并发 CPU、屏障和运行时管理成本，不是免费优化。
4. 现代 ZGC 版本边界要记清：JDK 21 引入分代，JDK 23 默认分代，JDK 24 移除非分代模式。
5. GC 选型必须结合 JDK 版本、堆大小、P99/P999、CPU、分配速率和 GC 日志验证。

## 参考

综合自仓库内 JVM 垃圾回收参考资料、OpenJDK JEP 333 / 377 / 439 / 474 / 490 / 521、OpenJDK Shenandoah 相关 JEP，并对 ZGC 分代模式、Shenandoah 产品化状态、CMS 移除后的版本边界做了交叉验证。
