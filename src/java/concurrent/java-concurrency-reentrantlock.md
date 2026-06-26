---
title: "ReentrantLock 和 AQS 是怎么配合的？"
description: "从公平锁到 CLH 队列，讲透 ReentrantLock 的加锁解锁流程与 AQS 框架。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "进阶"
  - "原理深入"
  - "高频"
prev:
  {
    text: "CAS 是怎么实现原子操作的？有哪些问题？",
    link: "/java/concurrent/java-concurrency-cas.html",
  }
next:
  {
    text: "线程池 7 个参数怎么理解？执行流程是怎样的？",
    link: "/java/concurrent/java-concurrency-thread-pool.html",
  }
---

# ReentrantLock 和 AQS 是怎么配合的？

> ReentrantLock 提供了 synchronized 没有的能力：公平锁、可中断、超时获取、多 Condition。这些能力都建立在 AQS 框架之上。

## AQS 是什么？

AQS（AbstractQueuedSynchronizer）是 JUC 的同步器框架，用三个核心组件实现锁的获取与释放：

| 组件      | 说明                                                          |
| --------- | ------------------------------------------------------------- |
| `state`   | volatile int，表示同步状态。0=空闲，>0=已持有（可重入时递增） |
| FIFO 队列 | CLH 变体的双向链表，管理等待获取锁的线程                      |
| CAS       | 原子更新 state 和队列指针                                     |

很多并发工具都建立在 AQS 之上：

| 工具                      | state 的含义                             |
| ------------------------- | ---------------------------------------- |
| ReentrantLock             | 锁被重入的次数                           |
| Semaphore                 | 剩余许可数                               |
| CountDownLatch            | 剩余计数                                 |
| ReentrantReadWriteLock    | 高 16 位=读锁持有数，低 16 位=写锁重入数 |
| ThreadPoolExecutor.Worker | Worker 是否已启动（独占锁）              |

## ReentrantLock 的加锁流程

ReentrantLock 分公平锁和非公平锁，通过构造函数选择：

```java
ReentrantLock lock = new ReentrantLock(true); // 公平锁
ReentrantLock lock = new ReentrantLock();      // 非公平锁（默认）
```

### 非公平锁加锁

```java
final void lock() {
    if (compareAndSetState(0, 1))          // CAS 抢锁
        setExclusiveOwnerThread(current);  // 抢到了，记录持有线程
    else
        acquire(1);                        // 没抢到，走 AQS 流程
}
```

非公平锁的特点：上来先 CAS 抢一次，不管队列里有没有人在等。抢不到才进入队列。

### 公平锁加锁

```java
final void lock() {
    acquire(1); // 直接走 AQS 流程，不先抢
}
```

公平锁不会"插队"，先检查队列里有没有排在自己前面的线程。

### acquire 流程（AQS 核心）

```java
public final void acquire(int arg) {
    if (!tryAcquire(arg)                         // 尝试获取锁
        && acquireQueued(addWaiter(Node.EXCLUSIVE), arg)) // 入队+自旋/阻塞
        selfInterrupt();                          // 补中断标记
}
```

分三步：

1. **tryAcquire**：尝试获取锁。公平锁会先调 `hasQueuedPredecessors()` 检查队列里是否有排在前面的线程；非公平锁直接 CAS。
2. **addWaiter**：获取失败，把当前线程包装成 Node 加入 FIFO 队列尾部。
3. **acquireQueued**：在队列中自旋等待。如果前驱是头节点就再试一次 tryAcquire；否则调用 `LockSupport.park()` 把自己挂起。

```
线程获取锁失败后的完整路径：
tryAcquire 失败 → addWaiter（入队）→ acquireQueued（自旋/park）
→ 被前驱节点 unpark 唤醒 → 再次 tryAcquire → 成功则出队
```

### 可重入的实现

`tryAcquire` 中检查当前线程是否是锁的持有者：

```java
if (current == getExclusiveOwnerThread()) {
    int nextc = c + acquires; // state + 1
    setState(nextc);
    return true;
}
```

每次重入 state 加 1，解锁时减 1，减到 0 才真正释放。

## ReentrantLock 的解锁流程

解锁不区分公平/非公平：

```java
public void unlock() {
    sync.release(1);
}

public final boolean release(int arg) {
    if (tryRelease(arg)) {          // state 减 1，减到 0 返回 true
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);      // 唤醒后继节点
        return true;
    }
    return false;
}
```

`unparkSuccessor` 的一个细节：如果后继节点为 null 或已取消，会**从队尾往前遍历**找到第一个有效节点。原因是入队操作不是原子的（`node.prev = pred` → `CAS(tail, node)` → `pred.next = node`），从前往后遍历可能漏掉刚入队但 `next` 指针还没设置好的节点。

## 公平锁 vs 非公平锁

| 对比项   | 公平锁                    | 非公平锁              |
| -------- | ------------------------- | --------------------- |
| 获取顺序 | 严格按 FIFO 队列顺序      | 允许新来线程插队      |
| 吞吐量   | 较低（线程切换多）        | 较高（默认选择）      |
| 饥饿     | 不会                      | 可能                  |
| 典型实现 | `new ReentrantLock(true)` | `new ReentrantLock()` |

非公平锁吞吐量更高的原因：新线程直接 CAS 抢锁，如果恰好锁刚释放，就不需要入队和 park/unpark 的开销。

## Condition：多条件队列

synchronized 只有一个等待队列（`wait/notify`），ReentrantLock 可以创建多个 `Condition`，把不同等待条件拆开管理：

```java
class BoundedBuffer<E> {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();
    private final Queue<E> queue = new ArrayDeque<>();
    private final int capacity;

    public void put(E item) throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (queue.size() == capacity) {
                notFull.await(); // 队列满了，等待 notFull
            }
            queue.add(item);
            notEmpty.signal();  // 通知消费者
        } finally {
            lock.unlock();
        }
    }

    public E take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (queue.isEmpty()) {
                notEmpty.await(); // 队列空了，等待 notEmpty
            }
            E item = queue.remove();
            notFull.signal();    // 通知生产者
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

> `while` 不能改成 `if`。线程被唤醒后只代表"有机会竞争锁"，不代表条件一定成立——可能被虚假唤醒，或条件被其他线程先消费掉了。

## 容易踩的坑

**忘记 unlock。** ReentrantLock 不会自动释放，必须用 `try/finally`：

```java
lock.lock();
try {
    // 临界区
} finally {
    lock.unlock(); // 必须在 finally 中
}
```

**lock() 之后才进 try。** 如果在 `lock()` 之前就进入了 `try` 块，`lock()` 抛异常时 `finally` 中的 `unlock()` 会因为没有持有锁而抛 `IllegalMonitorStateException`。正确写法是 `lock()` 紧跟在 `try` 之前。

**用 `if` 代替 `while` 做条件等待。** 被唤醒后条件可能已不成立，必须用 `while` 重新检查。

## 小结

- AQS 用 `state` + FIFO 队列 + CAS 构建同步器框架，ReentrantLock、Semaphore、CountDownLatch 都建立在它之上。
- ReentrantLock 加锁流程：tryAcquire → 失败入队 → 自旋/park → 被唤醒 → 再次 tryAcquire。
- 可重入通过 state 递增实现，解锁时递减到 0 才释放。
- 非公平锁吞吐更高（允许插队），公平锁无饥饿（严格 FIFO）。
- Condition 支持多条件队列，await/signal 必须配合 `while` 使用。

## 参考

综合自美团技术团队《从 ReentrantLock 的实现看 AQS 的原理及应用》及多篇 Java 锁详解资料。原文对 AQS 源码逐行分析非常详细，本文聚焦在流程脉络和面试回答框架上，省略了 CANCELLED 节点清理等源码细节，建议面试前对照原文过一遍核心方法。
