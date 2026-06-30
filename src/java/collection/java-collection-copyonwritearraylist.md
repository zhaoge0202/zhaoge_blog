---
title: "CopyOnWriteArrayList 适合什么读多写少场景？"
description: "从写时复制、快照读和写入成本讲清 CopyOnWriteArrayList 选型。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "进阶"
  - "项目实战"
  - "细节题"
prev:
  {
    text: "HashSet 为什么能去重？和 HashMap 是什么关系？",
    link: "/java/collection/java-collection-hashset.html",
  }
next:
  {
    text: "PriorityQueue、DelayQueue、ArrayBlockingQueue 分别解决什么问题？",
    link: "/java/collection/java-collection-queue-scenarios.html",
  }
---

# CopyOnWriteArrayList 适合什么读多写少场景？

> `CopyOnWriteArrayList` 用“写时复制”换来无锁读取，适合小集合、读远多于写、允许快照读的场景。

## 它解决了什么问题？

普通 `ArrayList` 不是线程安全的。老容器 `Vector` 虽然线程安全，但几乎所有方法都加同步，读读之间也会互相阻塞。

`CopyOnWriteArrayList` 换了一个思路：

```text
读：直接读当前数组，不加锁
写：加锁，复制一份新数组，在新数组上改，再发布新数组
```

它底层有一个 `volatile Object[] array`。读线程拿到哪个数组引用，就读哪个数组；写线程不会在原数组上改，而是复制出新数组。

## 写时复制流程怎么走？

以 `add(e)` 为例：

```text
旧数组：[A, B, C]
写线程加锁
复制新数组：[A, B, C, _]
写入元素：[A, B, C, D]
volatile 发布新数组
释放锁
```

这个过程有几个关键点：

1. 写写互斥，靠锁保证同一时间只有一个写线程复制和发布。
2. 读不加锁，读线程可能看到旧数组，也可能看到新数组。
3. 每次写都复制数组，写入成本是 O(n)。
4. 它没有 `ArrayList` 那种按 1.5 倍扩容的逻辑，写一次就生成一个刚好需要的新数组。

## 为什么读快但不一定读到最新？

读操作大致是：

```java
Object[] snapshot = array;
return snapshot[index];
```

如果读线程刚拿到旧数组引用，写线程随后完成了新增并发布新数组，读线程仍然会从旧数组读取。

这不是 bug，而是它的设计：读操作看到的是一个稳定快照。

适合它的场景通常不要求“每一次读都必须看到刚刚写入的最新值”，例如：

- 监听器列表。
- 白名单、灰度规则的小集合快照。
- 配置项订阅者列表。
- 读远多于写的本地路由表。

比如事件监听器：

```java
private final CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();

public void publish(Event event) {
    for (Listener listener : listeners) {
        listener.onEvent(event);
    }
}
```

发布事件时遍历不需要加锁。即使遍历期间新增监听器，也不影响当前这次发布的快照。

## 哪些场景不适合？

不要看到“线程安全 List”就直接用它。

| 不适合场景       | 原因                               |
| ---------------- | ---------------------------------- |
| 写入频繁         | 每次写都复制数组，CPU 和内存成本高 |
| 集合很大         | 复制大数组成本明显                 |
| 必须强实时读最新 | 读线程可能看到旧快照               |
| 需要复杂条件更新 | 多步骤逻辑仍要额外同步             |

例如一个高频聊天消息列表、订单流水列表、实时指标列表，都不适合用它承载持续写入。

## 和其他 List 怎么选？

| 容器                           | 读性能     | 写性能     | 适合场景                       |
| ------------------------------ | ---------- | ---------- | ------------------------------ |
| `ArrayList`                    | 快         | 快         | 单线程或外部保证同步           |
| `Vector`                       | 加锁读     | 加锁写     | 旧代码兼容，不推荐新写         |
| `Collections.synchronizedList` | 方法级同步 | 方法级同步 | 简单同步包装，迭代仍需外部同步 |
| `CopyOnWriteArrayList`         | 无锁快照读 | 复制数组写 | 读多写少的小集合               |

如果只是偶尔注册监听器、频繁广播通知，`CopyOnWriteArrayList` 很合适。如果读写都很频繁，应该重新考虑数据结构和同步策略。

## 容易踩的坑

1. 读无锁不等于读到最新，它读到的是某个时刻的数组快照。
2. 线程安全的是单个方法，不代表多个方法组合逻辑天然原子。
3. 写入不是“扩容”，而是每次复制新数组。
4. 迭代器通常不支持修改操作，不能按普通 `ArrayList` 迭代器的习惯使用。
5. 大集合频繁写会造成大量数组复制和临时对象。

## 小结

- `CopyOnWriteArrayList` 的核心是 `volatile array + 写锁 + 复制新数组`。
- 读操作不加锁，写操作加锁并复制数组。
- 它适合读多写少、小集合、允许快照读的场景。
- 它不适合频繁写、大数据量、强实时一致读取。
- 选它之前先问：写入成本和旧快照语义，业务能不能接受？

## 参考

基于 Oracle Java SE API Documentation 与 OpenJDK Java Collections Framework 源码中 List、Map、Set、Queue、Concurrent Collections 等相关内容整理。
