---
title: "框架"
article: false
breadcrumb: true
editLink: false
next:
  text: "Spring IoC 容器启动时做了什么？"
  link: "/system-design/framework/spring-ioc-container-startup.html"
---

# 框架

## 为什么重要

Spring 全家桶是 Java 后端的事实标准，IoC、AOP、事务、自动装配几乎是必问，还能直接连到项目经验。

## 知识主线

Spring 核心 -> Spring MVC -> Spring Boot -> Spring Cloud / MyBatis

## 题目列表

### Spring 核心

- [Spring IoC 容器启动时做了什么？](./spring-ioc-container-startup.html) — 从 `refresh()` 主流程、BeanDefinition、后处理器和单例初始化讲清容器启动。
- [Bean 生命周期有哪些关键扩展点？](./spring-bean-lifecycle-extension-points.html) — 从实例化、初始化到销毁，把 `Aware`、后处理器和生命周期回调的边界讲清。
- [Spring 如何解决循环依赖？为什么构造器注入不行？](./spring-circular-dependency-resolution.html) — 从提前暴露、三级缓存和 AOP 代理讲清循环依赖的边界。
- [AOP 动态代理是怎么织入的？](./spring-aop-proxy-weaving.html) — 从代理生成、通知链和自调用失效讲清 Spring AOP 的工作方式。
- [Spring 事务为什么会失效？](./spring-transaction-failure-cases.html) — 从代理边界、回滚规则和传播行为讲清 `@Transactional` 的常见坑。

### Spring MVC

- [Spring MVC 请求处理流程是怎样的？](./spring-mvc-request-processing.html) — 从 `DispatcherServlet`、参数解析、返回值处理和异常收口讲清 MVC 主线。

### Spring Boot

- [Spring Boot 自动装配原理是什么？](./spring-boot-auto-configuration-principles.html) — 从候选配置发现、条件过滤和 back-off 讲清自动装配主线。

### MyBatis

- [MyBatis 一级缓存和二级缓存为什么容易踩坑？](./mybatis-cache-pitfalls.html) — 从 `SqlSession`、namespace 缓存和一致性边界讲清 MyBatis 缓存的真实问题。
- [MyBatis 插件机制和分页插件怎么工作？](./mybatis-plugin-pagination-mechanism.html) — 从四大可拦截接口、代理链和 SQL 改写讲清插件与分页主线。
