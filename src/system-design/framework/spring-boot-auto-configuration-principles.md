---
title: "Spring Boot 自动装配原理是什么？"
description: "从 EnableAutoConfiguration、候选配置导入和条件注解讲清自动装配主线。"
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
  text: "Spring MVC 请求处理流程是怎样的？"
  link: "/system-design/framework/spring-mvc-request-processing.html"
next:
  text: "MyBatis 一级缓存和二级缓存为什么容易踩坑？"
  link: "/system-design/framework/mybatis-cache-pitfalls.html"
---

# Spring Boot 自动装配原理是什么？

> 自动装配的核心不是“Spring Boot 很聪明”，而是它提前约定了一套候选配置发现机制，再用条件注解把不该生效的配置一层层筛掉。

面试里一问到 Spring Boot，几乎都会追这个问题。

很多回答会直接背成：

- `@SpringBootApplication`
- `@EnableAutoConfiguration`
- `spring.factories`
- 条件注解

这些词都对，但如果只是点名，还没真正回答“原理”。

更稳的回答应该先抓住主线：

1. Boot 怎么知道“有哪些自动配置候选类”
2. 为什么不是所有候选类都生效
3. 用户自己写的 Bean 为什么能把默认配置顶掉
4. Boot 3 和老版本在候选配置文件位置上有什么边界

## 先用一句话定义“自动装配”

Spring Boot 官方文档的核心意思可以翻成人话：

**根据你引入的依赖、当前环境和你自己是否已经显式声明过 Bean，自动决定要不要导入一批配置类。**

比如：

- 你引入了 `spring-boot-starter-web`
- 类路径上有 MVC 相关类
- 容器里还没有你自己定义的 `DispatcherServlet`

那 Boot 就会把一组 Web 相关自动配置拉进来。

所以自动装配不是“自动创建所有 Bean”，而是：

**自动导入一批“可能有资格生效”的配置类，再让这些配置类按条件决定要不要注册 Bean。**

## 入口先看 `@SpringBootApplication`

一个典型启动类：

```java
@SpringBootApplication
public class Application {
 public static void main(String[] args) {
 SpringApplication.run(Application.class, args);
 }
}
```

`@SpringBootApplication` 本质上是一个组合注解，最关键的三块是：

1. `@SpringBootConfiguration`
2. `@ComponentScan`
3. `@EnableAutoConfiguration`

这三者的分工最好分开讲。

### `@ComponentScan` 做什么

它负责扫描你项目里显式标了：

- `@Component`
- `@Service`
- `@Controller`
- `@Repository`

这些组件。

### `@EnableAutoConfiguration` 做什么

它负责触发 Boot 的自动装配机制，把“外部依赖提供的配置类候选集”找出来并导入。

### 一个常见误区：`@AutoConfigurationPackage`

很多资料会把它讲成“把主包下所有组件注册到容器中”，这个说法不严谨。

更准确地说：

- 组件扫描是 `@ComponentScan` 做的
- `@AutoConfigurationPackage` 更像是在记录“默认自动配置包”

官方文档明确提到：
auto-configuration packages 会被一些自动配置拿来作为默认扫描边界，比如找实体类、Spring Data repository。

所以它不是通用组件扫描器，不要把它和 `@ComponentScan` 混成一回事。

## 真正的核心入口：`@EnableAutoConfiguration`

这层最值得记的是它通过 `@Import` 引入了一个关键选择器：

```text
AutoConfigurationImportSelector
```

可以把它理解成：

**负责挑出“这次启动该导入哪些自动配置类”的总调度器。**

所以自动装配主线可以先记成：

```text
@SpringBootApplication
 -> @EnableAutoConfiguration
 -> AutoConfigurationImportSelector
 -> 找候选配置类
 -> 去重/排除
 -> 条件过滤
 -> 导入剩余配置类
```

## 候选自动配置类是从哪里来的？

这是高频细节题，而且有版本边界。

### 老版本常见回答：`spring.factories`

你以前看到的很多资料会说：

```text
META-INF/spring.factories
```

这在 Spring Boot 2.x 时代是主流答案，没有问题。

### 现在更该知道的答案：`AutoConfiguration.imports`

从较新的 Spring Boot 版本开始，官方推荐的自动配置候选文件是：

```text
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

Spring Boot 官方文档在“创建自己的自动配置”里明确写了这一点。

新版自定义自动配置类通常会标 `@AutoConfiguration`，然后把全限定类名写进这个 imports 文件。也就是说，imports 文件提供的是“候选名单”，不是说这些类会无条件注册 Bean。

所以这题最稳的答法不是站死一个版本，而是把边界说清：

- 旧资料和旧项目里，常见的是 `spring.factories`
- 现在的新主线，是 `AutoConfiguration.imports`

这也正是为什么很多老文章还能看懂，但你去看新版源码或新版 starter，会发现文件位置已经变了。

## 为什么不是把这些候选类全都加载？

因为那样根本跑不起来。

假设你项目没引 Redis、没引 MQ、没引 MVC，如果 Boot 还把这些配置硬塞进去，不是报类找不到，就是把容器搞得一团糟。

所以 Boot 的真实策略是：

1. 先找到候选自动配置类
2. 再做一轮轮过滤

常见过滤逻辑包括：

- 全局开关是否开启
- `exclude` / `excludeName`
- 配置文件里的排除项
- 条件注解是否满足

排除自动配置也有几条常见路径：

```java
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
```

或者：

```text
spring.autoconfigure.exclude=...
```

如果类不在当前 classpath 上，还可以用 `excludeName` 写全限定类名。排查“为什么某个默认 Bean 没出来”时，除了看条件注解，也要看它是不是被显式排除了。

## 条件注解才是“按需装配”的关键

Boot 自动装配能做到“你引了依赖才生效、你自己定义了 Bean 它就让路”，核心靠的就是条件注解。

最常见的几类：

| 注解                           | 作用                         |
| ------------------------------ | ---------------------------- |
| `@ConditionalOnClass`          | 类路径上存在某个类才生效     |
| `@ConditionalOnMissingClass`   | 缺少某个类才生效             |
| `@ConditionalOnBean`           | 容器里已经有某个 Bean 才生效 |
| `@ConditionalOnMissingBean`    | 容器里没有某个 Bean 才生效   |
| `@ConditionalOnProperty`       | 某个配置项满足条件才生效     |
| `@ConditionalOnWebApplication` | 当前是 Web 应用才生效        |

这类条件叠起来以后，自动配置类就不再是“无脑导入”，而是“候选配置 + 条件裁剪”。

这里还有一个容易忽略的顺序细节：`@ConditionalOnBean`、`@ConditionalOnMissingBean` 这类 Bean 条件，是基于“当前已经处理过的 BeanDefinition”判断的。自动配置通常排在用户自定义 Bean 后面，才能做到用户写了 Bean，默认配置就后退。

所以写自定义 starter 时，`@Bean` 方法最好暴露足够具体的返回类型，否则条件判断可能因为类型信息不完整而不符合预期。

## 为什么你自己写的 Bean 能把默认配置顶掉？

这是面试里很值得主动加的一句，因为它能一下子把答案从“背源码流程”拉到“工程感觉”。

Spring Boot 官方文档明确强调：

**自动配置是 non-invasive，也就是非侵入的。**

翻成人话就是：

**你可以随时自己定义配置，Boot 会尽量给你让路。**

最典型的实现方式就是：

```java
@Bean
@ConditionalOnMissingBean
public ObjectMapper objectMapper() {
 return new ObjectMapper();
}
```

意思是：

- 如果用户没自己定义，就用 Boot 默认给的
- 如果用户自己定义了，就不要抢

这就是所谓 back-off 行为。

所以自动装配不是“Boot 把你项目锁死”，反而是：

**先给一套默认值，用户一旦自己接管，默认值就后退。**

## `AutoConfigurationImportSelector` 实际上做了哪些事？

不用把源码每个方法都背下来，面试里抓这 5 步就够了：

1. 判断自动装配开关是否开启
2. 读取注解上的 `exclude` / `excludeName`
3. 加载候选自动配置类名
4. 去重、排除、过滤
5. 导入最终留下的配置类

可以画成：

```mermaid
flowchart TD
 A[@EnableAutoConfiguration] --> B[AutoConfigurationImportSelector]
 B --> C[读取候选配置类]
 C --> D[处理 exclude / excludeName]
 D --> E[按条件注解过滤]
 E --> F[导入最终自动配置类]
 F --> G[@Bean 注册默认组件]
```

重点不是记方法名，而是记住这个节奏：

**先找候选，再做排除，再按条件生效。**

## Starter 和自动配置，不是一回事

这个点很多人会混。

更准确地说：

- starter 更像“依赖打包方案”
- auto-configuration 更像“配置导入机制”

比如你引入一个 starter，通常会同时带来：

1. 相关第三方依赖
2. 对应的自动配置类

所以 starter 解决的是“依赖怎么方便拿到”，自动配置解决的是“拿到以后怎么默认接起来”。

这也是为什么很多题里会说：

> 为什么只引一个 starter，很多 Bean 就自动有了？

答案不是 starter 本身会造 Bean，而是 starter 把自动配置和依赖一起带进来了。

## 为什么自动配置有顺序问题？

有些自动配置之间是有前后依赖的。

比如：

- Web 的某些配置要在基础 Servlet 配置之后
- 你自己的自动配置可能要在某个官方配置之后再补 Bean

新版官方文档里，推荐通过这些方式表达顺序：

- `@AutoConfiguration(before = ...)`
- `@AutoConfiguration(after = ...)`
- `@AutoConfigureBefore`
- `@AutoConfigureAfter`

但这里也要讲清一件事：

**它影响的是配置类导入和 Bean 定义顺序，不直接决定 Bean 最终实例化顺序。**

真正的实例化顺序还是看依赖关系和 `@DependsOn`。

## 线上怎么判断到底哪些自动配置生效了？

这个点非常实用，也很适合在面试里加一句。

Spring Boot 官方文档明确建议：

```bash
--debug
```

打开后会输出 conditions report，也就是条件评估报告。

它能回答两类非常关键的问题：

1. 哪些自动配置生效了
2. 哪些没生效，为什么没生效

如果项目接了 Actuator，也可以看条件评估相关端点。核心思路一样：不要靠猜，要看条件匹配报告。

所以线上或本地排查“为什么这个 starter 没起作用”，最直接的路通常不是瞎猜，而是先看条件评估报告。

## 用一个例子把整个过程串起来

假设你项目里加了：

```xml
spring-boot-starter-data-redis
```

那么大致会发生：

1. Boot 启动时通过 `@EnableAutoConfiguration` 触发自动配置选择
2. 发现 Redis 相关自动配置类是候选项
3. `@ConditionalOnClass` 检查 Redis 相关类是否在类路径上
4. `@ConditionalOnMissingBean` 检查用户有没有自己定义核心 Bean
5. 条件都满足时，注册默认的 Redis 连接工厂、模板等 Bean
6. 如果你自己定义了这些 Bean，自动配置就后退

这就是自动装配最典型的工作方式：

**依赖暴露能力，条件决定是否生效，用户自定义优先于默认值。**

## 一个常见误区：自动装配不是“扫描所有 jar 然后全注册”

更准确地说：

- 它确实会从约定位置发现候选自动配置类
- 但真正注册进容器前，会经历多轮条件过滤
- 而且很多默认 Bean 还会被 `@ConditionalOnMissingBean` 限制

所以它更像“约定式候选导入 + 条件裁剪”，而不是“全量注册”。

## 容易踩的坑

### 把 `@AutoConfigurationPackage` 说成通用组件扫描

这是不严谨的。

通用组件扫描看的是 `@ComponentScan`。
`@AutoConfigurationPackage` 更偏“给某些自动配置提供默认包边界”。

### 把 starter 和自动配置混成一回事

starter 是依赖入口，自动配置是配置生效机制。
二者经常一起出现，但不是同一个概念。

### 把 `spring.factories` 当成永远正确答案

对于旧版 Boot 资料，这么答没问题。
但现在更稳的答法，一定要补一句：

**新版主线已经转到 `AutoConfiguration.imports`。**

### 只看 starter，不看条件报告

引了 starter 只是把依赖和候选自动配置带进来，不代表最终 Bean 一定注册成功。
真正要看的是：候选类有没有被排除，条件有没有匹配，用户自定义 Bean 有没有让默认配置 back off。

## 小结

- Spring Boot 自动装配的主线是：触发 `@EnableAutoConfiguration`，由 `AutoConfigurationImportSelector` 找候选配置类，再按条件筛选后导入。
- 候选自动配置类的发现机制有版本边界：旧资料常见 `spring.factories`，新版主线是 `AutoConfiguration.imports`。
- 条件注解决定了自动配置是不是按需生效，`@ConditionalOnClass` 和 `@ConditionalOnMissingBean` 最常见。
- Boot 的默认配置是 non-invasive 的，用户自己定义 Bean 时，自动配置会 back off；排查时要看条件评估报告。
- starter 负责把依赖和自动配置带进来，真正让默认 Bean 生效的是自动配置机制而不是 starter 本身。

## 参考

基于 Spring Boot Reference Documentation 中 Auto-configuration、Condition annotations、AutoConfiguration.imports、Back-off 与 Conditions Evaluation Report 等相关章节整理。
