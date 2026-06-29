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
  text: "G1 相比 CMS 改进了什么？"
  link: "/java/jvm/jvm-g1-vs-cms.html"
next:
  text: "频繁 Full GC 怎么排查？"
  link: "/java/jvm/jvm-full-gc-troubleshooting.html"
---

# 线上 OOM 怎么定位？

> OOM 排查的第一步不是调大内存，而是保留现场、判断区域、拿证据，再决定止血和根因修复。

## 先保留现场

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
jcmd <pid> VM.flags
jcmd <pid> GC.heap_info
jstat -gcutil <pid> 1000 10
```

## 先判断是哪块内存 OOM

不同错误指向不同区域：

| 错误信息                             | 常见方向                                |
| ------------------------------------ | --------------------------------------- |
| `Java heap space`                    | 堆对象过多、缓存/集合膨胀、查询结果过大 |
| `GC overhead limit exceeded`         | GC 很努力但回收效果很差                 |
| `Metaspace`                          | 动态类太多、类加载器泄漏                |
| `Direct buffer memory`               | NIO 直接内存泄漏或上限不足              |
| `unable to create new native thread` | 线程数过多、栈空间或系统限制            |

不要只看 heap dump。直接内存、线程栈、元空间都可能让进程 RSS 很高，但 heap dump 看起来不大。

## 堆 OOM 怎么分析？

堆 OOM 优先拿 dump：

```bash
jmap -dump:live,format=b,file=/data/dumps/app.hprof <pid>
```

线上执行 `jmap` 可能触发停顿，尤其大堆服务要谨慎。更推荐提前配置 OOM 自动 dump，或在隔离节点/低峰期操作。

拿到 dump 后用 MAT、VisualVM、JProfiler 等工具看：

- Dominator Tree：谁占用内存最多。
- Leak Suspects：可能泄漏链。
- GC Roots Path：对象为什么还活着。
- 大集合、大 Map、大 byte[]、大 String 是否异常。

典型根因：

- 本地缓存没有容量上限。
- 一次查出过多数据。
- ThreadLocal 没清理。
- 异步队列堆积。
- 大对象反复创建，晋升老年代。

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

临时止血可以设置或调整：

```bash
-XX:MaxMetaspaceSize=512m
```

但根因还是要找到为什么类卸不掉或类生成过多。

## 直接内存 OOM 怎么分析？

如果错误是 `Direct buffer memory`，关注 NIO、Netty、文件传输、堆外缓存。

可用：

```bash
jcmd <pid> VM.native_memory summary
```

前提是启动时开了：

```bash
-XX:NativeMemoryTracking=summary
```

还要看是否设置了：

```bash
-XX:MaxDirectMemorySize=512m
```

Netty 场景还要结合 allocator 指标和是否存在 ByteBuf 未释放。

## 小结

- OOM 先保留现场，提前配置 heap dump 和关键 JVM 参数。
- 先根据错误信息判断内存区域，不要所有 OOM 都按堆泄漏处理。
- 堆 OOM 看 dump 的 Dominator Tree 和 GC Roots。
- 元空间 OOM 看类加载数量和 ClassLoader 引用链。
- 直接内存 OOM 要看 NMT、NIO/Netty 指标和本地内存上限。

## 参考

综合自《JDK 监控和故障处理工具总结》《JVM 线上问题排查和性能调优案例》《最重要的 JVM 参数总结》，并结合 `jcmd`、NMT、MAT 和线上保留现场流程做了排查顺序整理。
