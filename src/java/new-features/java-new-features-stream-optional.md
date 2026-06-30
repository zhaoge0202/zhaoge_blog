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

## Stream 适合什么？

Stream 适合对集合做过滤、映射、分组、聚合。

```java
Map<Long, List<Order>> ordersByUser = orders.stream()
    .filter(order -> order.isPaid())
    .collect(Collectors.groupingBy(Order::userId));
```

这段代码表达的是“筛出已支付订单并按用户分组”。如果用循环也能写，但 Stream 更接近业务意图。

## 什么时候不该用 Stream？

如果链路里有复杂分支、异常处理、副作用写入、远程调用，就不要为了“函数式”硬塞进 Stream。

```java
// 不推荐：隐藏副作用，排查困难
users.stream().map(user -> rpcClient.sync(user)).toList();
```

这种代码不如普通 `for` 循环清楚，还更难控制失败重试和日志。

## Optional 解决什么？

Optional 适合表达“这个返回值可能不存在”。

```java
Optional<User> user = userRepository.findById(userId);
```

它比返回 `null` 更明确，但不适合做字段类型，也不建议在参数里到处传。实体字段用 Optional 会影响序列化、ORM 映射和调用习惯。

## 面试怎么答？

可以这样收口：

- Stream 用来让集合转换更可读，但复杂逻辑仍用循环。
- Optional 用来表达可能不存在的返回值，不是消灭所有 `null`。
- 并行 Stream 默认使用公共线程池，业务服务里要谨慎使用。
- 代码可读性优先，不要为了新语法牺牲调试和异常处理。

## 小结

1. Stream 适合无副作用的集合转换、过滤和聚合。
2. 复杂分支、RPC、写库、重试逻辑不适合塞进 Stream。
3. Optional 适合作为返回值，不适合实体字段和滥用参数。
4. 新语法的目标是表达意图，不是炫技。

## 参考

基于 Oracle Java SE Documentation 与 OpenJDK JEP 中 Java 8、Java 17、Java 21、record、sealed class、pattern matching 和 virtual threads 等相关官方内容整理。
