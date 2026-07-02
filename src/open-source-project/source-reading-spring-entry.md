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

## 为什么先看启动流程？

如果面试官问的是“Spring 容器怎么启动”，入口应该放在
`AbstractApplicationContext#refresh()`。它是容器级主线，负责把环境、Bean 定义、后处理器和非懒加载单例初始化串起来。

Bean 生命周期当然重要，但它描述的是“某一个 Bean 如何被创建、注入、初始化、增强、销毁”。如果一上来就钻生命周期，很容易只记住几个回调接口，却讲不清这些回调是在容器启动的哪个阶段被触发的。

更稳的阅读顺序是：

```text
SpringApplication.run
  -> ApplicationContext#refresh
  -> BeanDefinition 加载与注册
  -> BeanFactoryPostProcessor 修改 Bean 定义
  -> BeanPostProcessor 注册
  -> finishBeanFactoryInitialization
  -> getBean / doCreateBean
  -> 实例化 / 属性填充 / 初始化 / AOP 代理 / 销毁回调登记
```

这样读的好处是：先有容器全局地图，再把 Bean 生命周期放回 `finishBeanFactoryInitialization()` 之后的单例创建阶段，就不会把“启动流程”和“生命周期回调”割裂开。

## `refresh()` 这条线要抓哪些节点？

读 `refresh()` 不需要逐行背源码，抓住几个改变容器状态的节点就够了。

| 节点                            | 重点问题                                  | 项目里能解释什么                      |
| ------------------------------- | ----------------------------------------- | ------------------------------------- |
| 准备环境与上下文                | 配置、环境变量、事件机制怎么准备          | 配置未生效、Profile 切换问题          |
| 加载 `BeanDefinition`           | 类、注解、XML、`@Bean` 如何变成 Bean 定义 | 为什么类被扫描到但还没实例化          |
| 执行 `BeanFactoryPostProcessor` | 在实例化前修改 Bean 定义                  | 配置类解析、占位符替换、动态注册 Bean |
| 注册 `BeanPostProcessor`        | 准备实例级后处理器                        | AOP、事务、异步等代理能力从哪里接入   |
| 初始化非懒加载单例              | 触发 `getBean()` 和 `doCreateBean()`      | 启动慢、依赖注入失败、循环依赖        |

这里最容易混的是两个后处理器：

- `BeanFactoryPostProcessor` 面向 Bean 定义，发生在 Bean 实例化之前。
- `BeanPostProcessor` 面向 Bean 实例，发生在初始化前后，AOP 代理通常在这条线上完成。

一个简单判断：如果你要解释“某个 Bean 为什么被注册成这样”，看定义阶段；如果你要解释“某个 Bean 为什么变成了代理对象”，看实例阶段。

## Bean 生命周期放在哪条源码线上？

Bean 创建可以顺着 `AbstractAutowireCapableBeanFactory#doCreateBean()` 看。它大致对应四个动作：

```text
createBeanInstance
  -> populateBean
  -> initializeBean
  -> registerDisposableBeanIfNecessary
```

翻译成面试语言就是：

1. 先实例化对象，通常会涉及构造器或工厂方法。
2. 再做属性填充，`@Autowired`、`@Resource`、`@Value` 这类依赖注入会在这一段体现。
3. 然后执行初始化，包含 `Aware` 回调、初始化方法，以及 `BeanPostProcessor` 的前后置处理。
4. 最后登记销毁回调，容器关闭时再释放资源。

注意，默认情况下容器启动阶段主要初始化非懒加载单例。原型 Bean、懒加载 Bean 不一定在启动时创建，所以不要把“Spring 启动”简单说成“创建所有 Bean”。

## AOP、事务和循环依赖怎么接上？

源码阅读要能解释项目问题，Spring 最常见的三个落点是代理、事务和循环依赖。

**事务为什么会失效？**

`@Transactional` 不是注解本身直接开启事务，而是通过 AOP 代理把调用拦到事务拦截器里。外部对象调用代理方法时，事务逻辑才能织入；同一个类内部自调用绕过代理，就可能导致事务不生效。

所以排查事务失效时，不要只盯注解是否存在，还要确认：

- 方法是否通过代理对象被调用。
- 方法是否满足代理拦截条件。
- 类是否交给容器管理。
- 回滚异常、传播行为和只读事务配置是否符合预期。

**循环依赖发生在哪里？**

循环依赖不是扫描阶段的问题，而是在创建 Bean、填充依赖时暴露出来的。单例 Bean 的部分循环依赖可以通过三级缓存和早期引用缓解：

```text
singletonObjects        -> 完整单例
earlySingletonObjects   -> 早期暴露对象
singletonFactories      -> 生成早期引用的 ObjectFactory
```

这套机制不是万能的。构造器注入、原型 Bean、复杂代理场景都可能处理不了。`@Lazy` 可以通过注入代理延迟真实对象创建，但它只是绕开某些依赖链的创建时机，不是根治设计上的循环依赖。

**自动装配怎么接到启动流程？**

Spring Boot 的自动装配可以放在“Bean 定义来源”这条线上理解：启动类引入自动配置能力，自动配置类再通过条件注解决定是否注册对应 Bean。它不是把所有配置类无脑加载进容器，而是先收集候选，再按 classpath、Bean、配置属性等条件筛选。

## 面试里怎么讲成项目能力？

不要说“我看过 Spring 源码”，要把问题、路径和落地动作讲出来。

可以这样组织：

```text
我们项目遇到启动慢和事务偶发失效的问题。
我先从 refresh() 看容器启动主线，确认卡点在非懒加载单例初始化阶段；
再顺着 doCreateBean() 看属性填充和初始化，定位到某个 Bean 初始化时同步加载远程配置。
事务问题则顺着 AOP 代理和 TransactionInterceptor 看，发现同类自调用绕过了代理。
最后把远程加载移出初始化链路，把事务方法拆到独立服务中，启动耗时和事务问题都能解释清楚。
```

这类表达比背生命周期回调更有说服力，因为它说明你不是只记类名，而是能用源码路径解释工程现象。

## 容易踩的坑

- 不要把 Bean 生命周期和 `refresh()` 启动流程对立起来，生命周期是启动流程后半段的一部分。
- 不要把 `BeanFactoryPostProcessor` 和 `BeanPostProcessor` 说反，前者改定义，后者改实例。
- 不要说 Spring 一定能解决循环依赖，它只覆盖部分单例、非构造器注入场景。
- 不要说 `@Transactional` 注解本身直接开事务，真正生效依赖代理和事务拦截链。
- 不要说自动装配会加载所有配置类，条件装配会决定候选配置是否真正生效。

## 小结

1. Spring 源码入口优先抓 `refresh()`，它是容器级启动主线。
2. Bean 生命周期嵌在单例 Bean 创建阶段，适合解释注入、初始化、代理和销毁。
3. `BeanFactoryPostProcessor` 改 Bean 定义，`BeanPostProcessor` 改 Bean 实例或代理。
4. 事务、自调用和循环依赖都要放到代理、创建流程和早期引用的边界里讲。
5. 面试表达要从项目问题出发，用源码路径解释现象，再落到改造动作。

## 参考

综合 Spring Framework 官方文档、Spring Boot 自动配置文档和容器启动源码主线整理；重点核对了 `AbstractApplicationContext#refresh()`、`doCreateBean()`、后处理器、事务代理、自调用和循环依赖边界。
