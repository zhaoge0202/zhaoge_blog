---
title: "HashMap 为什么线程不安全？JDK 8 后还会死循环吗？"
description: "从并发 put、扩容和 fail-fast 讲清 HashMap 的线程安全边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "高频"
  - "原理深入"
  - "细节题"
prev:
  {
    text: "HashMap 的底层结构和扩容流程是什么？",
    link: "/java/collection/java-collection-hashmap-structure.html",
  }
next:
  {
    text: "ConcurrentHashMap 是怎么从分段锁演进到 CAS + synchronized 的？",
    link: "/java/collection/java-collection-concurrenthashmap.html",
  }
---

# HashMap 为什么线程不安全？JDK 8 后还会死循环吗？

> JDK 8 的 `HashMap` 降低了 JDK 7 并发扩容形成环链的典型风险，但它仍然不是线程安全容器。

## 线程不安全到底不安全在哪里？

`HashMap` 内部没有锁，也没有 CAS。并发写时，下面这些动作都可能交错：

- 判断桶是否为空。
- 修改链表或红黑树指针。
- 覆盖旧 value。
- `size++`。
- 触发扩容和迁移节点。

单线程看起来是一条顺序流程，多线程下就可能变成：

```text
线程 A：发现 table[i] 为空
线程 B：发现 table[i] 为空
线程 B：放入 B 节点
线程 A：继续按旧判断放入 A 节点
结果：B 的写入可能被覆盖
```

这类问题不需要复杂扩容就能出现。只要多个线程同时改同一个 `HashMap`，就不能保证结构和数据一致。

## JDK 7 的死循环是怎么回事？

JDK 7 的 `HashMap` 扩容迁移链表时使用头插法。多个线程同时扩容时，链表节点顺序可能被反转交错，最终形成环。

一旦桶链表形成环，后续 `get` 遍历这个桶时就可能一直走不出去：

```text
A -> B -> C
     ↑    │
     └────┘
```

这就是很多资料说的“并发 HashMap 导致 CPU 100%”的经典来源。

但这里要注意边界：这是 JDK 7 及以前版本的典型问题，不应该不加版本地背成“HashMap 一定会死循环”。

## JDK 8 后还会死循环吗？

JDK 8 改了扩容迁移逻辑，链表插入也改成尾插，典型的 JDK 7 头插扩容环链问题被规避了很多。

但这不等于 JDK 8 的 `HashMap` 线程安全：

| 问题              | JDK 8 是否仍可能出现 | 说明                       |
| ----------------- | -------------------- | -------------------------- |
| 并发 put 数据覆盖 | 可能                 | 判断和写入不是原子操作     |
| size 统计不准     | 可能                 | `++size` 不是并发安全操作  |
| 结构不一致        | 可能                 | 链表、树、扩容都无同步保护 |
| JDK 7 环链死循环  | 典型风险降低         | 尾插和新迁移逻辑改变了场景 |

面试里可以这样答：

> JDK 8 后经典的头插扩容死循环问题不再是主要风险，但 HashMap 仍然不能并发写。它没有同步控制，并发 put、resize、size 更新都可能产生数据覆盖或结构异常。

## fail-fast 能保证线程安全吗？

不能。

`HashMap`、`ArrayList` 等集合迭代时会维护一个修改计数。迭代器创建时记录期望值，遍历过程中发现实际修改次数变了，就尽快抛出 `ConcurrentModificationException`。

这叫 fail-fast。它的作用是“尽早发现你在错误地修改集合”，不是“帮你把并发改安全”。

一个单线程例子也会触发：

```java
Map<Long, String> map = new HashMap<>();
map.put(1L, "paid");
map.put(2L, "created");

for (Long id : map.keySet()) {
    if (id == 2L) {
        map.remove(id); // 可能触发 ConcurrentModificationException
    }
}
```

正确做法是用迭代器自己的 `remove`，或者先收集待删除 key，再统一删除。

## 并发场景该怎么选？

如果多个线程会同时读写 Map，通常优先考虑 `ConcurrentHashMap`：

```java
ConcurrentHashMap<Long, UserSession> sessions = new ConcurrentHashMap<>();
sessions.putIfAbsent(userId, new UserSession(userId));
```

不要写成：

```java
if (!sessions.containsKey(userId)) {
    sessions.put(userId, new UserSession(userId));
}
```

即使是 `ConcurrentHashMap`，单个方法是线程安全的，复合操作也要用 `putIfAbsent`、`computeIfAbsent` 这类原子方法表达。

`Collections.synchronizedMap(new HashMap<>())` 也能做到基本同步，但锁粒度粗，迭代还要手动在外层同步。高并发读写下，一般不作为首选。

## 容易踩的坑

1. “JDK 8 HashMap 不会死循环，所以线程安全了”是错的。
2. `volatile HashMap` 也不解决问题，引用可见不代表内部结构修改原子。
3. fail-fast 是错误检测机制，不是并发控制机制。
4. `ConcurrentHashMap` 也不保证 `containsKey + put` 这种复合操作自动原子。

## 小结

- `HashMap` 没有同步控制，并发写会有数据覆盖、size 不准、结构异常等风险。
- JDK 7 的经典问题是并发扩容头插法可能形成环链，导致查询死循环。
- JDK 8 改为尾插和新的迁移方式，但仍然不能并发写。
- fail-fast 只能尽早暴露错误修改，不能保证线程安全。
- 并发 Map 优先用 `ConcurrentHashMap`，复合逻辑用原子方法表达。

## 参考

综合自《HashMap 源码分析》《Java 集合常见面试题总结》，并按 JDK 7/JDK 8 行为差异重新梳理了死循环、数据覆盖、fail-fast 与并发容器选型边界。
