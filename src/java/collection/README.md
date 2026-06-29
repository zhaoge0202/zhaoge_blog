---
title: "集合"
article: false
breadcrumb: true
editLink: false
next:
  text: "ArrayList 和 LinkedList 到底怎么选？"
  link: "/java/collection/java-collection-arraylist-linkedlist.html"
---

# 集合

## 为什么重要

集合不是 API 背诵题。`ArrayList`、`HashMap`、`ConcurrentHashMap` 背后牵出数据结构、扩容、哈希冲突、并发安全和工程选型，一道题往下追就能看出候选人有没有真正写过服务端代码。

## 知识主线

List 选型 → HashMap 结构与线程安全 → 并发 Map → 有序 Map 与 LRU → Set 去重 → 读多写少 List → Queue 场景

## 题目列表

### List

- [ArrayList 和 LinkedList 到底怎么选？](./java-collection-arraylist-linkedlist.html) — 从数组、链表、扩容、局部性和双端队列替代方案讲清 List 选型。

### Map

- [HashMap 的底层结构和扩容流程是什么？](./java-collection-hashmap-structure.html) — 哈希定位、冲突处理、红黑树化、扩容迁移和容量取整。
- [HashMap 为什么线程不安全？JDK 8 后还会死循环吗？](./java-collection-hashmap-thread-safety.html) — 并发 put、JDK 7 扩容环链、JDK 8 边界和 fail-fast。
- [ConcurrentHashMap 是怎么从分段锁演进到 CAS + synchronized 的？](./java-collection-concurrenthashmap.html) — JDK 7 Segment 到 JDK 8 桶级同步、协助扩容和计数边界。
- [LinkedHashMap 为什么适合做 LRU？](./java-collection-linkedhashmap-lru.html) — 插入顺序、访问顺序、`removeEldestEntry` 和本地缓存边界。

### Set

- [HashSet 为什么能去重？和 HashMap 是什么关系？](./java-collection-hashset.html) — 元素作为 HashMap key、`equals/hashCode` 契约和去重选型。

### 并发集合与队列

- [CopyOnWriteArrayList 适合什么读多写少场景？](./java-collection-copyonwritearraylist.html) — 写时复制、快照读、写入成本和监听器场景。
- [PriorityQueue、DelayQueue、ArrayBlockingQueue 分别解决什么问题？](./java-collection-queue-scenarios.html) — 优先级、延迟消费、有界阻塞和背压。

## 前置知识

Java 基础、数组、链表、哈希表、红黑树、基础并发。

## 目标人群

准备 3-5 年 Java 后端面试，想把集合从“会用 API”提升到“能解释源码路径和工程边界”的读者。
