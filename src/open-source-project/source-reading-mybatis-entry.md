---
title: "读 MyBatis 源码应该先看 Executor 还是 Mapper 代理？"
description: "从 Mapper 代理、MappedStatement 和 Executor 调度讲清 MyBatis 阅读路径。"
breadcrumb: true
article: true
editLink: false
category:
  - "开源项目"
tag:
  - "进阶"
  - "原理深入"
  - "项目实战"
prev:
  text: "读 Spring 源码应该从 Bean 生命周期还是启动流程切入？"
  link: "/open-source-project/source-reading-spring-entry.html"
next:
  text: "读 Netty 源码应该先理解 Reactor 还是 ByteBuf？"
  link: "/open-source-project/source-reading-netty-entry.html"
---

# 读 MyBatis 源码应该先看 Executor 还是 Mapper 代理？

> MyBatis 源码适合从 Mapper 方法调用开始，顺着代理找到 MappedStatement，再进入 Executor 执行链。

## 为什么先看 Mapper 代理？

业务代码里最先接触的是 Mapper 接口：

```java
userMapper.selectById(id);
```

这行代码背后没有实现类，而是代理对象根据接口方法定位 `MappedStatement`，再交给执行器完成查询。

```text
MapperProxy -> MapperMethod -> MappedStatement -> Executor -> StatementHandler
```

## Executor 负责什么？

Executor 是执行调度核心，负责：

- 查询和更新调度。
- 一级缓存。
- 事务提交回滚。
- 创建 StatementHandler。

分页插件、缓存问题、SQL 执行链都能从这里串起来。

## 小结

1. MyBatis 阅读入口建议从 Mapper 代理开始，因为它贴近业务调用。
2. `MappedStatement` 是接口方法和 SQL 语句的桥。
3. Executor 是执行调度中心，连接缓存、事务和 StatementHandler。
4. 读源码要围绕“接口方法怎么变成 SQL 执行”这条主线。

## 参考

基于 Spring Framework、Spring Boot、MyBatis、Netty 官方文档与公开源码中启动流程、生命周期、执行链路、Reactor 和 ByteBuf 等相关内容整理。
