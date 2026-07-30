---
title: "Unsafe 为什么被称为 Java 的后门？能做什么？"
description: "从 CAS、内存、线程到屏障讲清 Unsafe 的能力与使用风险。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "进阶"
  - "原理深入"
  - "细节题"
prev:
  text: "ForkJoinPool 和 parallelStream 适合什么场景？有哪些坑？"
  link: "/java/concurrent/java-concurrency-forkjoin-parallelstream.html"
next:
  text: "虚拟线程解决了什么问题？和平台线程什么关系？"
  link: "/java/concurrent/java-concurrency-virtual-thread.html"
---

# Unsafe 为什么被称为 Java 的后门？能做什么？

读 JUC 源码会发现很多并发工具类都在用一个叫 `Unsafe` 的类——原子类、AQS、ConcurrentHashMap 底层都靠它。`Unsafe` 是 `sun.misc` 包下的一个"后门"类，能直接操作内存、线程、CAS，绕过 Java 的安全限制，所以叫魔法类。它很强大也很危险，理解它能解释清楚 JUC 底层是怎么实现的。

## Unsafe 是什么

`Unsafe` 提供的都是 native 方法，直接调底层。它是个单例，正常通过 `Unsafe.getUnsafe()` 获取会校验调用者是否被引导类加载器加载，普通代码调会抛 `SecurityException`。常见绕过方式是反射拿 `theUnsafe` 字段：

```java
Field f = Unsafe.class.getDeclaredField("theUnsafe");
f.setAccessible(true);
Unsafe unsafe = (Unsafe) f.get(null);
```

## 核心能力一览

`Unsafe` 的功能大致分这几类（重点记前四类）：

| 类别     | 代表方法                                              | 典型应用                         |
| -------- | ----------------------------------------------------- | -------------------------------- |
| CAS      | `compareAndSwapInt/Long/Object`                       | 原子类、AQS、ConcurrentHashMap   |
| 内存     | `allocateMemory/freeMemory/putLong`                   | DirectByteBuffer 堆外内存、Netty |
| 对象     | `allocateInstance`（不调构造器）、`objectFieldOffset` | Gson 反序列化、Objenesis         |
| 线程     | `park/unpark`                                         | LockSupport，进而 AQS            |
| 内存屏障 | `loadFence/storeFence/fullFence`                      | StampedLock 的乐观读校验         |
| Class    | `defineClass/defineAnonymousClass`                    | Lambda 表达式生成匿名类          |

### CAS：并发的基石

```java
public final native boolean compareAndSwapInt(Object o, long offset, int expected, int x);
```

比较对象 `o` 在 `offset` 处的值是否等于 `expected`，是则更新为 `x`，返回 true；否则不动，返回 false。底层是 CPU 的 `cmpxchg` 原子指令。`AtomicInteger` 的 `incrementAndGet`、AQS 的 `compareAndSet`、ConcurrentHashMap 的节点更新，全是靠它做无锁原子操作。

### 内存：直接操作堆外

`allocateMemory/putInt/getInt/freeMemory` 让 Java 像 C 一样直接分配读写堆外内存，不受 JVM 堆管理。`DirectByteBuffer` 就是靠它分配堆外内存——IO 场景减少一次堆到堆外的拷贝，Netty 的池化堆外缓冲也基于它。

### 对象：跳过构造器创建对象

`allocateInstance(Class)` 只用 Class 对象创建实例，**不调用构造方法、不做初始化**。Gson 反序列化、Objenesis 用它绕过构造器限制（比如构造器是 private）。

### 线程：park / unpark

`park` 阻塞当前线程，`unpark` 唤醒指定线程。`LockSupport.park/unpark` 就是包了一层 `Unsafe.park/unpark`，而 AQS 的阻塞唤醒又靠 `LockSupport`——所以 `ReentrantLock`、`CountDownLatch` 这些的线程阻塞最终都落到 `Unsafe.park/unpark`。

### 内存屏障

`loadFence/storeFence/fullFence` 阻止指令重排。`StampedLock` 的乐观读校验 `validate` 就在里头插了 `loadFence`，保证读到的是最新值。

## 谁在用

- 原子类、AQS、ConcurrentHashMap：CAS
- `DirectByteBuffer` / Netty：堆外内存
- `LockSupport` → AQS 全家桶：park / unpark
- `StampedLock`：loadFence
- Gson / Objenesis：allocateInstance
- Lambda 表达式：defineAnonymousClass

> 一句话：你天天用的并发工具和 NIO 框架，底层都站在 `Unsafe` 肩上。

## 为什么危险

- **堆外内存不受 GC**：忘记释放或越界访问，直接 JVM crash（不是抛异常，是进程挂）。
- **破坏封装**：能改 private 字段、跳过构造器，对象不变量可能被破坏。
- **跨版本不兼容**：`sun.misc.Unsafe` 是内部 API，不同 JDK 实现可能不同，升级有风险。

## 历史与未来：VarHandle 替代

JDK 9 引入模块化后，`sun.misc.Unsafe` 被隐藏，官方提供 `java.lang.invoke.VarHandle` 作为公开替代，提供 CAS、内存屏障、volatile 语义等能力，且类型安全。新代码应优先用 VarHandle，老的 `Unsafe` 依赖在逐步收敛（但短期内不会被移除，太多库依赖它）。

## 小结

- `Unsafe` 是直接操作内存 / 线程 / CAS 的后门类，JUC、NIO、序列化框架底层都靠它。
- 核心能力：CAS（并发基石）、内存（堆外）、对象（跳构造器）、线程（park / unpark）、内存屏障。
- 危险：堆外内存不受 GC、越界崩溃、破坏封装、跨版本不兼容。
- JDK 9+ 用 VarHandle 作为官方安全替代，新代码优先 VarHandle。

## 参考

本文综合公开 Java 并发教材与 OpenJDK 文档、Unsafe 官方源码注释，核对了 CAS / 内存 / 对象 / 线程 / 内存屏障等能力的原理与典型应用，并对照了 VarHandle 作为现代替代的趋势。
