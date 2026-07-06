---
title: "Java 基础"
description: "Java 基础专题，从语言特性追问到设计原理，看清是否只会背答案。"
article: false
breadcrumb: true
editLink: false
next:
  text: "Java 是编译型语言还是解释型语言？"
  link: "/java/basis/java-basis-compile-and-run.html"
---

# Java 基础

## 为什么重要

基础题看似简单，但「为什么这么设计」往下追问，最能暴露是不是只会背答案。== 和 equals、String 不可变、类型擦除、反射注解，每一个往深里问都牵出语言的设计取舍。

## 知识主线

语言与类型 → 面向对象 → 异常 → 泛型 → 反射、代理与 SPI

## 题目列表

### 语言与类型

- [Java 是编译型语言还是解释型语言？](./java-basis-compile-and-run.html) — 从字节码、JIT/AOT 到 JVM/JDK/JRE 关系，讲清「编译与解释并存」。
- [基本类型和包装类型有什么区别？缓存机制是怎么回事？](./java-basis-data-types.html) — 存储、默认值、Integer 缓存与浮点精度的坑。
- [为什么说 Java 只有值传递？](./java-basis-pass-by-value.html) — 三个递进例子破除对象传递的常见误解。

### 面向对象

- [面向对象三大特征、重载重写、接口与抽象类怎么理解？](./java-basis-oop.html) — 封装继承多态、绑定时机与接口新特性。
- [== 和 equals 有什么区别？为什么重写 equals 一定要重写 hashCode？](./java-basis-equals-hashcode.html) — == 比引用、equals 比内容与两者的约定。
- [String 为什么不可变？和 StringBuilder、常量池是什么关系？](./java-basis-string.html) — 不可变设计、常量池、intern 与拼接优化。

### 异常与泛型

- [Java 异常体系是怎么设计的？checked 和 unchecked 怎么选？](./java-basis-exception.html) — Throwable 继承树到 try-with-resources。
- [泛型是什么？类型擦除会带来哪些坑？](./java-basis-generics.html) — 编译期检查、类型擦除、通配符与 PECS。

### 反射、代理与 SPI

- [反射是什么？注解又是怎么靠反射工作的？](./java-basis-reflection-annotation.html) — 反射的能力与代价，注解的保留策略。
- [JDK 动态代理和 CGLIB 有什么区别？](./java-basis-dynamic-proxy.html) — 静态代理到两种动态代理的原理与选型。
- [SPI 是什么？和 API 有什么区别？](./java-basis-spi.html) — ServiceLoader 机制、实际应用与局限。
