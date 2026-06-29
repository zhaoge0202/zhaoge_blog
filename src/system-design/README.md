---
title: "系统设计"
article: false
breadcrumb: true
editLink: false
---

# 系统设计

这里会承载高并发、高可用、缓存、消息队列、服务治理和项目场景题。它不是单独背概念的地方，而是把数据库、框架、分布式和稳定性能力串成一条工程主线。

## 会覆盖什么

- 高并发与容量评估
- 缓存、异步化、削峰填谷
- 高可用、超时重试、幂等与一致性
- 场景题里的项目表达与取舍

## 当前子域

- [设计基础](./basis/)：设计原则、接口分层、模式和工程规范。
- [框架](./framework/)：Spring、Spring Boot、MyBatis 这些面试高频框架原理。
- [安全](./security/)：认证、授权、会话、加密和常见漏洞边界。

## 当前重点文章

- [面试准备](../interview-preparation/)
- [Spring IoC 容器启动时做了什么？](./framework/spring-ioc-container-startup.html)
- [Bean 生命周期有哪些关键扩展点？](./framework/spring-bean-lifecycle-extension-points.html)
- [Spring 如何解决循环依赖？为什么构造器注入不行？](./framework/spring-circular-dependency-resolution.html)
- [AOP 动态代理是怎么织入的？](./framework/spring-aop-proxy-weaving.html)
- [Spring 事务为什么会失效？](./framework/spring-transaction-failure-cases.html)
- [Spring MVC 请求处理流程是怎样的？](./framework/spring-mvc-request-processing.html)
- [Spring Boot 自动装配原理是什么？](./framework/spring-boot-auto-configuration-principles.html)
- [MyBatis 一级缓存和二级缓存为什么容易踩坑？](./framework/mybatis-cache-pitfalls.html)
- [MyBatis 插件机制和分页插件怎么工作？](./framework/mybatis-plugin-pagination-mechanism.html)
- [数据库](../database/)
- [从资料汇总转向内容纠偏](../blog/essays/2026-06-16-note-1.html)
