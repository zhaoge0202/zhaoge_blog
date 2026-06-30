---
title: "数据库与中间件方向书单怎么读？"
description: "按 MySQL、Redis、MQ 和搜索中间件梳理书单阅读主线。"
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
  text: "Java、JVM、并发方向书单怎么读？"
  link: "/books/books-java-jvm-concurrency.html"
next:
  text: "计算机基础与系统设计方向书单怎么读？"
  link: "/books/books-cs-system-design.html"
---

# 数据库与中间件方向书单怎么读？

> 数据库和中间件书籍要按“原理 -> 排障 -> 工程取舍”读，不能只停在命令和 API。

## 阅读主线

建议顺序：

1. MySQL：索引、事务、锁、日志、复制、DDL。
2. Redis：数据结构、持久化、复制、哨兵、Cluster、缓存问题。
3. MQ：可靠性、幂等、积压、顺序、选型。
4. 搜索：倒排索引、分词、查询、分片和深分页。

## 怎么结合项目？

每读一个组件，都要问：

- 它解决了什么问题？
- 它引入了什么新问题？
- 线上怎么观测？
- 出故障时先看哪些证据？

## 小结

1. 中间件学习不能只背特性，要讲清收益和代价。
2. MySQL 和 Redis 是 3-5 年后端最优先补强的两条线。
3. MQ 和搜索要重点关注可靠性、幂等、查询成本和扩展性。
4. 书里的原理要转成排障证据链。

## 参考

基于 Oracle Java、OpenJDK、MySQL、Redis、Linux、IETF RFC、Spring、MyBatis、Apache 与 CNCF 等官方文档体系整理阅读路径。
