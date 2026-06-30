---
title: "volatile 能保证什么？不能保证什么？"
description: "volatile 的可见性、禁止重排序原理，以及它管不了的那些事。"
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
    text: "JMM 是什么？happens-before 原则怎么理解？",
    link: "/java/concurrent/java-concurrency-jmm.html",
  }
next:
  {
    text: "synchronized 的底层原理是什么？锁优化怎么回事？",
    link: "/java/concurrent/java-concurrency-synchronized.html",
  }
---

# volatile 能保证什么？不能保证什么？

> volatile 是 Java 最轻量的同步机制，但很多人对它的能力边界理解模糊——它不是"轻量版 synchronized"。

## volatile 解决什么问题？

先看一段经典的"死循环"代码：

```java
boolean running = true; // 普通变量

// 线程 A
while (running) {
    // 做点事
}

// 线程 B
running = false; // 线程 A 可能永远看不到这个修改
```

线程 B 把 `running` 改成 `false`，但线程 A 可能一直在循环。原因是：线程 A 读取 `running` 时，可能一直从自己的工作内存（CPU 缓存/寄存器）中读取旧值，而不是从主内存重新加载。

加上 `volatile` 就能解决：

```java
volatile boolean running = true;
```

`volatile` 告诉 JVM：这个变量是不稳定的，每次使用都要从主内存读取，每次写入都要立即刷新到主内存。

## volatile 的两大保证

### 1. 可见性

`volatile` 变量的写操作会立即刷新到主内存，读操作会强制从主内存重新加载。这意味着：

- 线程 A 写入 `volatile` 变量后，线程 B 读取时一定能看到最新值。
- 通过 happens-before 的 volatile 变量规则和传递性，写 volatile 之前的所有操作对读 volatile 之后的操作也可见。

```java
int a = 0;
volatile boolean flag = false;

// 线程 A
a = 42;           // 操作 1
flag = true;      // 操作 2（volatile 写）

// 线程 B
if (flag) {       // 操作 3（volatile 读）
    int b = a;    // 操作 4：b 一定是 42，不是 0
}
```

操作 2 happens-before 操作 3（volatile 规则），操作 1 happens-before 操作 2（程序顺序规则），操作 3 happens-before 操作 4（程序顺序规则），通过传递性，操作 1 happens-before 操作 4——所以 `a=42` 对线程 B 可见。

### 2. 有序性（禁止重排序）

`volatile` 通过插入**内存屏障**（Memory Barrier）来禁止特定类型的重排序：

| 屏障类型   | 作用                                               |
| ---------- | -------------------------------------------------- |
| StoreStore | 确保之前的普通写已刷新到主内存，再执行 volatile 写 |
| StoreLoad  | 确保 volatile 写对其他处理器可见，之后再读         |
| LoadLoad   | 确保 volatile 读完成后，才执行后面的读             |
| LoadStore  | 确保 volatile 读完成后，才执行后面的写             |

最经典的例子是双重检查锁定（DCL）单例模式：

```java
public class Singleton {
    private static volatile Singleton instance;

    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

`new Singleton()` 不是原子操作，它分三步：分配内存 → 初始化对象 → 将引用指向内存地址。如果不用 `volatile`，JVM 可能将步骤重排为 1→3→2，其他线程在步骤 2 执行前拿到一个未初始化的对象引用。`volatile` 的禁止重排序保证了对象完全构造好后才对其他线程可见。

## volatile 不能保证什么

### 不能保证原子性

```java
volatile int count = 0;

// 10 个线程各执行 1000 次 count++
// 结果不一定等于 10000
```

`count++` 是「读-加-写」三步操作。`volatile` 保证每次读都从主内存读、每次写都刷新到主内存，但在「读」和「写」之间，其他线程可能已经修改了值。

| 操作步骤 | 线程 A     | 线程 B                            |
| -------- | ---------- | --------------------------------- |
| 1        | 读 count=0 |                                   |
| 2        |            | 读 count=0                        |
| 3        | 写 count=1 |                                   |
| 4        |            | 写 count=1（覆盖了线程 A 的结果） |

需要原子性时，用 `AtomicInteger`、`synchronized` 或 `LongAdder`。

### 不能保证复合操作的线程安全

```java
volatile Map<String, String> cache = new HashMap<>();

// 这段代码仍然不安全
if (!cache.containsKey(key)) {
    cache.put(key, value); // containsKey 和 put 之间可能被其他线程插入
}
```

`volatile` 保证 `cache` 引用的可见性，但不保证 `HashMap` 内部操作的线程安全。

## volatile 的典型使用场景

### 场景一：状态标志位

```java
volatile boolean shutdown = false;

// 工作线程
while (!shutdown) {
    // 处理任务
}

// 关闭线程
shutdown = true;
```

一个线程写标志，其他线程读标志，不涉及复合操作——`volatile` 完美胜任。

### 场景二：DCL 单例模式

见上文示例。`volatile` 防止对象初始化重排序。

### 场景三：一次性安全发布

```java
volatile Config config;

// 初始化线程
config = loadConfig(); // volatile 写，确保 Config 完全构造好后对其他线程可见

// 其他线程
if (config != null) {
    useConfig(config); // 一定能看到完全初始化的 Config
}
```

## volatile 和 synchronized 的对比

| 对比项   | `volatile`                | `synchronized`                   |
| -------- | ------------------------- | -------------------------------- |
| 原子性   | 不保证                    | 保证                             |
| 可见性   | 保证                      | 保证                             |
| 有序性   | 保证                      | 保证                             |
| 是否阻塞 | 不阻塞                    | 可能阻塞                         |
| 粒度     | 变量级别                  | 代码块/方法级别                  |
| 性能     | 轻量                      | 较重（但 JDK 6+ 优化后差距缩小） |
| 适用场景 | 状态标志、DCL、一次性发布 | 复合操作、临界区保护             |

选型原则：如果只需要可见性且操作本身是原子的（如读写 boolean），用 `volatile`；如果需要互斥或复合操作，用 `synchronized`。

## 小结

- volatile 保证**可见性**（写后立即刷新主内存，读时强制从主内存加载）和**有序性**（通过内存屏障禁止重排序）。
- volatile **不保证原子性**，`i++` 这种复合操作仍然需要 `AtomicInteger` 或锁。
- volatile 的典型场景：状态标志位、DCL 单例、一次性安全发布。
- volatile 和 synchronized 不是替代关系，而是互补——前者管可见性，后者管互斥。

## 参考

基于 Oracle Java SE API Documentation、Java Language Specification、OpenJDK JEP 与 java.util.concurrent 官方 API 中并发、JMM、锁、线程池和虚拟线程相关内容整理。
