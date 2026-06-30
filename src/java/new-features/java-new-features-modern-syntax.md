---
title: "新版本 Java 的模式匹配、记录类、密封类适合哪些场景？"
description: "用数据载体、类型分支和领域模型讲清现代 Java 语法。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java"
tag:
  - "进阶"
  - "细节题"
  - "项目实战"
prev:
  text: "Java 21 虚拟线程对传统线程池有什么影响？"
  link: "/java/new-features/java-new-features-java21-virtual-threads.html"
next:
  text: "计算机基础"
  link: "/cs-basics/"
---

# 新版本 Java 的模式匹配、记录类、密封类适合哪些场景？

> 现代 Java 语法的价值，是把“数据长什么样、类型有哪些可能、分支怎么处理”表达得更直接。

## record 适合什么？

`record` 适合不可变数据载体，比如查询结果、接口 DTO、配置快照。

```java
public record UserSummary(Long id, String name, String mobile) {}
```

它会自动生成构造器、访问器、`equals`、`hashCode` 和 `toString`。但它不适合复杂可变领域对象。

## sealed class 适合什么？

密封类适合限定子类型集合，比如支付结果、订单状态事件、规则表达式。

```java
public sealed interface PayResult permits Success, Failed, Processing {}
```

这样调用方知道类型空间是封闭的，配合 switch 更容易穷尽处理。

## 模式匹配解决什么？

模式匹配让类型判断和变量绑定合在一起，减少样板代码。

```java
if (event instanceof OrderPaid paid) {
    handlePaid(paid.orderId());
}
```

适合类型分支明确的场景，但不要把它当成复杂业务策略的替代品。策略很多时，仍然应该用多态或策略模式。

## 小结

1. record 适合不可变数据载体，不适合复杂可变实体。
2. sealed class 适合封闭类型集合，能让分支处理更可靠。
3. 模式匹配减少类型判断样板代码，但不能替代合理建模。
4. 新语法要服务领域表达，而不是为了新而新。

## 参考

基于 Oracle Java SE Documentation 与 OpenJDK JEP 中 Java 8、Java 17、Java 21、record、sealed class、pattern matching 和 virtual threads 等相关官方内容整理。
