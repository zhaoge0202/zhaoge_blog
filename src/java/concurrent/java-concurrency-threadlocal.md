---
title: "ThreadLocal 原理是什么？为什么会内存泄漏？"
description: "从 ThreadLocalMap 到弱引用清理，讲透线程隔离原理与内存泄漏防线。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "高频"
  - "原理深入"
  - "细节题"
prev:
  {
    text: "线程池 7 个参数怎么理解？执行流程是怎样的？",
    link: "/java/concurrent/java-concurrency-thread-pool.html",
  }
next:
  {
    text: "ConcurrentHashMap 是怎么保证线程安全的？",
    link: "/java/concurrent/java-concurrency-concurrent-collections.html",
  }
---

# ThreadLocal 原理是什么？为什么会内存泄漏？

> ThreadLocal 不是为了解决线程安全问题，而是提供线程隔离——每个线程拥有变量的独立副本，互不干扰。

## ThreadLocal 的基本用法

```java
private static final ThreadLocal<SimpleDateFormat> formatter =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

// 使用
String dateStr = formatter.get().format(new Date());

// 用完清理
formatter.remove();
```

每个线程调用 `get()` 拿到的是自己那份副本，不会被其他线程影响。

## 核心数据结构

ThreadLocal 的实现思路和很多人的直觉不同：**不是 ThreadLocal 存储每个线程的值，而是每个 Thread 持有一个 ThreadLocalMap，以 ThreadLocal 为 key 存储值。**

```
Thread
  └─ threadLocals (ThreadLocalMap)
       └─ Entry[]
            └─ Entry(key=ThreadLocal 弱引用, value=实际值)
```

关键点：

1. `Thread` 类有一个 `ThreadLocal.ThreadLocalMap` 类型的字段 `threadLocals`。
2. `ThreadLocalMap` 的 Entry 的 key 是 `ThreadLocal` 的**弱引用**（继承 `WeakReference`）。
3. `ThreadLocalMap` 没有链表结构，用**开放寻址法**（线性探测）解决哈希冲突。

### 哈希算法：为什么用 0x61c88647

ThreadLocalMap 用**开放寻址法**，哈希冲突时线性探测。如果多个 ThreadLocal 的哈希值挤在一起，探测效率会很差。

ThreadLocal 用了一个魔法数 `0x61c88647`（黄金分割数）作为增量：

```java
private static final int HASH_INCREMENT = 0x61c88647;

// 每个 ThreadLocal 实例的 threadLocalHashCode
private final int threadLocalHashCode = nextHashCode();

private static AtomicInteger nextHashCode = new AtomicInteger();

private static int nextHashCode() {
    return nextHashCode.getAndAdd(HASH_INCREMENT);
}
```

这个增量让连续创建的 ThreadLocal 在数组中**均匀分布**——每个 ThreadLocal 的哈希值之间的间隔正好是黄金分割比例，能把元素均匀地散布在整个数组中，减少冲突。

### set() 的源码流程

```java
public void set(T value) {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t); // t.threadLocals
    if (map != null) {
        map.set(this, value);
    } else {
        createMap(t, value); // 第一次访问时延迟创建
    }
}

// ThreadLocalMap.set 的核心逻辑
private void set(ThreadLocal<?> key, Object value) {
    Entry[] tab = table;
    int len = tab.length;
    int i = key.threadLocalHashCode & (len-1); // 定位槽位

    // 线性探测：从 i 开始往后找
    for (Entry e = tab[i]; e != null; e = tab[i = nextIndex(i, len)]) {
        ThreadLocal<?> k = e.get();
        if (k == key) {           // 找到了，覆盖旧值
            e.value = value;
            return;
        }
        if (k == null) {          // key 被 GC 回收了（弱引用）
            replaceStaleEntry(key, value, i); // 替换过期 Entry，顺便清理
            return;
        }
    }
    // 没找到，新建 Entry
    tab[i] = new Entry(key, value);
    int sz = ++size;
    if (!cleanSomeSlots(i, sz) && sz >= threshold) // 启发式清理 + 检查是否需要扩容
        rehash(); // 扩容（容量翻倍）
}
```

> 扩容阈值是 `len * 2/3`，扩容后容量翻倍，同时清理所有 key=null 的过期 Entry。

### 为什么 key 用弱引用？

如果 key 是强引用，即使外部不再使用 ThreadLocal 对象，只要线程还活着，ThreadLocalMap 就会一直持有它，导致无法回收。用弱引用后，当 ThreadLocal 的外部强引用消失后，GC 可以回收 key，留下一个 key=null 的 Entry。

### 为什么不用 HashMap？

`ThreadLocalMap` 是定制的 Map，不实现 `Map` 接口。它用线性探测而非链表法解决冲突，好处是内存紧凑、访问快，坏处是冲突多了性能下降——但单个线程的 ThreadLocal 数量通常不多，线性探测够用。

## 内存泄漏问题

### 泄漏的根因

```
Thread (强引用) → ThreadLocalMap → Entry
                                    ├─ key: WeakReference<ThreadLocal> → ThreadLocal（可被 GC 回收）
                                    └─ value: 强引用 → 实际值对象（无法被 GC 回收）
```

当 ThreadLocal 的外部强引用消失后，key 被 GC 回收变成 null，但 **value 仍然被 Entry 强引用**。如果线程长期存活（比如线程池中的线程），这些 key=null 的 Entry 的 value 就永远不会被回收——这就是内存泄漏。

### 清理机制

ThreadLocalMap 有两种过期 Entry 清理机制：

| 机制                                  | 触发时机                         | 行为                                                                        |
| ------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| **探测式清理**（`expungeStaleEntry`） | set/get 时遇到 key=null 的 Entry | 从当前位置往后清理所有过期 Entry，同时 rehash 正常 Entry 使其更靠近正确位置 |
| **启发式清理**（`cleanSomeSlots`）    | set 新 Entry 后                  | 对数级扫描（log N），发现过期 Entry 则触发探测式清理                        |

这两种机制在 `set()` 和 `get()` 中都会被调用，但它们是**机会性清理**——只有操作到相关位置时才触发。如果某个 ThreadLocal 用完后不再被任何线程访问，它的 value 就不会被清理。

### 正确的防护

**用完 ThreadLocal 一定要调 `remove()`。** 这是最可靠的防线：

```java
ThreadLocal<UserContext> context = new ThreadLocal<>();
try {
    context.set(currentUser);
    // 业务逻辑
} finally {
    context.remove(); // 清除当前线程的 Entry
}
```

特别是在线程池环境下，线程是复用的。如果不 `remove()`，上一个任务的 ThreadLocal 数据会残留到下一个任务，既可能导致内存泄漏，也可能导致业务数据串号。

## InheritableThreadLocal

普通 ThreadLocal 无法在子线程中获取父线程的数据：

```java
ThreadLocal<String> tl = new ThreadLocal<>();
tl.set("parent");

new Thread(() -> {
    System.out.println(tl.get()); // null
}).start();
```

`InheritableThreadLocal` 解决了这个问题——子线程创建时会把父线程的 `InheritableThreadLocal` 数据拷贝过来。但它有线程池兼容性问题：线程池复用线程，不会重新触发 `init()` 拷贝。阿里开源的 `TransmittableThreadLocal` 专门解决这个问题。

## 典型使用场景

### 场景一：链路追踪 TraceId

```java
// 拦截器中设置
MDC.put("traceId", UUID.randomUUID().toString());

// 日志中自动输出 traceId（logback 配置 %X{traceId}）
log.info("processing order");

// 请求结束时清理
MDC.remove("traceId");
```

SLF4J 的 `MDC` 底层就是 ThreadLocal。

### 场景二：线程不安全对象的复用

`SimpleDateFormat` 是线程不安全的。每个线程用 ThreadLocal 持有自己的实例，避免每次 `new` 的开销：

```java
private static final ThreadLocal<SimpleDateFormat> TL_FORMAT =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"));
```

### 场景三：用户上下文传递

```java
private static final ThreadLocal<UserContext> USER_CONTEXT = new ThreadLocal<>();

// Filter 中设置
USER_CONTEXT.set(userContext);

// 业务代码中获取
UserContext ctx = USER_CONTEXT.get();
```

## 容易踩的坑

**线程池中忘记 remove。** 这是最高频的生产事故。线程池复用线程，上一个任务的 ThreadLocal 数据会残留，导致数据串号或内存泄漏。

**用 ThreadLocal 传递大对象。** 每个线程都会有一份副本，大对象在几百个线程下会占用大量内存。虚拟线程场景下更严重——百万级虚拟线程各持一份大对象副本。

**用 ThreadLocal 替代方法参数。** ThreadLocal 适合隐式上下文传递，不适合替代显式参数。过度使用会让代码可读性变差、调试困难。

## 小结

- ThreadLocal 的数据结构是 Thread 持有 ThreadLocalMap，以 ThreadLocal（弱引用）为 key 存储 value。
- 内存泄漏根因：key 被 GC 回收后 value 仍被强引用，线程长期存活时 value 无法回收。
- 防护措施：用完一定调 `remove()`，尤其在线程池环境下。
- 典型场景：TraceId 传递、线程不安全对象复用、用户上下文。
- InheritableThreadLocal 解决父子线程传递，线程池场景用 TransmittableThreadLocal。

## 参考

基于 Oracle Java SE API Documentation、Java Language Specification、OpenJDK JEP 与 java.util.concurrent 官方 API 中并发、JMM、锁、线程池和虚拟线程相关内容整理。
