---
title: "JVM 内存区域怎么划分？哪些区域会 OOM？"
description: "从线程私有、线程共享到直接内存，讲清 JVM 内存区域与 OOM 边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "必会"
  - "高频"
  - "体系化"
prev:
  text: "JVM"
  link: "/java/jvm/"
next:
  text: "对象从创建到回收经历了什么？"
  link: "/java/jvm/jvm-object-lifecycle.html"
---

# JVM 内存区域怎么划分？哪些区域会 OOM？

> JVM 内存区域不是一张死图，面试真正要答清的是：谁线程私有、谁线程共享、各自放什么、出问题时怎么定位。

## 为什么 JVM 要拆这么多区域？

一个 Java 线程执行方法时，需要记录当前执行到哪条字节码、方法调用栈、局部变量；多个线程又要共享对象、类元数据和常量等信息。JVM 把这些职责拆开，主要是为了隔离线程执行状态和统一管理共享对象。

可以先按“线程私有/线程共享”记：

| 区域       | 线程关系 | 主要存放什么                       | 常见异常                         |
| ---------- | -------- | ---------------------------------- | -------------------------------- |
| 程序计数器 | 私有     | 当前线程执行的字节码位置           | 规范中唯一没有规定 OOM 的区域    |
| 虚拟机栈   | 私有     | Java 方法栈帧、局部变量、操作数栈  | `StackOverflowError`、OOM        |
| 本地方法栈 | 私有     | Native 方法调用栈                  | `StackOverflowError`、OOM        |
| 堆         | 共享     | 对象实例、数组                     | `Java heap space`、GC overhead   |
| 方法区     | 共享     | 类元数据、运行时常量池、方法字节码 | `Metaspace` 等                   |
| 直接内存   | 共享     | NIO 直接缓冲区等本地内存           | `Direct buffer memory`、本地 OOM |

直接内存不是 JVM 规范里的运行时数据区，但 Java 后端排查内存问题时经常绕不开它。

## 程序计数器为什么最特殊？

程序计数器可以理解成线程自己的“执行位置记录本”。线程切换出去再切回来，需要知道下一条字节码从哪里继续执行。

它有两个特点：

1. 每个线程一份，互不影响。
2. 执行 Java 方法时记录字节码指令位置；执行 Native 方法时值可以是 Undefined。

它占用空间很小，JVM 规范里也没有规定它会抛 `OutOfMemoryError`。

## 虚拟机栈为什么会 StackOverflow？

每调用一个 Java 方法，JVM 就会创建一个栈帧压入虚拟机栈。栈帧里有局部变量表、操作数栈、动态链接和返回地址。

递归太深时，栈帧不断压入，最终超过栈深度：

```java
static void call() {
    call();
}
```

典型错误是：

```text
java.lang.StackOverflowError
```

如果线程数很多，每个线程都需要栈空间，也可能因为无法继续申请栈内存而 OOM。线上看到大量线程时，不只要看堆，还要看线程数和 `-Xss`。

## 堆为什么是 GC 主战场？

堆主要存放对象实例和数组。绝大多数业务内存问题都先从堆看，因为对象生命周期、缓存、集合膨胀、查询结果过大，都会落到堆上。

常见堆 OOM：

```text
java.lang.OutOfMemoryError: Java heap space
java.lang.OutOfMemoryError: GC overhead limit exceeded
```

需要注意一句话的边界：不要说“所有对象都在堆上分配”。HotSpot 有逃逸分析、标量替换等优化，理论和实际实现都不能把话说绝对。面试里说“通常对象在堆上分配”更稳。

常用落地命令：

```bash
jmap -heap <pid>
jcmd <pid> GC.heap_info
jmap -dump:live,format=b,file=/tmp/app.hprof <pid>
```

## 方法区、永久代、元空间是什么关系？

方法区是 JVM 规范里的逻辑概念；永久代和元空间是 HotSpot 对方法区的实现方式。

| JDK 版本     | HotSpot 实现口径                           |
| ------------ | ------------------------------------------ |
| JDK 7 及以前 | 主要用永久代承载方法区相关数据             |
| JDK 8 及以后 | 移除永久代，改用元空间，元空间使用本地内存 |

所以不要说“方法区就是永久代”，也不要说“JDK 8 方法区消失了”。更准确是：方法区这个逻辑概念还在，只是 HotSpot 的实现从永久代变成了元空间。

元空间常见错误：

```text
java.lang.OutOfMemoryError: Metaspace
```

这通常和动态生成类、频繁热部署、类加载器泄漏有关。

## 字符串常量池和运行时常量池别混淆

运行时常量池来自 Class 文件常量池，属于方法区逻辑的一部分。

字符串常量池在 HotSpot 里经历过位置变化：

- JDK 6：主要在永久代。
- JDK 7 起：移动到堆中。

这也是很多老资料容易讲错的点。现在回答时要带上 HotSpot 和版本边界。

## 直接内存为什么容易被漏掉？

NIO 的 `DirectByteBuffer` 会使用本地内存，减少 Java 堆和 Native 内存之间的数据复制，对 I/O 友好。

但直接内存不直接受 `-Xmx` 限制。一个服务堆看着不大，RSS 却持续增长，就要考虑：

- 直接内存。
- 线程栈。
- 元空间。
- Code Cache。
- Native 库分配。

排查本地内存时可以打开 NMT 后看：

```bash
jcmd <pid> VM.native_memory summary
```

NMT 需要启动参数支持：

```bash
-XX:NativeMemoryTracking=summary
```

## 小结

- 程序计数器、虚拟机栈、本地方法栈是线程私有；堆和方法区是线程共享。
- 程序计数器是规范中唯一没有规定 OOM 的运行时区域。
- 堆是 GC 主战场，常见 `Java heap space` 和 GC overhead OOM。
- 方法区是逻辑概念，永久代/元空间是 HotSpot 实现，JDK 8 后是元空间。
- 直接内存不在堆里，排查 RSS 增长时不能只看 heap dump。

## 参考

基于 Oracle Java SE Documentation、OpenJDK JEP、HotSpot VM 文档与 JDK 工具官方文档中 JVM、GC、类加载、监控与诊断相关内容整理。
