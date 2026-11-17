---
title: "线程池 7 个参数怎么理解？执行流程是怎样的？"
description: "ThreadPoolExecutor 的 7 参数、执行流程、拒绝策略与最佳实践。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "必会"
  - "进阶"
  - "项目实战"
prev:
  {
    text: "BlockingQueue 怎么选？它和线程池是什么关系？",
    link: "/java/concurrent/java-concurrency-blockingqueue.html",
  }
next:
  {
    text: "ThreadLocal 原理是什么？为什么会内存泄漏？",
    link: "/java/concurrent/java-concurrency-threadlocal.html",
  }
---

# 线程池 7 个参数怎么理解？执行流程是怎样的？

> 线程池是面试高频中的高频。面试官通常从"7 个参数"切入，然后追问执行流程、拒绝策略、队列选择和线上配置——一条龙下来，能测出候选人的并发功底。

## 为什么用线程池？

不用线程池，每次任务都 `new Thread()`，有三个问题：

1. **创建/销毁开销大**：线程创建涉及操作系统系统调用。
2. **无限制创建可能 OOM**：高并发下线程数量失控。
3. **缺乏管理**：无法监控、无法限流、无法优雅关闭。

线程池通过**池化复用**解决这些问题：工作线程按需创建并复用，任务队列缓冲，拒绝策略兜底。核心线程默认也不是在构造时全部启动，需要预热时可以调用 `prestartAllCoreThreads()`。

## ThreadPoolExecutor 的 7 个参数

```java
public ThreadPoolExecutor(
    int corePoolSize,           // 1. 核心线程数
    int maximumPoolSize,        // 2. 最大线程数
    long keepAliveTime,         // 3. 空闲线程存活时间
    TimeUnit unit,              // 4. 时间单位
    BlockingQueue<Runnable> workQueue,        // 5. 任务队列
    ThreadFactory threadFactory,              // 6. 线程工厂
    RejectedExecutionHandler handler          // 7. 拒绝策略
)
```

| 参数              | 作用                           | 典型值                             |
| ----------------- | ------------------------------ | ---------------------------------- |
| `corePoolSize`    | 核心线程数，默认不因空闲而回收 | CPU 密集型 ≈ N+1，IO 密集型 ≈ 2N   |
| `maximumPoolSize` | 线程池能创建的最大线程数       | 根据任务类型和资源上限估算         |
| `keepAliveTime`   | 非核心线程空闲超过此时间后回收 | 60s                                |
| `unit`            | keepAliveTime 的时间单位       | `TimeUnit.SECONDS`                 |
| `workQueue`       | 存放等待执行的任务的阻塞队列   | `ArrayBlockingQueue`（有界，推荐） |
| `threadFactory`   | 创建线程的工厂，可自定义线程名 | 自定义工厂便于排查                 |
| `handler`         | 任务太多处理不过来时的拒绝策略 | 见下文                             |

## 执行流程：面试必背

任务提交到线程池后的处理路径：

```mermaid
flowchart TD
    A[提交任务] --> B{当前线程数 < corePoolSize?}
    B -- 是 --> C[创建核心线程执行任务]
    B -- 否 --> D{任务队列未满?}
    D -- 是 --> E[任务入队等待执行]
    D -- 否 --> F{当前线程数 < maximumPoolSize?}
    F -- 是 --> G[创建非核心线程执行任务]
    F -- 否 --> H[执行拒绝策略]
```

用一句话记住：**核心线程 → 队列 → 非核心线程 → 拒绝策略**。

> 这张图描述线程池正常运行时的主要路径；关闭后的提交也会触发拒绝策略。工作线程执行完初始任务后会继续从队列取任务，不会因为当初是按“非核心线程”创建的就只执行一次。线程没有永久的核心/非核心身份，是否超时等待取决于当前线程数和超时配置。

## 任务队列的选择

| 队列类型                | 特点                          | 使用场景                 |
| ----------------------- | ----------------------------- | ------------------------ |
| `ArrayBlockingQueue`    | 有界，数组实现                | **推荐**，防止 OOM       |
| `LinkedBlockingQueue`   | 默认无界（Integer.MAX_VALUE） | 不推荐直接用，需指定容量 |
| `SynchronousQueue`      | 不存储元素，直接传递          | CachedThreadPool 用      |
| `PriorityBlockingQueue` | 支持优先级排序                | 任务有优先级时           |

> 《阿里巴巴 Java 开发手册》强制要求：线程池不允许用 `Executors` 创建，必须用 `ThreadPoolExecutor` 构造函数。原因是 `Executors.newFixedThreadPool` 和 `newSingleThreadExecutor` 用的 `LinkedBlockingQueue` 默认无界，可能堆积大量任务导致 OOM。

## 4 种内置拒绝策略

| 策略                  | 行为                                 | 适用场景                     |
| --------------------- | ------------------------------------ | ---------------------------- |
| `AbortPolicy`（默认） | 抛 `RejectedExecutionException`      | 核心业务，要求必须感知到拒绝 |
| `CallerRunsPolicy`    | 未关闭时在调用者线程执行，关闭后丢弃 | 可接受调用者被阻塞的反压场景 |
| `DiscardPolicy`       | 静默丢弃                             | 非关键路径（日志、监控）     |
| `DiscardOldestPolicy` | 丢弃队列最老的任务                   | 只关心最新数据（行情推送）   |

生产环境常见的做法是**自定义拒绝策略**：记录监控指标、写入数据库后续补偿、或放入消息队列异步重试。`CallerRunsPolicy` 的价值在于形成天然反压：调用者线程被迫执行任务，在此期间无法继续提交新任务。

拒绝策略不会自动保证任务最终成功。`AbortPolicy` 要由调用方处理异常并决定补偿；`CallerRunsPolicy` 在关闭后仍会丢弃任务。若通过 `submit` 提交任务，静默丢弃还可能留下一个一直未完成的 `Future`，不能把“不抛异常”当成“任务已执行”。

## 线程池的状态

ThreadPoolExecutor 用一个 `AtomicInteger` 类型的 `ctl` 变量同时存储运行状态和工作线程数：

| 状态         | 说明                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| `RUNNING`    | 接受新任务，处理队列任务（初始状态）                                       |
| `SHUTDOWN`   | 不接受新任务，处理队列中已有任务（`shutdown()` 后）                        |
| `STOP`       | 不接受新任务，不处理队列任务，尝试中断正在执行的任务（`shutdownNow()` 后） |
| `TIDYING`    | 所有任务终止，工作线程数为 0                                               |
| `TERMINATED` | `terminated()` 钩子方法执行完毕                                            |

正常关闭走 `RUNNING → SHUTDOWN → TIDYING → TERMINATED`；调用 `shutdownNow()` 可从 `RUNNING` 或 `SHUTDOWN` 进入 `STOP`，再进入 `TIDYING → TERMINATED`。状态不会倒退。

## Executors 工具类为什么不推荐

| 方法                      | 风险                                          |
| ------------------------- | --------------------------------------------- |
| `newFixedThreadPool`      | `LinkedBlockingQueue` 无界 → 任务堆积 OOM     |
| `newSingleThreadExecutor` | 同上                                          |
| `newCachedThreadPool`     | 最大线程数 `Integer.MAX_VALUE` → 线程过多 OOM |
| `newScheduledThreadPool`  | `DelayedWorkQueue` 无界 → 任务堆积 OOM        |

正确做法是直接用 `ThreadPoolExecutor` 构造函数，明确指定每个参数。

## 核心线程数怎么估算

| 任务类型   | 经验公式  | 说明                                                                    |
| ---------- | --------- | ----------------------------------------------------------------------- |
| CPU 密集型 | N + 1     | N = CPU 核心数。多 1 个线程是为了在某个线程偶尔阻塞时其他线程能用满 CPU |
| IO 密集型  | 2N 或更多 | IO 等待期间 CPU 空闲，可以切换到其他线程                                |

> 公式只是起点。实际配置要看任务耗时比例、下游依赖、内存限制，结合压测调整。也可以用 Little's Law 估算：线程数 = 目标 QPS × 平均响应时间。

## Worker 是什么：线程池怎么管理线程

ThreadPoolExecutor 内部用 `Worker` 类封装工作线程。Worker 继承 AQS（实现独占锁），同时实现 Runnable：

```java
private final class Worker extends AbstractQueuedSynchronizer implements Runnable {
    final Thread thread;       // Worker 对应的线程
    Runnable firstTask;        // 创建时传入的第一个任务（可能为 null）
    volatile long completedTasks; // 已完成任务数

    Worker(Runnable firstTask) {
        setState(-1); // 抑制中断直到 runWorker 开始
        this.firstTask = firstTask;
        this.thread = getThreadFactory().newThread(this);
    }

    public void run() {
        runWorker(this);
    }
}
```

Worker 的核心是 `runWorker` 方法——线程池的线程不会执行完一个任务就退出，而是循环从队列取任务。下面是保留异常传播路径的源码节选，省略了停机时的中断状态检查：

```java
final void runWorker(Worker w) {
    Thread wt = Thread.currentThread();
    Runnable task = w.firstTask;
    w.firstTask = null;
    w.unlock(); // 允许中断
    boolean completedAbruptly = true;
    try {
        while (task != null || (task = getTask()) != null) {
            w.lock(); // Worker 加锁，标记线程正在执行任务
            // 检查线程池状态和中断状态...
            try {
                beforeExecute(wt, task); // 钩子方法
                try {
                    task.run();
                    afterExecute(task, null);
                } catch (Throwable ex) {
                    afterExecute(task, ex);
                    throw ex; // 异常继续传播，不能在这里吞掉
                }
            } finally {
                task = null;
                w.completedTasks++;
                w.unlock();
            }
        }
        completedAbruptly = false;
    } finally {
        processWorkerExit(w, completedAbruptly); // 区分正常退出和异常退出
    }
}
```

`getTask()` 根据 `allowCoreThreadTimeOut || 当前工作线程数 > corePoolSize` 判断是否采用超时等待：为真时用 `workQueue.poll(keepAliveTime, unit)`，否则用 `workQueue.take()`。允许核心线程超时后，线程池空闲时也可以收缩到零；`keepAliveTime` 此时必须大于零。

`poll()` 超时后还要重新检查线程池状态、线程数和队列，满足退出条件时 `getTask()` 才返回 `null`。因此不能简单理解为“某个固定的非核心线程超时就一定退出”。

> 这也解释了一个常见疑问：为什么非核心线程执行完初始任务后不会立刻销毁？因为 `runWorker` 的 while 循环会继续调 `getTask()` 从队列拉任务。只要队列非空，非核心线程就会继续工作。

## execute() vs submit()

`execute()` 和 `submit()` 都用来提交任务，区别在于返回值和异常处理：

| 对比项   | `execute(Runnable)`                                       | `submit(Callable/Runnable)`                               |
| -------- | --------------------------------------------------------- | --------------------------------------------------------- |
| 返回值   | `void`                                                    | `Future<T>`                                               |
| 异常处理 | 普通任务的未捕获异常传给 `afterExecute`，工作线程异常退出 | 异常保存在 Future 中，`get()` 时抛出 `ExecutionException` |
| 参数类型 | `Runnable`                                                | `Runnable` 或 `Callable`                                  |

```java
// execute：普通 Runnable 的异常沿工作线程传播，不会抛回提交线程
pool.execute(() -> {
    throw new RuntimeException("boom"); // 工作线程退出，线程池按状态和需要补充线程
});

// submit：异常被 FutureTask 捕获并保存
Future<?> future = pool.submit(() -> {
    throw new RuntimeException("boom"); // 不会传到工作线程的未捕获异常处理器
});
future.get(); // 这里才抛 ExecutionException
```

> 生产中常见的坑：用 `submit` 提交任务后忽略 `Future`，任务失败却没有任何处理。应读取并处理 `Future` 的结果，或像下文那样在 `afterExecute` 中检查已完成的 `Future`。`UncaughtExceptionHandler` 只能处理逃出线程的异常，**无法兜底已被 `FutureTask` 捕获的异常**；此时 `afterExecute` 的 `Throwable` 参数通常也是 `null`。如果把 `FutureTask` 手动交给 `execute`，异常同样保存在 Future 中，关键在任务是否被包装。

## 项目实战要点

**业务隔离。** 不同业务用不同线程池，避免慢任务拖垮核心链路。比如订单创建用独立线程池，日志异步上报用另一个。

**监控必不可少。** 关注：活跃线程数、队列长度、拒绝次数、任务执行耗时。核心指标建议接入 Prometheus + Grafana。

**队列必须有界。** 无界队列会把 OOM 从线程数维度转移到内存维度，问题更难排查。

**优雅关闭。** `shutdown()` 停止接收任务，但继续处理已提交的任务；`shutdownNow()` 尝试中断正在运行的任务，并返回队列中尚未开始的任务。中断是协作机制，任务忽略中断时可能继续运行。两个方法都不会等待所有线程退出，需要配合带超时的 `awaitTermination()`。Spring 应用可以注册 `@PreDestroy` 钩子。

## 线程池监控指标

生产环境必须监控线程池的核心指标，否则线程池打满时只能干看着：

| 指标         | 获取方式                             | 含义                   |
| ------------ | ------------------------------------ | ---------------------- |
| 活跃线程数   | `getActiveCount()`                   | 正在执行任务的线程数   |
| 当前线程数   | `getPoolSize()`                      | 线程池当前线程总数     |
| 队列堆积数   | `getQueue().size()`                  | 等待执行的任务数       |
| 已完成任务数 | `getCompletedTaskCount()`            | 历史完成任务总数       |
| 拒绝次数     | 自定义 RejectedExecutionHandler 统计 | 被拒绝策略拒绝的任务数 |

执行前后可以扩展 `beforeExecute`/`afterExecute`，但 **`rejectedExecution` 属于 `RejectedExecutionHandler` 接口，不是 `ThreadPoolExecutor` 的可重写方法**。统计拒绝次数时应包装拒绝策略，记录后继续调用原策略，不能让监控改变原本的拒绝行为。

下面的完整类只依赖 JDK，可保存为 `MonitorableThreadPool.java` 编译。它把工作线程观察到的任务失败、取消和拒绝策略触发次数分开统计：

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

public class MonitorableThreadPool extends ThreadPoolExecutor {
    private final AtomicLong rejectedCount = new AtomicLong();
    private final AtomicLong failedCount = new AtomicLong();
    private final AtomicLong cancelledCount = new AtomicLong();

    public MonitorableThreadPool(int coreSize, int maxSize, int queueCapacity,
                                 RejectedExecutionHandler rejectionPolicy) {
        super(coreSize, maxSize, 60, TimeUnit.SECONDS,
              new ArrayBlockingQueue<>(queueCapacity),
              Executors.defaultThreadFactory(), rejectionPolicy);
        setRejectedExecutionHandler((task, executor) -> {
            rejectedCount.incrementAndGet();
            rejectionPolicy.rejectedExecution(task, executor);
        });
    }

    @Override
    protected void afterExecute(Runnable r, Throwable t) {
        super.afterExecute(r, t);
        Throwable failure = t;
        if (failure == null && r instanceof Future<?>) {
            Future<?> future = (Future<?>) r;
            if (future.isDone()) { // 不在工作线程里等待未完成的任务
                try {
                    future.get();
                } catch (CancellationException e) {
                    cancelledCount.incrementAndGet();
                } catch (ExecutionException e) {
                    failure = e.getCause();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); // 保留中断信号
                }
            }
        }
        if (failure != null) {
            failedCount.incrementAndGet();
        }
    }

    public long getRejectedCount() { return rejectedCount.get(); }
    public long getFailedCount() { return failedCount.get(); }
    public long getCancelledCount() { return cancelledCount.get(); }
}
```

例如用 `new MonitorableThreadPool(2, 4, 100, new ThreadPoolExecutor.AbortPolicy())` 创建池，饱和时会先增加拒绝计数，再向提交方抛出 `RejectedExecutionException`。监控系统可定期读取这些计数，以及活跃线程数、队列大小等指标。

这个示例有明确边界：

- 计数便于告警，业务代码仍要处理 `Future` 结果和失败原因；钩子里不要执行阻塞上报或抛出新的异常。
- `CallerRunsPolicy` 在提交线程执行任务，不经过工作线程的 `beforeExecute`/`afterExecute`，这部分失败要在提交侧观察。拒绝计数表示策略被触发，不等于任务丢失数。
- 取消计数只统计进入 `afterExecute` 时发现已取消的 Future；提前从队列移除的取消任务不会经过这个钩子。运行时若替换拒绝策略，也要重新包装计数逻辑。

## Spring 中的线程池配置

Spring Boot 中推荐用 `@Bean` 定义线程池，而不是用 `Executors`：

```java
@Configuration
public class ThreadPoolConfig {

    @Bean("orderExecutor")
    public ThreadPoolExecutor orderExecutor() {
        return new ThreadPoolExecutor(
            8,                              // corePoolSize
            16,                             // maximumPoolSize
            60, TimeUnit.SECONDS,           // keepAliveTime
            new ArrayBlockingQueue<>(200),  // 有界队列
            new ThreadFactoryBuilder()
                .setNameFormat("order-pool-%d")
                .setUncaughtExceptionHandler((t, e) ->
                    log.error("thread {} error", t.getName(), e))
                .build(),
            new ThreadPoolExecutor.CallerRunsPolicy() // 拒绝策略
        );
    }
}

// 使用
@Autowired
@Qualifier("orderExecutor")
private ThreadPoolExecutor orderExecutor;
```

这里的 `ThreadFactoryBuilder` 来自 Guava，`log` 为项目中的日志器。线程命名很重要——线上排查时 `jstack` 看到的线程名能直接定位是哪个线程池出了问题。未捕获异常处理器只覆盖逃出工作线程的异常，`submit` 的失败仍需按前文处理 `Future`。

## 小结

- 7 个参数记住核心三件套：`corePoolSize`（核心数量）、`maximumPoolSize`（上限）、`workQueue`（缓冲），允许核心线程超时时空闲池可以收缩到零。
- 执行流程四步走：核心线程 → 队列 → 非核心线程 → 拒绝策略。
- 拒绝策略根据业务选：需要显式感知拒绝可用 AbortPolicy 并处理异常；允许反压可用 CallerRunsPolicy，但关闭后它会丢弃任务。
- 不用 `Executors`，用 `ThreadPoolExecutor` 构造函数，队列必须有界。
- 核心线程数按任务类型初估再压测；`submit` 失败保存在 Future 中，不能只依靠未捕获异常处理器。

## 参考

- [Java SE 17：ThreadPoolExecutor](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)：构造参数、执行钩子、核心线程超时与关闭语义。
- [Java SE 17：RejectedExecutionHandler](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/RejectedExecutionHandler.html)：拒绝回调及委托边界。
- [Java SE 17：FutureTask](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/FutureTask.html)：任务异常保存、取消与结果读取。

综合仓库线程池参考资料，并对照本机 JDK 17 源码的 `runWorker`、`getTask`、`afterExecute` 和拒绝策略实现复核。监控示例用 JDK 17 编译运行，验证普通任务失败、`submit` 失败、取消和饱和拒绝计数；修正了把拒绝回调当成父类方法、用未捕获异常处理器兜底 Future 异常等说法。
