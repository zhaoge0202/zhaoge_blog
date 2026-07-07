---
title: "LinkedHashMap 为什么适合做 LRU？"
description: "从双向链表、访问顺序和淘汰钩子讲清 LinkedHashMap 的 LRU 能力。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "高频"
  - "项目实战"
  - "原理深入"
prev:
  {
    text: "ConcurrentHashMap 是怎么从分段锁演进到 CAS + synchronized 的？",
    link: "/java/collection/java-collection-concurrenthashmap.html",
  }
next:
  {
    text: "TreeMap 和 TreeSet 为什么能有序？红黑树在这里怎么用？",
    link: "/java/collection/java-collection-treemap-treeset.html",
  }
---

# LinkedHashMap 为什么适合做 LRU？

> `LinkedHashMap` 在 `HashMap` 的哈希表之外维护了一条双向链表，开启访问顺序后就能天然表达“最近使用”。

## LinkedHashMap 比 HashMap 多了什么？

`HashMap` 只关心通过 key 快速找到 value，不承诺遍历顺序。`LinkedHashMap` 继承 `HashMap`，额外把节点串成双向链表：

```text
HashMap bucket 负责查找
双向链表负责顺序

head <-> node1 <-> node2 <-> node3 <-> tail
```

所以它同时有两个视角：

1. 查找：仍然走哈希表。
2. 遍历：沿着链表从 head 走到 tail。

默认情况下，链表按插入顺序维护。也就是说，先 put 进去的先被遍历出来。

## accessOrder=true 改变了什么？

`LinkedHashMap` 有一个构造参数 `accessOrder`：

```java
Map<Integer, String> map = new LinkedHashMap<>(16, 0.75f, true);
```

当它为 `true` 时，链表不再只表示插入顺序，而是表示访问顺序。访问过的节点会被移动到链表尾部。

假设容量为 3：

```text
put 1,2,3       head [1, 2, 3] tail
get 1           head [2, 3, 1] tail
```

此时链表头就是最久没有被访问的节点，链表尾就是最近访问的节点。

源码里这个动作发生在 `afterNodeAccess`：`get` 命中后，如果开启访问顺序，就把当前节点从原位置摘下来，挂到尾部。

## removeEldestEntry 如何完成淘汰？

做 LRU 还差一步：容量满了要淘汰最久未使用的节点。

`LinkedHashMap` 提供了一个钩子方法 `removeEldestEntry`。每次插入后，它会检查是否要移除链表头节点。

一个最小实现：

```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    LruCache(int capacity) {
        super(capacity, 0.75f, true);
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}
```

走一个例子：

```java
LruCache<Integer, String> cache = new LruCache<>(3);
cache.put(1, "A");
cache.put(2, "B");
cache.put(3, "C");
cache.get(1);
cache.put(4, "D");
```

链表变化：

```text
put 1,2,3       [1, 2, 3]
get 1           [2, 3, 1]
put 4           [2, 3, 1, 4]
淘汰 head=2     [3, 1, 4]
```

最终淘汰的是 2，不是 1。因为 1 被访问过，已经移动到尾部。

## 它适合什么级别的缓存？

`LinkedHashMap` 适合做“单 JVM、容量固定、逻辑简单”的本地 LRU。

例如：

- 小型元数据缓存。
- 最近访问 ID 记录。
- 单测或算法题里的 LRU 实现。
- 简单工具类里的本地短生命周期缓存。

但生产缓存通常还需要这些能力：

| 能力         | LinkedHashMap 是否自带 |
| ------------ | ---------------------- |
| 线程安全     | 否                     |
| 过期时间     | 否                     |
| 最大权重     | 否                     |
| 命中率统计   | 否                     |
| 异步加载     | 否                     |
| 淘汰监听     | 否                     |
| 分布式一致性 | 否                     |

如果业务真的依赖缓存稳定性，通常应该考虑 Caffeine、Guava Cache 或 Redis，而不是自己拿 `LinkedHashMap` 拼完整缓存系统。

## 容易踩的坑

1. `accessOrder=false` 是默认值，只能保持插入顺序，不能做 LRU。
2. 访问会调整顺序，但淘汰通常发生在插入后，不是每次 get 都淘汰。
3. `LinkedHashMap` 不是线程安全的，多线程缓存需要外部同步或换组件。
4. 它的遍历顺序可依赖，但 `HashMap` 的遍历顺序不能依赖。
5. 用它做 LRU 是“容量淘汰”，不是“按时间过期”。

## 小结

- `LinkedHashMap` 在哈希表之外维护双向链表，因此能稳定遍历顺序。
- 默认按插入顺序；`accessOrder=true` 后按访问顺序。
- LRU 的关键是访问后移到尾部，插入后通过 `removeEldestEntry` 淘汰头部。
- 它适合简单本地 LRU，不适合直接承担复杂生产缓存能力。

## 参考

基于 Oracle Java SE API Documentation 与 OpenJDK Java Collections Framework 源码中 List、Map、Set、Queue、Concurrent Collections 等相关内容整理。
