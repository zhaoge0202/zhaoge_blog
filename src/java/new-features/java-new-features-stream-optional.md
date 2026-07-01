---
title: "Java 8 Stream 和 Optional 怎么用才不滥用？"
description: "从集合处理、空值表达和可读性讲清 Stream 与 Optional 边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java"
tag:
  - "基础"
  - "项目实战"
  - "细节题"
prev:
  text: "新特性"
  link: "/java/new-features/"
next:
  text: "Java 17 为什么是新的长期主线版本？"
  link: "/java/new-features/java-new-features-java17-lts.html"
---

# Java 8 Stream 和 Optional 怎么用才不滥用？

> Stream 和 Optional 的价值是表达意图，不是把普通代码强行改成链式写法。

## Stream 到底是在解决什么问题？

Stream 最适合表达“从一批数据里筛选、转换、聚合出另一批结果”。它不存储数据，也不是新的集合类型，更像一条对数据源进行处理的流水线。

比如有一批订单，要筛出已支付订单，再按用户分组：

```java
Map<Long, List<Order>> ordersByUser = orders.stream()
    .filter(order -> order.isPaid())
    .collect(Collectors.groupingBy(Order::userId));
```

这段代码表达的是“筛出已支付订单并按用户分组”。如果用循环也能写，但 Stream 更接近业务意图。

它的价值主要在三类场景：

| 场景 | 常用操作                     | 说明                            |
| ---- | ---------------------------- | ------------------------------- |
| 过滤 | `filter`                     | 保留满足条件的数据              |
| 映射 | `map`、`flatMap`             | 把一种对象转换成另一种对象      |
| 聚合 | `collect`、`count`、`reduce` | 汇总成集合、Map、数量或统计结果 |

如果代码的主线就是数据转换，Stream 会让读者一眼看出“输入是什么、过滤什么、输出什么”。如果代码的主线是业务流程、事务、重试、补偿、日志和异常恢复，Stream 反而会把控制流藏起来。

## 为什么说 Stream 是惰性流水线？

Stream 操作分两类：中间操作和终止操作。

| 类型     | 例子                                                 | 是否立刻执行 | 返回值             |
| -------- | ---------------------------------------------------- | ------------ | ------------------ |
| 中间操作 | `filter`、`map`、`sorted`、`limit`、`distinct`       | 不会         | 新的 `Stream`      |
| 终止操作 | `collect`、`count`、`forEach`、`toArray`、`anyMatch` | 会           | 普通结果或无返回值 |

中间操作只是在描述流水线，不会马上遍历数据。直到遇到终止操作，整条链路才真正执行。

```java
Stream<String> stream = names.stream()
    .filter(name -> {
        System.out.println("filter: " + name);
        return name.startsWith("A");
    });

System.out.println("before count");
long count = stream.count();
```

输出顺序会先打印 `before count`，然后才打印每个元素的 `filter` 日志。原因是创建 `filter` 这一步只是搭建流水线，`count()` 才触发遍历。

这个特性也解释了为什么一个 Stream 只能消费一次：

```java
Stream<String> stream = names.stream();

long count = stream.count();
stream.forEach(System.out::println); // IllegalStateException
```

终止操作执行完，Stream 就关闭了。需要再次处理时，应重新从数据源创建新的 Stream，而不是复用旧对象。

## map 和 flatMap 怎么区分？

`map` 是“一对一转换”，一个元素转换成一个结果：

```java
List<Long> userIds = orders.stream()
    .map(Order::userId)
    .distinct()
    .collect(Collectors.toList());
```

`flatMap` 是“先一对多，再摊平”。典型例子是一个订单里有多个商品，要拿到所有商品：

```java
List<Item> items = orders.stream()
    .flatMap(order -> order.items().stream())
    .collect(Collectors.toList());
```

如果这里用 `map`，结果会变成 `Stream<List<Item>>`，也就是一堆列表；用 `flatMap` 才会展开成 `Stream<Item>`。

收集结果时还要注意两个坑：

1. `Collectors.toMap` 遇到重复 key 会抛异常，应该显式指定合并规则。
2. `Collectors.groupingBy` 适合一对多分组，不要为了得到 Map 强行用 `toMap`。

```java
Map<Long, Order> latestOrderByUser = orders.stream()
    .collect(Collectors.toMap(
        Order::userId,
        Function.identity(),
        (left, right) -> left.createdAt().isAfter(right.createdAt()) ? left : right
    ));
```

## 什么时候不该用 Stream？

如果链路里有复杂分支、异常处理、副作用写入、远程调用，就不要为了“函数式”硬塞进 Stream。

```java
// 不推荐：隐藏副作用，排查困难
users.stream()
    .map(user -> rpcClient.sync(user))
    .collect(Collectors.toList());
```

这种代码不如普通 `for` 循环清楚，还更难控制失败重试和日志。

更稳的判断标准是：Stream 里的函数尽量无副作用。`filter` 用来判断，`map` 用来转换，`collect` 用来收集。不要在这些操作里顺手改外部变量、写数据库、发消息、调远程接口。

```java
// 不推荐：外部状态被链式处理悄悄修改
List<Long> failedIds = new ArrayList<>();
orders.stream()
    .filter(order -> !payment(order))
    .forEach(order -> failedIds.add(order.id()));
```

这类代码一旦改成并行 Stream，就会暴露线程安全问题；即使不并行，也不利于日志、异常和事务边界管理。复杂业务动作更适合普通循环。

## parallelStream 为什么不能随手用？

`parallelStream` 默认使用 `ForkJoinPool.commonPool()`。这意味着它不是给当前业务方法单独创建的线程池，而是和进程内其他并行任务共享公共线程。

它适合的场景很窄：

- CPU 密集型计算；
- 数据量足够大，拆分和合并成本能被摊薄；
- 每个元素处理互相独立，没有共享可变状态；
- 对处理顺序没有强依赖。

业务服务里常见的 RPC、数据库访问、文件读取、消息发送，大多不是好场景。阻塞 I/O 会占住公共池线程，共享变量会带来并发问题，顺序要求又会抵消并行收益。

所以面试里不要把 `parallelStream` 说成“多线程所以更快”。它只是提供了一种并行执行方式，是否更快取决于任务类型、数据规模、线程池竞争和合并成本。

## Optional 解决什么？

Optional 适合表达“这个返回值可能不存在”。

```java
Optional<User> user = userRepository.findById(userId);
```

它比返回 `null` 更明确：调用方一看到返回值类型，就知道必须处理“没有值”的分支。

常用 API 可以按语义记：

| API                 | 适用场景                  | 注意点                               |
| ------------------- | ------------------------- | ------------------------------------ |
| `ofNullable(value)` | 值可能为空                | 空值会变成 `Optional.empty()`        |
| `of(value)`         | 值确定不为空              | 传入 `null` 会直接抛 NPE             |
| `map`               | 把存在的值转换成普通值    | 转换函数返回值会被重新包成 Optional  |
| `flatMap`           | 转换函数本身返回 Optional | 避免 `Optional<Optional<T>>`         |
| `orElse`            | 默认值很便宜              | 默认值会提前计算                     |
| `orElseGet`         | 默认值昂贵或有副作用      | 只有为空时才执行 Supplier            |
| `orElseThrow`       | 缺值就是异常              | 适合聚合根、配置、权限等必须存在的值 |

`orElse` 和 `orElseGet` 的差异很容易被忽略：

```java
User user = optionalUser.orElse(loadDefaultUser()); // loadDefaultUser 总会执行

User user = optionalUser.orElseGet(this::loadDefaultUser); // 只有为空时才执行
```

如果默认值要查库、调接口、构造大对象，就应该优先用 `orElseGet`。

## Optional 能消灭 NPE 吗？

不能。Optional 只是把“可能为空”显式放到类型里，错误使用仍然会出问题。

```java
Optional<User> user = Optional.of(possiblyNullUser); // possiblyNullUser 为 null 时抛 NPE

User value = user.get(); // empty 时抛 NoSuchElementException
```

更推荐的写法是把空值处理写进链路：

```java
String city = userRepository.findById(userId)
    .flatMap(User::address)
    .map(Address::city)
    .filter(cityName -> !cityName.isBlank())
    .orElse("UNKNOWN");
```

这里 `flatMap` 的意义是：`User::address` 本身已经返回 `Optional<Address>`，用 `flatMap` 可以避免嵌套 Optional。

Optional 也不适合滥用在这些位置：

- 实体字段：容易影响 ORM 映射、序列化和框架反射。
- DTO 字段：接口契约变复杂，前后端和文档工具不一定友好。
- 方法参数：调用方仍然可以传 `null`，并没有真正提升语义。
- 集合元素：`List<Optional<T>>` 通常不如过滤掉空值或拆成明确结构。

一个实用原则是：Optional 适合作为方法返回值，告诉调用方“这里可能没有”；不适合到处包一层来逃避空值设计。

## 面试怎么收口？

可以从“表达力”和“边界”两个角度说：

- Stream 用来让集合转换更可读，但复杂逻辑仍用循环。
- Stream 是惰性流水线，中间操作不执行，终止操作才触发。
- 一个 Stream 被终止操作消费后不能复用。
- Optional 用来表达可能不存在的返回值，不是消灭所有 `null`。
- 并行 Stream 默认使用公共线程池，业务服务里要谨慎使用。

## 小结

1. Stream 是惰性流水线，中间操作只描述转换，终止操作才真正执行。
2. Stream 适合无副作用的数据转换、过滤、分组和聚合，复杂业务流程仍然适合普通循环。
3. `parallelStream` 默认走公共线程池，不等于一定更快，阻塞 I/O 和共享状态场景要谨慎。
4. Optional 适合作为返回值表达“可能没有”，不适合字段、参数和集合元素滥用。
5. `ofNullable`、`orElseGet`、`map`、`flatMap` 是 Optional 常用边界，直接 `get()` 通常不是好习惯。

## 参考

综合 Java SE 官方文档、OpenJDK JEP 与相关工程实践整理，并对 Stream 惰性执行、并行流线程池边界和 Optional 空值语义做了交叉验证。
