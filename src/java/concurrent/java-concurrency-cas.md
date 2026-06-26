---
title: "CAS 是怎么实现原子操作的？有哪些问题？"
description: "从 Unsafe 到 Atomic 类，讲透 CAS 的原理、ABA 问题和自旋开销。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "必会"
  - "原理深入"
  - "高频"
prev:
  {
    text: "synchronized 的底层原理是什么？锁优化怎么回事？",
    link: "/java/concurrent/java-concurrency-synchronized.html",
  }
next:
  {
    text: "ReentrantLock 和 AQS 是怎么配合的？",
    link: "/java/concurrent/java-concurrency-reentrantlock.html",
  }
---

# CAS 是怎么实现原子操作的？有哪些问题？

> CAS（Compare-And-Swap）是乐观锁的核心实现，也是 Java 并发包（JUC）的基石。Atomic 类、AQS、ConcurrentHashMap 都离不开它。

## 什么是 CAS？

CAS 是一种硬件支持的原子操作，涉及三个操作数：

- **V**：要更新的变量值（内存地址）
- **E**：预期值（旧值）
- **N**：拟写入的新值

当且仅当 V 的值等于 E 时，才将 V 更新为 N。否则说明已有其他线程修改了 V，当前操作失败。

用伪代码描述：

```
boolean cas(V, E, N) {
    if (V == E) {
        V = N;
        return true;
    }
    return false;
}
```

关键是这个「比较+交换」是**原子的**——由 CPU 的一条指令完成（x86 的 `cmpxchg`），不会被中断。

## Java 中 CAS 的实现：Unsafe

Java 无法直接操作内存，CAS 通过 `sun.misc.Unsafe` 类的 native 方法实现：

```java
public final native boolean compareAndSwapInt(Object o, long offset, int expected, int x);
public final native boolean compareAndSwapLong(Object o, long offset, long expected, long x);
public final native boolean compareAndSwapObject(Object o, long offset, Object expected, Object x);
```

`offset` 是字段在对象中的内存偏移量，通过反射获取：

```java
valueOffset = unsafe.objectFieldOffset(AtomicInteger.class.getDeclaredField("value"));
```

底层实现是 C++ 内联汇编，通过 JNI 调用，最终映射到 CPU 的原子指令。

### AtomicInteger 示例

```java
public class AtomicInteger {
    private volatile int value; // volatile 保证可见性

    public final boolean compareAndSet(int expect, int update) {
        return unsafe.compareAndSwapInt(this, valueOffset, expect, update);
    }

    public final int getAndIncrement() {
        return unsafe.getAndAddInt(this, valueOffset, 1);
    }
}
```

`getAndAddInt` 的实现就是一个自旋 CAS 循环：

```java
public final int getAndAddInt(Object o, long offset, int delta) {
    int v;
    do {
        v = getIntVolatile(o, offset);   // 读当前值
    } while (!compareAndSwapInt(o, offset, v, v + delta)); // CAS 失败就重试
    return v;
}
```

如果 CAS 失败（值被其他线程修改），循环重试，直到成功。这就是**自旋锁机制**。

## CAS 的三大问题

### 1. ABA 问题

一个值从 A 变成 B，又变回 A，CAS 会认为它没被修改过。

```
时间线：
  线程 1 读到值 A
  线程 2 把值改成 B
  线程 2 又把值改回 A
  线程 1 CAS(A → C) 成功——但中间的 B → A 变化被忽略了
```

大多数场景下 ABA 不会出问题（比如纯计数器）。但在涉及「值的变化过程」的场景（如链表节点的回收复用），ABA 可能导致数据损坏。

**解决方案**：加版本号。`AtomicStampedReference` 在引用之外额外维护一个 stamp（版本号），每次更新时 stamp 也要匹配：

```java
AtomicStampedReference<Integer> ref = new AtomicStampedReference<>(100, 0);

// 线程 1
int[] stamp = ref.getStamp();
Integer value = ref.getReference();
// ... 做一些操作
ref.compareAndSet(value, 200, stamp[0], stamp[0] + 1);
```

### 2. 自旋开销大

CAS 失败后会不断重试（自旋）。如果竞争激烈或锁持有时间长，自旋会白白消耗 CPU 资源。

**缓解方式**：

- `LongAdder` 用空间换时间：将一个值拆成多个 Cell，不同线程操作不同 Cell，最终求和。高并发下比 `AtomicLong` 性能好很多。
- JVM 的 `pause` 指令可以减少自旋的 CPU 消耗（延迟流水线执行，避免内存顺序冲突）。

### 3. 只能保证单个变量的原子操作

CAS 一次只能操作一个变量。多个变量的一致性需要额外设计。

**解决方案**：

- 把多个变量封装成一个对象，用 `AtomicReference` 做 CAS。
- 使用 `synchronized` 或 `ReentrantLock`。

## 乐观锁 vs 悲观锁

CAS 是乐观锁的实现方式，和悲观锁是两种并发控制思路：

| 对比项     | 悲观锁                          | 乐观锁                 |
| ---------- | ------------------------------- | ---------------------- |
| 假设       | 冲突很可能发生                  | 冲突不常发生           |
| 策略       | 先锁住再操作                    | 先操作，提交时校验     |
| Java 实现  | `synchronized`、`ReentrantLock` | CAS、Atomic 类、版本号 |
| 适合场景   | 写多读少、竞争激烈              | 读多写少、竞争不激烈   |
| 问题       | 阻塞、上下文切换、死锁          | 自旋消耗 CPU、ABA      |
| 数据库类比 | `SELECT ... FOR UPDATE`         | version 字段           |

> 注意：`LongAdder` 解决了乐观锁在高并发下的自旋问题——它不是靠无限重试，而是把竞争分散到多个 Cell 上。如果写操作非常频繁，`LongAdder` 比 `AtomicLong` 性能更好，代价是占用更多内存。

## Atomic 类概览

`java.util.concurrent.atomic` 包提供了丰富的原子类：

| 类型       | 典型类                                         | 用途                                     |
| ---------- | ---------------------------------------------- | ---------------------------------------- |
| 基本类型   | `AtomicInteger`、`AtomicLong`、`AtomicBoolean` | 单个变量的原子更新                       |
| 引用类型   | `AtomicReference`、`AtomicStampedReference`    | 对象引用的原子更新                       |
| 数组类型   | `AtomicIntegerArray`、`AtomicLongArray`        | 数组元素的原子更新                       |
| 累加器     | `LongAdder`、`LongAccumulator`                 | 高并发计数，比 AtomicLong 性能更好       |
| 字段更新器 | `AtomicIntegerFieldUpdater`                    | 用反射方式原子更新已有类的 volatile 字段 |

## 小结

- CAS 通过 CPU 原子指令实现「比较+交换」，Java 中通过 `Unsafe` 的 native 方法调用。
- CAS 三大问题：ABA（加版本号解决）、自旋开销大（LongAdder 分散竞争）、只能保证单变量（封装对象或用锁）。
- 乐观锁适合读多写少，悲观锁适合写多读少；冲突激烈时乐观锁的自旋反而比悲观锁更差。
- `LongAdder` 是高并发计数器的首选，用空间换时间分散竞争。

## 参考

综合自多篇 CAS 详解和乐观锁/悲观锁资料。部分资料分别从实现和概念角度讲解，本文将两者合并为统一叙事，并补充了 `LongAdder` 作为高并发场景解决方案的说明。
