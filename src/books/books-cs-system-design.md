---
title: "计算机基础与系统设计方向书单怎么读？"
description: "从网络、操作系统、分布式和稳定性治理梳理书单主线。"
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
  text: "数据库与中间件方向书单怎么读？"
  link: "/books/books-database-middleware.html"
next:
  text: "博客"
  link: "/blog/"
---

# 计算机基础与系统设计方向书单怎么读？

> 系统设计能力来自底层知识和工程取舍：网络、操作系统、分布式、高性能、高可用要连成一张图。

## 阅读顺序

1. 网络：TCP、HTTP、HTTPS、抓包。
2. 操作系统：进程线程、内存、IO、零拷贝。
3. 分布式：CAP、Raft、RPC、分布式锁、事务。
4. 系统设计：限流、熔断、重试、幂等、容灾。

## 怎么读出面试表达？

不要只记概念，要准备场景：

- TIME_WAIT 多了怎么办？
- 线程数为什么不能无限加？
- 分布式事务为什么不用强一致硬扛所有场景？
- 重试为什么会放大故障？

## 小结

1. 计算机基础要服务后端排障和系统设计。
2. 网络和 OS 是高性能组件的底座。
3. 分布式理论要落到一致性和可用性取舍。
4. 高可用书籍要结合故障演练、压测和恢复目标。

## 参考

基于 Oracle Java、OpenJDK、MySQL、Redis、Linux、IETF RFC、Spring、MyBatis、Apache 与 CNCF 等官方文档体系整理阅读路径。
