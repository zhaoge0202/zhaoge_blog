---
title: "强、软、弱、虚引用有什么区别？各自用在哪？"
description: "从可达性、GC 时机到 ReferenceQueue 讲清四种引用与使用场景。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "进阶"
  - "原理深入"
  - "高频"
prev:
  text: "为什么说 Java 只有值传递？"
  link: "/java/basis/java-basis-pass-by-value.html"
next:
  text: "对象拷贝怎么做？深浅拷贝和 Cloneable 有什么坑？"
  link: "/java/basis/java-basis-clone.html"
---

# 强、软、弱、虚引用有什么区别？各自用在哪？

Java 里有四种引用强度，从强到弱是**强、软、弱、虚**。区别在于"GC 多激进地回收它"——强引用永不回收，软引用内存不足才回收，弱引用下次 GC 就回收，虚引用几乎不 hold 对象、只为在回收时收到通知。

## 四种引用总览

| 引用类型       | 类               | 回收时机               | 典型用途                        |
| -------------- | ---------------- | ---------------------- | ------------------------------- |
| 强引用 Strong  | 默认引用         | 永不（只要强可达）     | 普通对象，内存泄漏主因          |
| 软引用 Soft    | SoftReference    | 内存不足时             | 内存敏感的缓存                  |
| 弱引用 Weak    | WeakReference    | 下一次 GC              | WeakHashMap、ThreadLocal 的 key |
| 虚引用 Phantom | PhantomReference | 随时（不决定生命周期） | 配合 ReferenceQueue 做资源清理  |

## 强引用：默认，也是泄漏主因

`Object o = new Object()` 就是强引用。只要强可达，GC 绝不回收它。内存泄漏最常见的原因就是：某个静态集合长期持有本该释放的对象引用，导致这些对象一直强可达。

解法：用完置 `null`，或用弱引用集合（`WeakHashMap`）让它能被回收。

## 软引用：内存不足才回收

```java
SoftReference<Cache> ref = new SoftReference<>(new Cache());
Cache c = ref.get(); // 可能 null（已被回收）
```

软引用在 JVM 内存充足时一直保留，内存不足要 OOM 前才回收它。适合做"有则用、无则重建"的缓存。但要注意：软引用不是可靠的缓存策略，回收时机不确定，也可能拖慢 GC。

## 弱引用：下次 GC 就回收

```java
WeakReference<Object> ref = new WeakReference<>(new Object());
```

弱引用指向的对象只要没别的强引用，下一次 GC 就会被回收。典型用途：

- **WeakHashMap**：key 是弱引用，key 对象没强引用时整条 entry 被回收，常用于监听器映射、附加属性。
- **ThreadLocal 的 Entry**：key 是弱引用（`ThreadLocal` 对象本身没强引用时，key 被回收，value 仍可能泄漏——这是 ThreadLocal 内存泄漏的根源，需 remove）。

## 虚引用：只为了回收时收到通知

虚引用（PhantomReference）最特殊：

- `get()` 永远返回 null——它根本不让你通过虚引用访问对象，所以"虚"。
- 必须配合 `ReferenceQueue` 使用：对象被 GC 时，虚引用对象会入队，程序轮询队列就能知道"那个对象被回收了"，于是去清理关联资源。

最典型的应用是 NIO 的 `DirectByteBuffer`：堆外内存的释放就是靠一个 `Cleaner`（本质是 PhantomReference + ReferenceQueue）——当 DirectByteBuffer 被 GC 时，Cleaner 入队，清理线程发现后调用 `Unsafe.freeMemory` 释放堆外内存。这也是为什么堆外内存释放依赖堆内 DirectByteBuffer 被 GC。

## ReferenceQueue：回收后的"通知机制"

软、弱、虚引用都可以在构造时关联一个 `ReferenceQueue`：

```java
ReferenceQueue<Object> queue = new ReferenceQueue<>();
WeakReference<Object> ref = new WeakReference<>(obj, queue);
// obj 被 GC 后，ref 会被放入 queue
```

后台线程轮询 `queue`，取出引用后做关联清理。这是"引用对象被回收后做后续工作"的标准模式（Cleaner、资源释放都用它）。

## 与 GC 可达性分析的关系

GC 用可达性分析从 GC Roots 出发找存活对象：

- 强引用指向的对象是强可达，不回收。
- 软引用只在内存不足时才被回收，平时不算"阻止回收"的强可达。
- 弱引用、虚引用对应的引用对象在下次 GC 就可被回收，不影响对象被判定为可回收。

换句话说，软 / 弱 / 虚引用给对象"松绑"，让 GC 在需要时能回收，同时给程序一个"回收时通知我"的钩子。

## 小结

- 四种引用强度：强（永不回收）、软（内存不足回收）、弱（下次 GC 回收）、虚（不决定生命周期，只做回收通知）。
- 强引用是内存泄漏主因，弱引用集合（WeakHashMap）能缓解。
- 软引用适合内存敏感缓存，但回收时机不确定。
- ThreadLocal 的 key 是弱引用，value 仍可能泄漏，需手动 remove。
- 虚引用配合 ReferenceQueue 做资源清理，DirectByteBuffer 的堆外内存释放就是典型。

## 参考

本文综合公开 Java 并发与 JVM 教材，核对了四种引用的回收时机、ReferenceQueue 机制与 ThreadLocal / DirectByteBuffer Cleaner 等典型应用场景。
