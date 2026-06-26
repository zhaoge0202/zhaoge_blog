---
title: "CompletableFuture 怎么做异步任务编排？"
description: "从 Future 的局限到 CompletableFuture 的链式编排、异常处理与最佳实践。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "进阶"
  - "项目实战"
  - "高频"
prev:
  {
    text: "ConcurrentHashMap 是怎么保证线程安全的？",
    link: "/java/concurrent/java-concurrency-concurrent-collections.html",
  }
next:
  {
    text: "虚拟线程解决了什么问题？和平台线程什么关系？",
    link: "/java/concurrent/java-concurrency-virtual-thread.html",
  }
---

# CompletableFuture 怎么做异步任务编排？

> 一个接口需要同时获取用户信息、商品详情、物流信息再汇总返回——串行调用太慢，CompletableFuture 是 Java 8 提供的异步任务编排工具，专门解决这类问题。

## Future 的局限

`Future` 是 Java 5 引入的异步计算接口，可以提交任务给子线程执行，之后通过 `get()` 获取结果。但它有三个硬伤：

1. **get() 阻塞**：获取结果时必须阻塞等待。
2. **不支持编排**：不能在任务 A 完成后自动触发任务 B。
3. **不支持异常回调**：任务失败时只能通过 `get()` 抛出的异常感知。

CompletableFuture 解决了这些问题——它实现了 `Future` 和 `CompletionStage` 两个接口，支持链式调用、异步回调、异常处理和多任务组合。

## 创建 CompletableFuture

```java
// 有返回值
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> "hello");

// 无返回值
CompletableFuture<Void> future2 = CompletableFuture.runAsync(() -> System.out.println("running"));

// 已知结果
CompletableFuture<String> future3 = CompletableFuture.completedFuture("done");
```

`supplyAsync` 和 `runAsync` 默认使用 `ForkJoinPool.commonPool()`。**生产环境务必传入自定义线程池**：

```java
CompletableFuture.supplyAsync(() -> queryUser(userId), customExecutor);
```

> 全局共享 `ForkJoinPool.commonPool()` 会被所有未指定执行器的 CompletableFuture 使用。大量任务同时提交时可能导致资源竞争和线程饥饿。

## 链式回调

| 方法           | 接收上一步结果  | 有返回值 | 用途                   |
| -------------- | --------------- | -------- | ---------------------- |
| `thenApply`    | 是              | 是       | 转换结果               |
| `thenAccept`   | 是              | 否       | 消费结果               |
| `thenRun`      | 否              | 否       | 上一步完成后执行动作   |
| `whenComplete` | 是（结果+异常） | 否       | 收尾回调（不改变结果） |
| `handle`       | 是（结果+异常） | 是       | 异常恢复               |

```java
CompletableFuture.supplyAsync(() -> "hello")          // "hello"
    .thenApply(s -> s + " world")                      // "hello world"
    .thenApply(String::toUpperCase)                    // "HELLO WORLD"
    .thenAccept(System.out::println);                  // 打印，无返回值
```

每个方法都有 `Async` 变体（`thenApplyAsync`），表示回调在另一个线程执行；不带 `Async` 的版本可能在当前线程或上一步的线程执行。

## 异常处理

```java
CompletableFuture.supplyAsync(() -> {
    if (error) throw new RuntimeException("fail");
    return "ok";
})
.exceptionally(ex -> {        // 异常时返回默认值
    log.error("task failed", ex);
    return "fallback";
})
.handle((result, ex) -> {     // 正常和异常都处理
    return ex != null ? "fallback" : result;
});
```

| 方法            | 触发时机         | 能否改变结果           |
| --------------- | ---------------- | ---------------------- |
| `exceptionally` | 仅异常时         | 是（返回默认值）       |
| `handle`        | 正常和异常都触发 | 是                     |
| `whenComplete`  | 正常和异常都触发 | 否（只观察，不改结果） |

> 生产实践中，如果异常没有被 `exceptionally` 或 `handle` 捕获，异常会被"吞掉"——`get()` 时才以 `ExecutionException` 抛出，但如果不调 `get()`，异常就丢失了。

## 多任务组合

### thenCompose：串行依赖

前一个任务的结果作为后一个任务的输入：

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> getUserId())                    // 获取用户ID
    .thenCompose(id -> CompletableFuture.supplyAsync(  // 用ID获取用户信息
        () -> getUserInfo(id)));
```

### thenCombine：并行合并

两个任务并行执行，都完成后合并结果：

```java
CompletableFuture<String> userFuture = CompletableFuture.supplyAsync(() -> getUser());
CompletableFuture<String> orderFuture = CompletableFuture.supplyAsync(() -> getOrder());

CompletableFuture<String> combined = userFuture.thenCombine(orderFuture,
    (user, order) -> user + ":" + order);
```

### allOf / anyOf：批量聚合

```java
// 等待全部完成
CompletableFuture<Void> all = CompletableFuture.allOf(future1, future2, future3);
all.join(); // 阻塞等待全部完成

// 任一完成即返回
CompletableFuture<Object> any = CompletableFuture.anyOf(future1, future2);
Object result = any.get();
```

| 方法    | 行为                                               |
| ------- | -------------------------------------------------- |
| `allOf` | 等待所有任务完成，返回 `CompletableFuture<Void>`   |
| `anyOf` | 任一任务完成即返回，结果是最先完成的那个任务的结果 |

## 项目实战模式

### 模式一：并行聚合

```java
// 首页需要同时获取文章列表、广告栏、排行榜
CompletableFuture<List<Article>> articlesFuture =
    CompletableFuture.supplyAsync(() -> getArticles(), executor);
CompletableFuture<List<Ad>> adsFuture =
    CompletableFuture.supplyAsync(() -> getAds(), executor);
CompletableFuture<Ranking> rankingFuture =
    CompletableFuture.supplyAsync(() -> getRanking(), executor);

CompletableFuture.allOf(articlesFuture, adsFuture, rankingFuture)
    .thenRun(() -> {
        HomePage page = new HomePage(
            articlesFuture.join(),
            adsFuture.join(),
            rankingFuture.join()
        );
        // 返回页面
    });
```

串行调用 3 个接口各 200ms = 600ms；并行后总耗时 ≈ max(200, 200, 200) = 200ms。

### 模式二：串行编排

```java
CompletableFuture.supplyAsync(() -> getUser(userId), executor)
    .thenCompose(user -> CompletableFuture.supplyAsync(
        () -> getOrders(user.getId()), executor))
    .thenCompose(orders -> CompletableFuture.supplyAsync(
        () -> enrichOrders(orders), executor))
    .exceptionally(ex -> {
        log.error("pipeline failed", ex);
        return Collections.emptyList();
    });
```

## 最佳实践

**用自定义线程池。** 所有 `supplyAsync`、`thenApplyAsync` 都传入自己的 executor，避免全局 ForkJoinPool 争抢。

**避免直接 `get()`。** `get()` 是阻塞的，如果必须用，一定要加超时：`future.get(5, TimeUnit.SECONDS)`。优先用 `thenApply`、`thenAccept` 等回调式编程。

**不要忘记异常处理。** 每个 CompletableFuture 链尾部都应该有 `exceptionally` 或 `handle`，避免异常被吞掉。

**合理拆分任务粒度。** 太细的编排会增加线程切换开销；太粗又失去并行优势。通常按"独立的远程调用"为粒度拆分。

## 小结

- CompletableFuture 解决了 Future 不能编排、阻塞获取、无异常回调的三大局限。
- 创建用 `supplyAsync`（有返回值）或 `runAsync`（无返回值），务必传入自定义线程池。
- 链式回调：`thenApply` 转换、`thenAccept` 消费、`handle`/`exceptionally` 处理异常。
- 多任务组合：`thenCompose` 串行依赖、`thenCombine` 并行合并、`allOf`/`anyOf` 批量聚合。
- 生产实践要点：自定义线程池、避免阻塞 get、异常处理不能少。

## 参考

综合自美团技术团队《CompletableFuture 原理与实践-外卖商家端 API 的异步化》及多篇 CompletableFuture 详解资料。部分资料对 API 有逐方法详解，本文聚焦在编排模式和项目实践上。京东开源的 asyncTool 框架对复杂编排场景有参考价值。
