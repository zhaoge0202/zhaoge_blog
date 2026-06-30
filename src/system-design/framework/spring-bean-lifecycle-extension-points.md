---
title: "Bean 生命周期有哪些关键扩展点？"
description: "从实例化到销毁，讲清 Aware、后处理器和生命周期回调的边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "框架"
tag:
  - "高频"
  - "原理深入"
  - "体系化"
prev:
  text: "Spring IoC 容器启动时做了什么？"
  link: "/system-design/framework/spring-ioc-container-startup.html"
next:
  text: "Spring 如何解决循环依赖？为什么构造器注入不行？"
  link: "/system-design/framework/spring-circular-dependency-resolution.html"
---

# Bean 生命周期有哪些关键扩展点？

> Bean 生命周期这道题的重点，不是把十几个回调名词背一遍，而是讲清 Spring 在哪几个阶段给了你什么扩展点，它们分别适合干什么、不适合干什么。

先看一个常见场景：

- 你想在属性注入完成后校验配置是否合法。
- 你想在 Bean 初始化前后统一包一层逻辑。
- 你想在容器所有单例都准备好以后，再启动一个后台任务。

这三个动作都发生在“Bean 启动期”，但它们挂的扩展点并不一样。很多人把这些钩子混成一坨，最后答成“先实例化、再注入、再 `@PostConstruct`、再 AOP”。这样太粗了。

更好的答法，是先抓住生命周期主线，再把扩展点挂回去。

## 先抓主线：生命周期不是一条方法链，而是 4 个阶段

单看一个 Bean，可以先把流程压成 4 段：

1. 实例化
2. 属性填充
3. 初始化
4. 销毁

用图看更直观：

```mermaid
flowchart TD
 A[实例化 Bean] --> B[属性填充/依赖注入]
 B --> C[Aware 回调]
 C --> D[BeanPostProcessor before]
 D --> E[@PostConstruct / afterPropertiesSet / init-method]
 E --> F[BeanPostProcessor after]
 F --> G[Bean 可被业务使用]
 G --> H[容器关闭]
 H --> I[@PreDestroy / destroy / destroy-method]
```

这个顺序里，真正最容易考的不是“有哪几个名词”，而是下面 3 个问题：

1. 哪些是 **拿容器资源** 的扩展点？
2. 哪些是 **初始化逻辑** 的扩展点？
3. 哪些是 **改 Bean 本身甚至返回代理** 的扩展点？

## 1. 实例化：对象先被造出来，但这时还不能正常工作

实例化阶段只是把对象造出来，通常还没完成依赖注入。

比如：

```java
public class OrderService {
 private OrderRepository orderRepository;
}
```

此时 Spring 可能已经通过构造器或工厂方法拿到了 `OrderService` 实例，但 `orderRepository` 还没填进去。

所以这一步通常不适合做依赖其他 Bean 的业务逻辑。你在这个阶段拿到的，只是一个“空壳对象”。

## 2. 属性填充：`@Autowired`、`@Resource` 真正生效的地方

第二步才是依赖注入。

这里会处理：

- `@Autowired`
- `@Resource`
- `@Value`
- setter 注入
- 字段注入

也就是说，很多人嘴里的“Bean 创建好了”，严格说要过了这一步才接近靠谱。因为只有依赖填完，后面的初始化回调才有意义。

## 3. Aware：给 Bean 一些容器级上下文

如果 Bean 实现了 `Aware` 相关接口，Spring 会在初始化前把一些容器资源注进去。

常见的有：

| 接口                      | 能拿到什么                  |
| ------------------------- | --------------------------- |
| `BeanNameAware`           | 当前 Bean 的名字            |
| `BeanClassLoaderAware`    | 加载当前 Bean 的类加载器    |
| `BeanFactoryAware`        | 所在的 `BeanFactory`        |
| `ApplicationContextAware` | 所在的 `ApplicationContext` |

这一步的核心作用不是“做初始化”，而是让 Bean 知道自己处在什么容器环境里。

比如有些基础设施组件需要拿到 `ApplicationContext` 去按名字找别的 Bean，这就会用到 `ApplicationContextAware`。

但业务代码里不要把 `Aware` 当成默认姿势。它更适合偏框架、偏基础设施的代码。普通业务 Bean 如果到处感知容器，本质上是在往 Service 里反塞框架耦合。

## 4. `BeanPostProcessor`：最强的通用扩展点

如果说生命周期里哪个扩展点最值得重点讲，就是 `BeanPostProcessor`。

它提供两个钩子：

```java
postProcessBeforeInitialization()
postProcessAfterInitialization()
```

可以先用一句话概括它的定位：

- before：初始化方法执行前，再加工一次 Bean
- after：初始化方法执行后，再加工一次 Bean，甚至返回代理对象

这一步为什么重要？

因为很多 Spring 能力本质上就是靠它挂进去的，比如：

- `@PostConstruct`
- `@PreDestroy` 的处理
- `@Autowired` 的一部分注解处理链
- AOP 自动代理

所以你可以把它理解成：

**Spring 不是靠“写死一堆 if else”支持这么多注解，而是靠后处理器把能力一层层织进去。**

## 5. 初始化回调：常见有 3 种

初始化阶段最常见的扩展点有三类：

1. `@PostConstruct`
2. `InitializingBean.afterPropertiesSet()`
3. 自定义 `init-method`

这三者做的事很像，都是：

**等依赖注入完成后，再执行一段初始化逻辑。**

比如：

- 校验配置是否合法
- 预热本地缓存
- 初始化线程池、连接池包装对象
- 基于配置构建内部数据结构

### 推荐顺序怎么理解

Spring 官方文档明确给了多种初始化机制并存时的顺序：

1. `@PostConstruct`
2. `afterPropertiesSet()`
3. 自定义 `init-method`

这也是一个常见细节题。不是“谁先写谁先执行”，而是 Spring 本身有固定顺序。

### 为什么更推荐 `@PostConstruct`

官方文档的态度很明确：相较于 `InitializingBean`，更推荐 `@PostConstruct` 或普通初始化方法。

原因不复杂：

- `InitializingBean` 会把业务类直接耦合到 Spring 接口。
- `@PostConstruct` 和普通方法更像 POJO，不把类绑死在 Spring 上。

如果你要给同事一个工程建议，可以这样说：

- 业务 Bean：优先 `@PostConstruct`
- 基础设施或历史代码：可能还能看到 `afterPropertiesSet()`
- XML 或显式配置风格：会看到 `init-method`

## 6. 一个容易答错的点：初始化方法不适合做重活

这是我建议你在面试里主动加的一句，因为它能一下子把回答从“背概念”拉到“理解运行时边界”。

Spring 官方文档专门提醒：

- `@PostConstruct` 这类初始化回调，运行在单例创建锁里。
- 这时 Bean 还没完全发布给外部使用。
- 如果在这里做很重的初始化，或者去触发复杂的外部 Bean 访问，可能导致初始化死锁或启动阶段卡死。

所以初始化回调更适合做：

- 配置校验
- 轻量本地数据准备
- 必要的内部状态收敛

不太适合在这里做：

- 很重的远程调用
- 长时间阻塞
- 大量异步任务编排
- 依赖“所有单例都已就绪”的动作

## 7. 所有单例都起来以后，再用哪个扩展点？

这也是很多人生命周期答不完整的地方。

如果你的逻辑必须等：

- 所有非懒加载单例都初始化完
- AOP 代理也都就位
- 整个容器已经 refresh 完

那就不该放到 `@PostConstruct` 里。

更合适的是两类做法：

1. `SmartInitializingSingleton.afterSingletonsInstantiated()`
2. 监听 `ContextRefreshedEvent`

它们的共同点是：都发生在常规单例初始化之后。

比如一个搜索索引预热器，要等所有 DAO、事务代理、配置 Bean 都准备好后再启动，这时用这两个点就比 `@PostConstruct` 更稳。

## 8. `BeanPostProcessor after` 为什么经常和 AOP 一起讲

因为很多代理对象就是在这个阶段包出来的。

一个典型过程大致是：

1. Spring 先创建原始 Bean。
2. 完成依赖注入和初始化回调。
3. 某个 `BeanPostProcessor` 判断它需要事务、日志或切面增强。
4. 返回代理对象，而不是原始对象。

所以这也解释了两个常见现象：

- 你注入到别的 Bean 里的，可能是代理对象，不是原始对象。
- 初始化回调里不要想当然地依赖完整代理语义。

这和上一篇 IoC 启动文是连起来的：容器真正“准备好能给别人用”的对象，很多时候已经经过后处理器改造了。

## 9. 销毁阶段有哪些扩展点

销毁阶段通常比初始化阶段简单，核心也是三种：

1. `@PreDestroy`
2. `DisposableBean.destroy()`
3. 自定义 `destroy-method`

它们适合做的事情主要是资源释放，比如：

- 关闭线程池
- 关闭连接
- flush 本地缓冲
- 停止后台任务

和初始化阶段一样，官方也更倾向不把业务代码写死到 Spring 接口上，所以普通场景里 `@PreDestroy` 往往更自然。

## 用一个例子把这些扩展点串起来

假设有个 `LocalRuleEngine` Bean：

- 它依赖数据库配置加载器
- 启动后要把规则预加载到内存
- 所有单例都起来后再异步建立索引
- 关闭时要停掉后台线程池

比较合理的拆法是：

| 需求                       | 更适合放哪                                              |
| -------------------------- | ------------------------------------------------------- |
| 校验配置是否完整           | `@PostConstruct`                                        |
| 轻量初始化本地规则表       | `@PostConstruct`                                        |
| 给 Bean 统一包装监控逻辑   | `BeanPostProcessor`                                     |
| 等所有单例就绪后异步建索引 | `SmartInitializingSingleton` 或 `ContextRefreshedEvent` |
| 关闭线程池                 | `@PreDestroy`                                           |

这样答，面试官能直接看到你不是只会背名词，而是真的知道不同动作该挂在哪个生命周期点。

## 容易踩的坑

### `Aware` 不是默认业务扩展点

它能解决问题，但它本质是在给 Bean 暴露容器细节。业务代码里能不用就不用，尤其不要动不动就拿 `ApplicationContextAware` 当服务定位器。

### `@PostConstruct` 不等于“容器已经完全 ready”

它只是说明当前 Bean 的依赖已经注入完，可以做本地初始化。
如果你要依赖“所有单例都就绪”，应该往 `SmartInitializingSingleton` 或 `ContextRefreshedEvent` 这类点上放。

### `InitializingBean` 不是最佳默认选项

它能用，但会把代码耦合到 Spring。普通业务场景里，`@PostConstruct` 更干净。

## 小结

- Bean 生命周期可以先抓成 4 段：实例化、属性填充、初始化、销毁。
- `Aware` 负责暴露容器上下文，`BeanPostProcessor` 负责最强的通用加工能力。
- 初始化回调常见是 `@PostConstruct`、`afterPropertiesSet()`、`init-method`，官方更推荐前两者里的 `@PostConstruct` 风格。
- 很重的启动动作不要塞进 `@PostConstruct`，更适合放到 `SmartInitializingSingleton` 或 `ContextRefreshedEvent` 之后。
- 销毁阶段的常见扩展点是 `@PreDestroy`、`destroy()` 和 `destroy-method`，核心目标是资源释放。

## 参考

基于 Spring Framework Reference Documentation 中 IoC Container、Bean Lifecycle、AOP Proxies、Transaction Management、Spring MVC DispatcherServlet 与 Handler Methods 等相关章节整理。
