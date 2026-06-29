---
title: "JVM"
description: "围绕运行时内存、GC、类加载和线上排查的专题。"
article: true
breadcrumb: true
editLink: false
prev:
  text: "并发"
  link: "/java/concurrent/"
next:
  text: "JVM 内存区域怎么划分？哪些区域会 OOM？"
  link: "/java/jvm/jvm-memory-areas.html"
---

# JVM

## 为什么重要

JVM 体现的是“原理题能答、线上题能排”的综合能力。面试官从内存区域、GC、类加载一路追到 OOM 和 Full GC 排查，问的不是术语，而是你能不能把 JVM 行为和真实服务稳定性联系起来。

## 知识主线

内存区域 → 对象生命周期 → 类加载 → 对象回收 → 收集器 → G1/CMS 对比 → OOM 排查 → Full GC 排查 → 参数调优

## 怎么读这个专题

建议先读内存和对象生命周期，建立“对象在哪里、怎么分配、怎么被回收”的底图；再读类加载和 ClassLoader，补上元空间、热部署和类隔离；最后读 GC、OOM、Full GC 和参数调优，把原理落到 `jstat`、`jmap`、`jstack`、`jcmd` 和 GC 日志上。

## 面试焦点

不是背“堆、栈、方法区”，而是能解释不同区域的 OOM 边界、GC Roots 为什么能定位泄漏、G1 为什么不等于更快的 CMS，以及线上出现 OOM/Full GC 时按什么证据链排查。

## 前置知识

Java 基础、集合、并发、操作系统内存基础。

## 目标人群

3-5 年 Java 后端工程师。

## 题目列表

### 内存与对象

- [JVM 内存区域怎么划分？哪些区域会 OOM？](./jvm-memory-areas.html) — 线程私有、线程共享、方法区/元空间和直接内存的边界。
- [对象从创建到回收经历了什么？](./jvm-object-lifecycle.html) — `new` 指令、对象布局、TLAB、分代流转和 GC 回收入口。

### 类加载

- [类加载过程和双亲委派模型怎么理解？](./jvm-class-loading.html) — 加载、连接、初始化、Class 文件结构和加载器层级。
- [为什么需要自定义 ClassLoader？会带来什么风险？](./jvm-classloader.html) — 插件化、类隔离、热部署、SPI 和类加载器泄漏。

### GC 原理与收集器

- [如何判断对象可以被回收？](./jvm-object-recycling.html) — GC Roots、可达性分析、引用类型和类卸载。
- [常见垃圾收集器怎么选？](./jvm-gc-collectors.html) — 按吞吐、延迟、内存占用和 JDK 版本做 GC 选择。
- [G1 相比 CMS 改进了什么？](./jvm-g1-vs-cms.html) — Region、Mixed GC、停顿预测和 CMS 版本边界。

### 线上排障与调优

- [线上 OOM 怎么定位？](./jvm-oom-troubleshooting.html) — 保留现场、判断区域、堆 dump、元空间和直接内存排查。
- [频繁 Full GC 怎么排查？](./jvm-full-gc-troubleshooting.html) — 从 `jstat`、GC 日志、老年代增长和元空间触发定位根因。
- [JVM 参数调优到底在调什么？](./jvm-parameters-tuning.html) — 堆、新生代、元空间、GC、日志和容器内存边界。
