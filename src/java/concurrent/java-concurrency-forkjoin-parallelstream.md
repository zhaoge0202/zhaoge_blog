---
title: "ForkJoinPool 和 parallelStream 适合什么场景？有哪些坑？"
description: "从任务拆分、工作窃取和公共线程池讲清 parallelStream 的边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "进阶"
  - "细节题"
  - "项目实战"
prev:
  {
    text: "CompletableFuture 怎么做异步任务编排？",
    link: "/java/concurrent/java-concurrency-completablefuture.html",
  }
next:
  {
    text: "虚拟线程解决了什么问题？和平台线程什么关系？",
    link: "/java/concurrent/java-concurrency-virtual-thread.html",
  }
---

# ForkJoinPool 和 parallelStream 适合什么场景？有哪些坑？

> ForkJoinPool 适合可拆分、可合并的计算任务；parallelStream 是 Stream 基于 ForkJoin 体系提供的并行执行方式。它们不是“把代码一并行就更快”的按钮，真正的边界在任务类型、拆分成本、共享状态和公共线程池竞争。

## Fork/Join 到底在解决什么问题？

Fork/Join 的思路是“分而治之”：

1. 一个大任务拆成多个子任务。
2. 子任务继续拆，直到小到值得直接计算。
3. 子任务并行执行。
4. 最后把结果合并回来。

比如对一个很大的 `long[]` 求和：

```java
class SumTask extends RecursiveTask<Long> {
    private static final int THRESHOLD = 10_000;
    private final long[] data;
    private final int left;
    private final int right;

    SumTask(long[] data, int left, int right) {
        this.data = data;
        this.left = left;
        this.right = right;
    }

    @Override
    protected Long compute() {
        if (right - left <= THRESHOLD) {
            long sum = 0;
            for (int i = left; i < right; i++) {
                sum += data[i];
            }
            return sum;
        }

        int mid = (left + right) >>> 1;
        SumTask leftTask = new SumTask(data, left, mid);
        SumTask rightTask = new SumTask(data, mid, right);
        leftTask.fork();
        long rightResult = rightTask.compute();
        long leftResult = leftTask.join();
        return leftResult + rightResult;
    }
}

long result = ForkJoinPool.commonPool()
    .invoke(new SumTask(data, 0, data.length));
```

`RecursiveTask<V>` 用来处理有返回值的任务，`RecursiveAction` 用来处理无返回值的任务。`fork()` 表示把子任务放入队列等待执行，`join()` 表示等待子任务结果。

这类模型特别适合 CPU 密集型计算，比如大数组聚合、图像处理、规则匹配、批量数值计算。它不适合“每个子任务都去等数据库/RPC”的 I/O 阻塞场景。

## 工作窃取为什么适合拆分任务？

普通线程池通常围绕一个共享队列工作；ForkJoinPool 里每个 worker 都有自己的双端队列。大致可以这样理解：

```text
worker-1 deque: [task-a1, task-a2, task-a3]
worker-2 deque: [task-b1]
worker-3 deque: []

worker-3 空闲时，会去其他 worker 的队列里偷任务执行。
```

这就是工作窃取（work-stealing）。它的好处是：

- 每个 worker 优先处理自己拆出来的任务，减少共享队列竞争。
- 某个 worker 忙不过来时，空闲 worker 可以偷走任务，避免线程空转。
- 很多小任务动态生成时，负载能自动变得更均衡。

但工作窃取解决的是“CPU 工作分布不均”的问题，不会神奇地把阻塞 I/O 变快。官方 API 也明确提醒：ForkJoinPool 会尝试维持足够的活跃线程，但遇到阻塞 I/O 或不可管理的同步阻塞时，不保证能自动补偿。

## parallelStream 和 ForkJoinPool 是什么关系？

`parallelStream()` 把 Stream 流水线切换成并行模式。底层会依赖数据源的 `Spliterator` 把数据拆分成多个片段，再并行处理，最后合并结果。

```java
int total = orders.parallelStream()
    .filter(Order::paid)
    .mapToInt(Order::amount)
    .sum();
```

它看起来只是把 `stream()` 改成 `parallelStream()`，但背后有几个隐藏条件：

| 隐藏条件     | 说明                                                       |
| ------------ | ---------------------------------------------------------- |
| 数据要能拆   | 数组、`ArrayList` 这类有明确大小的数据源更容易均匀拆分     |
| 操作要无状态 | `filter`、`map` 函数不要依赖可变共享状态                   |
| 合并要便宜   | `sum`、`max`、`reduce` 这类合并成本低的操作更容易受益      |
| 顺序不敏感   | 如果强依赖 encounter order，很多并行收益会被排序和缓冲抵消 |

并行 Stream 默认使用 `ForkJoinPool.commonPool()`。这个公共池是进程级共享资源，`CompletableFuture.supplyAsync()`、`runAsync()` 在不传 executor 时也会使用它。

## 什么场景适合 parallelStream？

可以用四个条件判断：

| 条件             | 说明                                           |
| ---------------- | ---------------------------------------------- |
| CPU 密集         | 每个元素主要做计算，而不是等待 I/O             |
| 数据量足够大     | 拆分、调度、合并成本能被计算收益摊薄           |
| 元素之间互不依赖 | 不修改共享集合，不依赖外部可变状态             |
| 结果合并简单     | 加和、最大值、最小值、无副作用归约更适合并行化 |

比如下面这种纯计算聚合比较适合：

```java
long score = users.parallelStream()
    .mapToLong(user -> calculateScore(user.profile(), user.orders()))
    .sum();
```

如果计算函数本身很轻，比如只是取字段、拼字符串、过滤几个元素，串行循环或普通 `stream()` 往往更快，因为并行拆分和线程调度也有成本。

## 什么场景不适合？

业务服务里更多见的是不适合的场景。

### 不适合阻塞 I/O

```java
// 不推荐：远程调用占住 commonPool 线程
List<User> users = userIds.parallelStream()
    .map(userClient::queryUser)
    .toList();
```

RPC、数据库、文件 I/O 的瓶颈通常不在 CPU。把它们塞进 `parallelStream`，会占住公共池线程，影响同进程里其他 `parallelStream` 和默认 `CompletableFuture` 任务。

这类并发调用更适合显式线程池、超时、限流和异常处理：

```java
List<CompletableFuture<User>> futures = userIds.stream()
    .map(id -> CompletableFuture.supplyAsync(() -> userClient.queryUser(id), rpcExecutor))
    .toList();

List<User> users = futures.stream()
    .map(CompletableFuture::join)
    .toList();
```

### 不适合共享可变状态

```java
// 不推荐：ArrayList 不是线程安全的
List<Long> failedIds = new ArrayList<>();
orders.parallelStream()
    .filter(order -> !pay(order))
    .forEach(order -> failedIds.add(order.id()));
```

并行 Stream 要求行为参数尽量无状态、无副作用。加锁可以让代码“看起来安全”，但锁竞争又会抵消并行收益。更好的写法是让 Stream 自己做收集：

```java
List<Long> failedIds = orders.parallelStream()
    .filter(order -> !pay(order))
    .map(Order::id)
    .toList();
```

如果 `pay(order)` 是远程支付调用，那仍然不适合 `parallelStream`，应该回到显式线程池和限流模型。

### 不适合依赖 ThreadLocal 上下文

Web 服务里常见的 MDC、TraceId、登录用户、事务上下文都可能放在 `ThreadLocal` 中。`parallelStream` 会切到公共池 worker 上执行，这些上下文通常不会自动传播。

所以不要在事务方法里用 `parallelStream` 批量写库，也不要指望日志 MDC、租户上下文、权限上下文天然可用。上下文传播要显式设计，不能靠公共池碰运气。

## commonPool 不是业务隔离线程池

`ForkJoinPool.commonPool()` 的优点是复用公共资源，缺点也是公共资源。

同一个 JVM 里，下面这些代码都可能抢同一个池：

- `list.parallelStream()...`
- `CompletableFuture.supplyAsync(...)` 不传 executor
- 第三方库内部使用默认异步执行器

一旦某条链路提交了大量慢任务，其他链路也会被拖慢。生产环境里更稳的做法是：

1. `CompletableFuture` 明确传入业务线程池。
2. I/O 并发调用用普通 `ThreadPoolExecutor`、虚拟线程或异步客户端。
3. 需要 Fork/Join 的 CPU 计算任务，用独立 `ForkJoinPool` 承载显式 `ForkJoinTask`。

网上常见一种写法：把 `parallelStream` 包进自定义 `ForkJoinPool.submit()`。它在一些 JDK 实现里能影响执行池，但这不是一套适合业务隔离的清晰 API。真要隔离资源，优先显式建模任务和执行器。

## 和 CompletableFuture、虚拟线程怎么区分？

| 工具                | 更适合解决的问题                 | 典型边界                              |
| ------------------- | -------------------------------- | ------------------------------------- |
| `ForkJoinPool`      | 可拆分、可合并的 CPU 计算任务    | 不适合大量不可管理的阻塞 I/O          |
| `parallelStream`    | 对集合做无副作用的并行聚合       | 默认 commonPool，不适合复杂业务流程   |
| `CompletableFuture` | 多个异步任务的依赖编排和结果聚合 | 要传自定义 executor，处理异常和超时   |
| 虚拟线程            | 大量同步阻塞 I/O 任务            | 不是 CPU 并行加速器，不要池化虚拟线程 |

虚拟线程底层调度器也是一种 work-stealing `ForkJoinPool`，但它和并行流使用的 common pool 不是同一个池。不要看到 ForkJoinPool 就把几件事混成一个概念：虚拟线程解决阻塞成本，parallelStream 解决集合并行聚合，CompletableFuture 解决任务编排。

## 容易踩的坑

| 坑                                      | 后果                               | 更稳妥的做法                          |
| --------------------------------------- | ---------------------------------- | ------------------------------------- |
| 认为 `parallelStream` 一定更快          | 小数据、轻操作反而更慢             | 压测对比串行、并行和普通循环          |
| 在 `parallelStream` 里调 RPC / 查数据库 | 占满 commonPool，拖慢其他异步任务  | 显式线程池、超时、限流、熔断          |
| 修改共享集合或共享变量                  | 数据错乱、并发异常、结果不确定     | 用无副作用转换和 `collect` / `toList` |
| 依赖 MDC / TraceId / 事务 ThreadLocal   | 日志断链、上下文丢失、事务边界混乱 | 显式传上下文或不用 parallelStream     |
| 对有序流做复杂 stateful 操作            | 大量缓冲和合并，吞吐不升反降       | 取消不必要顺序约束，或保持串行        |
| 把 parallelStream 当业务线程池用        | 无隔离、无队列指标、难监控、难限流 | 自定义 executor 或显式 ForkJoinTask   |

## 小结

- Fork/Join 适合可递归拆分、最后能合并结果的 CPU 密集型任务，核心机制是工作窃取。
- `parallelStream` 默认使用公共 ForkJoinPool，适合无副作用、数据量足够大、合并成本低的集合计算。
- `parallelStream` 不适合 RPC、数据库、文件 I/O，也不适合依赖 ThreadLocal 上下文的复杂业务流程。
- `CompletableFuture` 和 `parallelStream` 都可能用 commonPool；生产里异步任务要优先传自定义 executor。
- 虚拟线程、CompletableFuture、ForkJoinPool 解决的问题不同：分别面向低成本阻塞、异步编排、CPU 并行计算。

## 参考

综合自本地资料《Java8 新特性实战》《CompletableFuture 详解》、本项目《Java 8 Stream 和 Optional 怎么用才不滥用？》《CompletableFuture 怎么做异步任务编排？》《虚拟线程解决了什么问题？和平台线程什么关系？》，并对照 Java SE 21 API 中 [`ForkJoinPool`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ForkJoinPool.html) 和 [`java.util.stream`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/package-summary.html) 的并行流、无状态行为、非干扰要求做了校验。资料里“parallelStream 改一行就能提速”的例子只适合特定计算任务，本文补充了公共线程池、阻塞 I/O、ThreadLocal 上下文和工程隔离边界。
