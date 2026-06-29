---
title: "PriorityQueue、DelayQueue、ArrayBlockingQueue 分别解决什么问题？"
description: "用典型场景区分优先级队列、延迟队列和有界阻塞队列。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "进阶"
  - "项目实战"
  - "体系化"
prev:
  {
    text: "CopyOnWriteArrayList 适合什么读多写少场景？",
    link: "/java/collection/java-collection-copyonwritearraylist.html",
  }
next: { text: "并发", link: "/java/concurrent/" }
---

# PriorityQueue、DelayQueue、ArrayBlockingQueue 分别解决什么问题？

> 队列不只代表 FIFO：有的按优先级出队，有的到期后才能出队，有的用阻塞和容量做背压。

## 先区分 Queue、Deque、BlockingQueue

`Queue` 表示“排队”，但不等于一定先进先出。`PriorityQueue` 就是反例，它按优先级出队。

几个概念先摆清：

| 类型            | 核心语义                        | 典型实现                           |
| --------------- | ------------------------------- | ---------------------------------- |
| `Queue`         | 一端入队，一端出队              | `ArrayDeque`、`PriorityQueue`      |
| `Deque`         | 两端都能入队出队                | `ArrayDeque`、`LinkedList`         |
| `BlockingQueue` | 队列为空/满时可阻塞生产消费线程 | `ArrayBlockingQueue`、`DelayQueue` |

`BlockingQueue` 的 API 还要按失败行为区分：

| 操作类型 | 满/空时行为      | 入队方法            | 出队方法           |
| -------- | ---------------- | ------------------- | ------------------ |
| 抛异常   | 失败直接抛异常   | `add`               | `remove`           |
| 特殊值   | 失败返回特殊值   | `offer`             | `poll`             |
| 一直等   | 阻塞直到成功     | `put`               | `take`             |
| 等一会   | 超时后返回特殊值 | `offer(timeout...)` | `poll(timeout...)` |

这张表比死背实现类更重要，因为线上排查时你要知道线程为什么阻塞、为什么任务被拒绝、为什么 `poll` 返回了 `null`。

## PriorityQueue：按优先级出队

`PriorityQueue` 解决的问题是：下一个取出的元素不是最早入队的，而是优先级最高的。

它底层通常可以理解成数组实现的二叉堆，默认是小顶堆。堆只保证堆顶元素优先级最高，不保证整个数组完全有序。

典型场景：

- 求 Top K。
- Dijkstra 这类按当前最短距离扩展的算法。
- 按任务权重、截止时间选择下一个任务。

示例：维护最大的 3 个分数，可以用小顶堆保存候选集合：

```java
PriorityQueue<Integer> heap = new PriorityQueue<>();
for (Integer score : scores) {
    heap.offer(score);
    if (heap.size() > 3) {
        heap.poll();
    }
}
```

边界要答清楚：

1. 它不是线程安全队列。
2. 它不是阻塞队列。
3. 它不支持 `null`。
4. 元素需要可比较，或者构造时传入 `Comparator`。

## DelayQueue：到期后才允许取出

`DelayQueue` 解决的问题是：任务不是放进去就能取，而是要等延迟时间到了才能被消费。

它的核心结构是：

```text
DelayQueue
├── PriorityQueue：按到期时间排序
├── ReentrantLock：保证并发安全
└── Condition：控制等待和唤醒
```

元素必须实现 `Delayed`：

```java
class CloseOrderTask implements Delayed {
    private final long deadlineMillis;
    private final Long orderId;

    @Override
    public long getDelay(TimeUnit unit) {
        return unit.convert(deadlineMillis - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
    }

    @Override
    public int compareTo(Delayed other) {
        CloseOrderTask task = (CloseOrderTask) other;
        return Long.compare(this.deadlineMillis, task.deadlineMillis);
    }
}
```

`take()` 发现队首任务还没到期时会阻塞；只有 `getDelay() <= 0` 才能取出。

适合场景：

- 本地订单超时关闭。
- 本地缓存过期清理。
- 轻量延迟任务。

但它不是完整调度系统。它不负责持久化、不负责分布式一致性，也不负责执行失败重试。订单超时这类关键链路，如果服务重启不能丢任务，通常要结合数据库扫描、MQ 延迟消息或调度平台。

资料里有些“版本发展史”说法容易讲得过满，面试和项目里抓当前实现即可：`PriorityQueue + ReentrantLock + Condition`。

## ArrayBlockingQueue：有界阻塞和背压

`ArrayBlockingQueue` 解决的问题是：生产者和消费者速度不一致时，用固定容量队列做缓冲，并在满/空时阻塞。

它底层是定长数组 + 循环下标：

```text
items[capacity]
putIndex  -> 下一个写入位置
takeIndex -> 下一个读取位置
count     -> 当前元素数量
```

并发控制靠一把 `ReentrantLock` 和两个条件队列：

```text
notFull  ：队列满时生产者等待
notEmpty ：队列空时消费者等待
```

典型生产者消费者：

```java
BlockingQueue<Runnable> queue = new ArrayBlockingQueue<>(1000);

// 生产者
queue.put(task);

// 消费者
Runnable task = queue.take();
task.run();
```

它特别适合需要背压的地方：生产太快时，不让任务无限堆积，而是让生产者等待或触发超时/拒绝。

和 `LinkedBlockingQueue` 对比时可以这样讲：

| 对比点   | `ArrayBlockingQueue` | `LinkedBlockingQueue`          |
| -------- | -------------------- | ------------------------------ |
| 底层结构 | 定长数组             | 链表                           |
| 容量     | 创建时必须指定       | 不指定时容量接近无界           |
| 锁       | 单锁                 | put/take 锁分离                |
| 风险     | 容量固定，需要估算   | 忘记设容量可能导致任务无限堆积 |

## 容易踩的坑

1. `Queue` 不等于 FIFO，`PriorityQueue` 按优先级出队。
2. `PriorityQueue` 只保证堆顶最优，不保证遍历结果有序。
3. `DelayQueue` 只保证到期后可取出，不负责执行任务。
4. `ArrayBlockingQueue.offer` 满了返回 `false`，`put` 才会阻塞。
5. 阻塞队列不是只有阻塞 API，也有抛异常、特殊值、超时等待三类方法。

## 小结

- `PriorityQueue` 适合按优先级取最小/最大元素，底层是堆，不线程安全。
- `DelayQueue` 适合到期后消费的延迟任务，底层用优先队列管理到期时间。
- `ArrayBlockingQueue` 适合生产者消费者和背压，容量固定，满/空时可阻塞。
- 选择队列时先问出队规则、并发安全、容量边界和失败行为。

## 参考

综合自《Java 集合常见面试题总结》《DelayQueue 源码分析》《ArrayBlockingQueue 源码分析》，并对 `PriorityQueue` 资料正文不足、`DelayQueue` 版本史表述过满的问题做了边界化处理。
