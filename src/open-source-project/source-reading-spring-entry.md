---
title: "读 Spring 源码应该从 Bean 生命周期还是启动流程切入？"
description: "从 refresh 主线和 Bean 生命周期讲清 Spring 源码阅读入口。"
breadcrumb: true
article: true
editLink: false
category:
  - "开源项目"
tag:
  - "进阶"
  - "体系化"
  - "项目实战"
prev:
  text: "开源项目"
  link: "/open-source-project/"
next:
  text: "读 MyBatis 源码应该先看 Executor 还是 Mapper 代理？"
  link: "/open-source-project/source-reading-mybatis-entry.html"
---

# 读 Spring 源码应该从 Bean 生命周期还是启动流程切入？

> 读 Spring 源码不要从类海里乱钻，先抓 `refresh()` 启动主线，再用 Bean 生命周期解释扩展点。

## 两条线怎么选？

如果目标是理解 Spring 容器启动，先看 `ApplicationContext#refresh()`。

如果目标是回答业务扩展点，先看 Bean 生命周期。

两条线不是互斥的：

```text
refresh 主线 -> BeanDefinition -> BeanFactoryPostProcessor -> BeanPostProcessor -> 单例 Bean 初始化
```

Bean 生命周期其实嵌在 refresh 的后半段。

## 面试怎么讲？

可以这样表达：

1. 我不会逐行背源码，会先抓容器启动主流程。
2. `refresh()` 负责准备环境、加载 BeanDefinition、执行后处理器、初始化单例。
3. Bean 生命周期回答扩展点：实例化、属性填充、初始化、代理增强、销毁。
4. 项目里最常遇到的是 BeanPostProcessor、事务代理、自动装配和循环依赖。

## 小结

1. Spring 源码入口优先抓 `refresh()` 主流程。
2. Bean 生命周期适合承接扩展点和代理问题。
3. 不要逐行翻源码，要用问题驱动阅读。
4. 面试表达要连接自动装配、AOP、事务和循环依赖。

## 参考

基于 Spring Framework、Spring Boot、MyBatis、Netty 官方文档与公开源码中启动流程、生命周期、执行链路、Reactor 和 ByteBuf 等相关内容整理。
