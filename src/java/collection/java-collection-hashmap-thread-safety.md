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

再具体一点，常见风险可以拆成三类：

| 风险             | 发生位置             | 结果                         |
| ---------------- | -------------------- | ---------------------------- |
| 写覆盖           | 空桶判断、链表尾插   | 某个线程写入的节点丢失       |
| 计数错误         | `size++`             | 实际元素数和 `size` 不一致   |
| 结构破坏         | 链表/红黑树/扩容迁移 | 查询异常、遍历异常、数据缺失 |
| 可见性与顺序问题 | table、节点字段发布  | 线程看到中间状态或旧状态     |

这些问题的共同点是：`put` 不是一个不可分割的动作。哪怕最终没有抛异常，也可能已经悄悄丢数据。

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

迁移时它会按旧容量对应的那一位，把原链表拆成低位链和高位链，并尽量保持链表节点的相对顺序。这样就不像头插法那样在迁移时反复倒置链表，经典环链事故的触发条件少了很多。

但这不等于 JDK 8 的 `HashMap` 线程安全：

| 问题              | JDK 8 是否仍可能出现 | 说明                       |
| ----------------- | -------------------- | -------------------------- |
| 并发 put 数据覆盖 | 可能                 | 判断和写入不是原子操作     |
| size 统计不准     | 可能                 | `++size` 不是并发安全操作  |
| 结构不一致        | 可能                 | 链表、树、扩容都无同步保护 |
| JDK 7 环链死循环  | 典型风险降低         | 尾插和新迁移逻辑改变了场景 |

面试里可以这样答：

> JDK 8 后经典的头插扩容死循环问题不再是主要风险，但 HashMap 仍然不能并发写。它没有同步控制，并发 put、resize、size 更新都可能产生数据覆盖或结构异常。

更完整的版本差异可以这样记：

| 维度         | JDK 7 及以前             | JDK 8 之后                   |
| ------------ | ------------------------ | ---------------------------- |
| 冲突结构     | 数组 + 链表              | 数组 + 链表 + 红黑树         |
| 链表插入     | 头插法                   | 尾插法                       |
| 扩容迁移风险 | 并发迁移可能形成环链     | 典型环链风险明显降低         |
| 并发安全性   | 不安全                   | 仍然不安全                   |
| 主要风险     | 环链死循环、覆盖、size错 | 覆盖、size错、结构状态不一致 |

所以不要把版本差异讲成“JDK 8 已经修复了 HashMap 并发问题”。它只是改变了典型事故形态。

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

还有两个边界也要说清：

1. fail-fast 是尽力而为，不承诺一定抛异常；不能把它当成并发正确性的证明。
2. 单线程里也可能触发 fail-fast，只要遍历时绕过迭代器结构性修改集合即可。

## volatile HashMap 有用吗？

把引用声明成 `volatile` 只能保证“线程能看到最新的 map 引用”，不能保证 `HashMap` 内部操作安全：

```java
private volatile Map<Long, String> cache = new HashMap<>();
```

这个写法最多解决引用替换的可见性，例如把整个 `cache` 指向一个新 Map。但如果多个线程仍然对同一个
`HashMap` 实例执行 `put/remove/resize`，内部链表、红黑树、table 和 size 的修改还是没有互斥，也没有原子性。

如果想用不可变快照，可以采用“构建新 Map 后整体替换”的模式，并且发布出去的 Map 不再被修改：

```java
Map<Long, String> next = new HashMap<>(oldCache);
next.put(userId, status);
cache = Map.copyOf(next);
```

这和“volatile 修饰一个可变 HashMap，然后大家一起改”完全不是一回事。

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

如果使用同步包装，迭代时要锁住同一个包装对象：

```java
Map<Long, String> map = Collections.synchronizedMap(new HashMap<>());

synchronized (map) {
    for (Map.Entry<Long, String> entry : map.entrySet()) {
        consume(entry);
    }
}
```

只包装不加外层同步，遍历期间仍然可能被其他线程修改，出现 fail-fast 或读到不一致状态。

`ConcurrentHashMap` 更推荐把复合语义交给原子 API：

```java
UserSession session = sessions.computeIfAbsent(
    userId,
    id -> new UserSession(id)
);
```

不过计算函数要保持短小、无副作用，不要在里面做远程调用、长事务，或递归修改同一个 Map。否则会把桶级锁持有时间拉长，甚至引入难排查的嵌套更新问题。

## 容易踩的坑

1. “JDK 8 HashMap 不会死循环，所以线程安全了”是错的。
2. `volatile HashMap` 也不解决问题，引用可见不代表内部结构修改原子。
3. fail-fast 是错误检测机制，不是并发控制机制。
4. `ConcurrentHashMap` 也不保证 `containsKey + put` 这种复合操作自动原子。
5. `synchronizedMap` 的迭代要手动在外层同步，不能只依赖方法包装。

## 小结

- `HashMap` 没有同步控制，并发写会有数据覆盖、size 不准、结构异常等风险。
- JDK 7 的经典问题是并发扩容头插法可能形成环链，导致查询死循环。
- JDK 8 改为尾插和新的迁移方式，但仍然不能并发写。
- fail-fast 只能尽早暴露错误修改，不能保证线程安全。
- 并发 Map 优先用 `ConcurrentHashMap`，复合逻辑用原子方法表达。

## 参考

基于 Oracle Java SE API Documentation 与 OpenJDK Java Collections Framework 源码中 List、Map、Set、Queue、Concurrent Collections 等相关内容整理。
