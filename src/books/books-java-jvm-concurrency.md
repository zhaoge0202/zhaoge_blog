---
title: "Java、JVM、并发方向书单怎么读？"
description: "按阶段梳理 Java、JVM 与并发书籍的阅读顺序和目标。"
breadcrumb: true
article: true
editLink: false
category:
  - "技术书籍"
tag:
  - "体系化"
  - "进阶"
  - "项目实战"
prev:
  text: "技术书籍"
  link: "/books/"
next:
  text: "数据库与中间件方向书单怎么读？"
  link: "/books/books-database-middleware.html"
---

# Java、JVM、并发方向书单怎么读？

> 书单不是越多越好，3-5 年后端更需要按“语言基础 -> JVM -> 并发 -> 源码”逐层补短板。

## 推荐顺序

1. 先补 Java 语言和集合基础，能解释常用容器和语法边界。
2. 再读 JVM 内存、GC、类加载，把线上 OOM 和 Full GC 排查串起来。
3. 再读并发，重点是 JMM、锁、AQS、线程池和并发工具。
4. 最后用源码阅读验证框架行为。

## 怎么读才不散？

每读一章都要落到一个问题：

- 这个知识点能解释哪道面试题？
- 能解决哪类线上问题？
- 和项目里哪段代码有关？

## 小结

1. Java 方向读书要围绕语言、JVM、并发和源码四条线。
2. JVM 书籍要结合工具和日志读，不要只背概念。
3. 并发书籍要落到线程池、锁和内存可见性。
4. 每本书都要转成可复述的问题和项目例子。

## 参考

基于 Oracle Java、OpenJDK、MySQL、Redis、Linux、IETF RFC、Spring、MyBatis、Apache 与 CNCF 等官方文档体系整理阅读路径。
