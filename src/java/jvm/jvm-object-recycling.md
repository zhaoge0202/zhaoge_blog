---
title: "如何判断对象可以被回收？"
description: "从 GC Roots、可达性分析、引用类型和类卸载讲清对象回收判断。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "必会"
  - "高频"
  - "原理深入"
prev:
  text: "为什么需要自定义 ClassLoader？会带来什么风险？"
  link: "/java/jvm/jvm-classloader.html"
next:
  text: "常见垃圾收集器怎么选？"
  link: "/java/jvm/jvm-gc-collectors.html"
---

# 如何判断对象可以被回收？

> HotSpot 判断对象是否该回收，核心是可达性分析：从 GC Roots 出发走不到的对象，才可能被回收。

## 为什么不用引用计数？

引用计数很好理解：对象每多一个引用，计数加 1；引用失效，计数减 1；计数为 0 就回收。

问题是它很难处理循环引用：

```java
class Node {
    Node next;
}

Node a = new Node();
Node b = new Node();
a.next = b;
b.next = a;
a = null;
b = null;
```

`a` 和 `b` 互相引用，但业务代码已经访问不到它们。引用计数会误以为它们还活着。

## 可达性分析怎么判断？

JVM 从一组 GC Roots 出发，沿引用链向下搜索：

```text
GC Roots
├── 可达对象 A
│   └── 可达对象 B
└── 可达对象 C

不可达对象 D/E → 可回收候选
```

常见 GC Roots 包括：

- 虚拟机栈中局部变量引用的对象。
- 本地方法栈 JNI 引用的对象。
- 类静态字段引用的对象。
- 运行时常量池引用的对象。
- 被 synchronized 锁持有的对象。
- JVM 内部引用。

线上排查内存泄漏时，MAT 里的 GC Roots 路径很关键。它能告诉你对象为什么还活着。

## 不可达就一定马上回收吗？

不一定。

不可达对象通常要经历标记、筛选、回收等过程。历史上还会涉及 `finalize` 的二次标记，但 `finalize` 设计问题很多，JDK 9 后已经走向废弃移除。实际开发里不要依赖 `finalize` 做资源释放。

资源释放应该用：

```java
try (InputStream in = Files.newInputStream(path)) {
    // use in
}
```

也就是显式关闭，或用 `Cleaner` 等更受控机制。

## 四种引用怎么影响回收？

| 引用类型 | 回收语义                         | 常见用途                  |
| -------- | -------------------------------- | ------------------------- |
| 强引用   | 只要可达就不回收                 | 普通对象引用              |
| 软引用   | 内存压力大时可能回收             | 不推荐作为现代缓存首选    |
| 弱引用   | 下一次 GC 发现就可回收           | `WeakHashMap`、关联元数据 |
| 虚引用   | 不影响生命周期，配合队列感知回收 | 堆外资源清理通知          |

软引用常被老资料说成“适合做缓存”。现在要谨慎：业务缓存更推荐 Caffeine 这类有容量、过期、统计和淘汰策略的组件，而不是把内存策略交给软引用。

## 类什么时候可以卸载？

类卸载比对象回收苛刻。一个类通常要同时满足：

1. 该类的实例都被回收。
2. 该类的 `Class` 对象没有被引用。
3. 加载它的 ClassLoader 可以被回收。

所以 JDK 自带加载器加载的类通常不会卸载。插件、热部署、脚本引擎这类自定义加载器场景才更容易看到类卸载。

观察类卸载：

```bash
# JDK 9+
java -Xlog:class+unload=info -jar app.jar

# JDK 8
java -XX:+TraceClassUnloading -jar app.jar
```

查看加载器统计：

```bash
jcmd <pid> VM.classloader_stats
```

## 小结

- 引用计数简单但难处理循环引用，HotSpot 主流判断靠可达性分析。
- 从 GC Roots 出发不可达的对象，才是回收候选。
- 不要依赖 `finalize` 做资源释放，它已经是被淘汰的方向。
- 强、软、弱、虚引用影响对象进入回收流程的时机。
- 类卸载必须连同实例、Class 对象和 ClassLoader 引用一起解除。

## 参考

综合自《JVM 垃圾回收详解》《类加载过程详解》，并结合 JDK 对 `finalize` 的废弃方向、MAT GC Roots 分析和类加载器统计命令做了实践化整理。
