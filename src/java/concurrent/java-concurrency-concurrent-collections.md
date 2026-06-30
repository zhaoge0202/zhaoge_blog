---
title: "ConcurrentHashMap 是怎么保证线程安全的？"
description: "从分段锁到 CAS+synchronized，讲透 JDK 7/8 ConcurrentHashMap 与并发容器选型。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "高频"
  - "原理深入"
  - "必会"
prev:
  {
    text: "ThreadLocal 原理是什么？为什么会内存泄漏？",
    link: "/java/concurrent/java-concurrency-threadlocal.html",
  }
next:
  {
    text: "CompletableFuture 怎么做异步任务编排？",
    link: "/java/concurrent/java-concurrency-completablefuture.html",
  }
---

# ConcurrentHashMap 是怎么保证线程安全的？

> `HashMap` 线程不安全，`HashTable` 用一把全局锁性能太差。`ConcurrentHashMap` 是 Java 提供的高并发 Map，它的实现方式在 JDK 7 和 JDK 8 之间有显著变化。

## JDK 7：分段锁（Segment）

JDK 7 的 ConcurrentHashMap 把整个桶数组分成多个 Segment（默认 16 个），每个 Segment 是一把独立的锁。

```
ConcurrentHashMap
  └─ Segment[] (16 个段)
       └─ Segment (继承 ReentrantLock)
            └─ HashEntry[]
```

不同线程访问不同 Segment 时不需要竞争锁，并发度等于 Segment 数量。

**缺点**：Segment 数量固定，并发度上限受限；Segment 本身是 ReentrantLock，锁粒度仍然是段级别。

## JDK 8：CAS + synchronized

JDK 8 摒弃了 Segment，采用 `Node + CAS + synchronized`：

```
ConcurrentHashMap
  └─ Node[] (桶数组)
       └─ Node / TreeNode (链表/红黑树)
```

锁粒度细化到**每个桶的头节点**——只要 hash 不冲突，多个线程可以同时操作不同的桶，互不影响。

### put 操作的完整流程

```java
// 简化版 JDK 8 ConcurrentHashMap.putVal
final V putVal(K key, V value, boolean onlyIfAbsent) {
    int hash = spread(key.hashCode());
    int binCount = 0;
    for (Node<K,V>[] tab = table;;) {
        Node<K,V> f; int n, i, fh;
        // 1. 桶为空 → CAS 插入（无锁）
        if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            if (casTabAt(tab, i, null, new Node<>(hash, key, value)))
                break;
        }
        // 2. 桶头节点是 ForwardingNode → 正在扩容，当前线程帮忙迁移
        else if ((fh = f.hash) == MOVED)
            tab = helpTransfer(tab, f);
        // 3. 桶非空 → synchronized 锁住头节点
        else {
            synchronized (f) {
                if (tabAt(tab, i) == f) { // 二次检查，防止其他线程已修改
                    // 链表：遍历到尾部插入 / 覆盖已有 key
                    // 红黑树：调用 TreeNode 的 put 方法
                }
            }
            if (binCount >= TREEIFY_THRESHOLD)
                treeifyBin(tab, i); // 链表长度 ≥ 8 → 转红黑树
            break;
        }
    }
    addCount(1L, binCount); // 更新元素计数
    return null;
}
```

关键点：

1. 桶为空时用 CAS 无锁插入，不需要 synchronized。
2. 桶非空时只锁住桶头节点，不影响其他桶。
3. 扩容时通过 `ForwardingNode`（hash=MOVED）标记，其他线程看到这个标志会帮忙迁移数据。

### 扩容：transfer 机制

ConcurrentHashMap 的扩容是**多线程并行**的：

1. 触发条件：元素总数 > `sizeCtl`（阈值 = 桶数 × 0.75）。
2. 创建一个 2 倍大小的新数组。
3. 多个线程各自负责迁移旧数组的一段（默认每个线程 16 个桶）。
4. 迁移完一个桶后，在旧数组对应位置放 `ForwardingNode`，后续读请求转发到新数组。

> 这个设计很巧妙——扩容不是阻塞操作，读写请求在扩容期间仍然可以继续。读请求遇到 ForwardingNode 会被转发到新数组，写请求遇到 ForwardingNode 会帮忙迁移。

### size() 怎么算

ConcurrentHashMap 的 `size()` 不维护一个精确的计数器（那样会成为瓶颈）。它用了一个类似 LongAdder 的思路：

```
baseCount + sumCell()
```

- 无竞争时直接 CAS 更新 `baseCount`。
- 有竞争时分散到 `CounterCell[]` 数组，`size()` 时求和。

所以 `size()` 返回的是一个**近似值**——遍历过程中其他线程可能还在修改。这是并发容器为性能做的权衡。

### 弱一致性迭代

ConcurrentHashMap 的迭代器是**弱一致性**的：迭代器创建后只保证看到创建那一刻已存在的元素，迭代期间其他线程的新增/删除不一定反映出来。这和 `HashMap` 的 fail-fast 不同——`HashMap` 迭代时被修改会抛 `ConcurrentModificationException`，而 ConcurrentHashMap 不会。

> 这不是缺陷，而是设计选择。并发场景下强一致迭代的代价太高（需要全局锁），弱一致性是合理的权衡。

### 和 HashMap 的结构差异

| 特性           | HashMap            | ConcurrentHashMap              |
| -------------- | ------------------ | ------------------------------ |
| 数据结构       | 数组 + 链表/红黑树 | 相同                           |
| 线程安全       | 不安全             | 安全                           |
| null key/value | 允许               | **不允许**                     |
| 锁机制         | 无                 | CAS + synchronized（桶级别）   |
| 并发度         | N/A                | 等于桶数（远大于 JDK 7 的 16） |

> ConcurrentHashMap 不允许 null key 和 null value。原因是：在并发环境下，`get(key)` 返回 null 时无法区分是"不存在"还是"值为 null"——HashMap 可以通过 `containsKey` 辅助判断，但 ConcurrentHashMap 在这两步之间可能被其他线程修改，无法保证一致性。

## 其他常用并发容器

### CopyOnWriteArrayList

适合**读多写少**的场景。核心思想是**写时复制**：

- 读操作：完全无锁，直接读当前数组。
- 写操作：先复制一份新数组，修改新数组，再通过 volatile 引用切换到新数组。

```java
// 写操作（加锁 + 复制）
public boolean add(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        Object[] elements = getArray();
        int len = elements.length;
        Object[] newElements = Arrays.copyOf(elements, len + 1);
        newElements[len] = e;
        setArray(newElements);
        return true;
    } finally {
        lock.unlock();
    }
}

// 读操作（无锁）
public E get(int index) {
    return get(getArray(), index);
}
```

**优点**：读性能极致（无锁）。**缺点**：写操作有复制开销，不适合频繁写入；数据有短暂不一致（读到旧数组）。

### BlockingQueue

阻塞队列是生产者-消费者模式的核心。常见实现：

| 实现                    | 特点                         | 适用场景                         |
| ----------------------- | ---------------------------- | -------------------------------- |
| `ArrayBlockingQueue`    | 有界，数组实现，单锁         | 生产者-消费者，需限制队列大小    |
| `LinkedBlockingQueue`   | 可有界可无界，链表实现，双锁 | 吞吐量较高（默认无界需注意 OOM） |
| `SynchronousQueue`      | 不存储元素，直接传递         | CachedThreadPool 的队列          |
| `PriorityBlockingQueue` | 支持优先级，无界             | 任务有优先级                     |

线程池的 `workQueue` 就是 `BlockingQueue` 的具体实现。

### ConcurrentLinkedQueue

非阻塞队列，用 CAS 实现（无锁），适合高并发且不需要阻塞等待的场景。

### ConcurrentSkipListMap

基于**跳表**实现的并发有序 Map。跳表是多层链表结构，查询时间复杂度 O(log N)。相比红黑树，跳表的插入删除只需要局部加锁，并发性能更好。需要有序 Map 时选它。

## 复合操作的陷阱

**线程安全容器的单个方法是线程安全的，但复合操作不一定。**

```java
ConcurrentHashMap<String, String> map = new ConcurrentHashMap<>();

// 不安全：containsKey 和 put 之间可能被其他线程插入
if (!map.containsKey(key)) {
    map.put(key, value);
}

// 安全：用原子方法
map.putIfAbsent(key, value);
// 或
map.computeIfAbsent(key, k -> createValue());
```

ConcurrentHashMap 提供了丰富的原子复合方法：`putIfAbsent`、`computeIfAbsent`、`computeIfPresent`、`merge`、`replace`。

## 选型指南

| 需求              | 推荐                         |
| ----------------- | ---------------------------- |
| 高并发 Map        | `ConcurrentHashMap`          |
| 读多写少 List     | `CopyOnWriteArrayList`       |
| 生产者-消费者队列 | `ArrayBlockingQueue`（有界） |
| 高并发非阻塞队列  | `ConcurrentLinkedQueue`      |
| 并发有序 Map      | `ConcurrentSkipListMap`      |
| 需要延迟/定时     | `DelayQueue`                 |

## 小结

- JDK 7 用 Segment 分段锁（默认 16 段），JDK 8 改为 CAS + synchronized 锁桶头节点，并发度大幅提升。
- ConcurrentHashMap 不允许 null key/value，避免并发下"不存在"和"值为 null"的歧义。
- CopyOnWriteArrayList 读无锁、写时复制，适合读多写少。
- 线程安全容器的单个方法安全，复合操作需要用 `putIfAbsent`、`computeIfAbsent` 等原子方法。

## 参考

基于 Oracle Java SE API Documentation、Java Language Specification、OpenJDK JEP 与 java.util.concurrent 官方 API 中并发、JMM、锁、线程池和虚拟线程相关内容整理。
