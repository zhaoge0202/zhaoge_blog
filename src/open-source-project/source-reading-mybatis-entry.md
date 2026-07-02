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

业务代码通常从这一行开始：

```java
userMapper.selectById(id);
```

Mapper 接口没有手写实现类，但方法可以被正常调用。这个问题比“Executor 有几种实现”更贴近入口：MyBatis 怎么把一个 Java 接口方法翻译成一次 SQL 执行？

推荐先按这条线读：

```text
业务调用 Mapper 方法
  -> MapperProxy 拦截接口方法
  -> MapperMethod 封装方法签名和执行命令
  -> namespace + methodName 定位 MappedStatement
  -> MappedStatement 持有 SQL、参数映射、结果映射、缓存配置
  -> Executor 负责查询/更新调度、事务、一级缓存
  -> StatementHandler 准备 Statement 并执行 SQL
  -> ParameterHandler 设置占位符参数
  -> ResultSetHandler 映射 ResultSet 为 Java 对象
```

这样读不会陷在某个实现类里，而是能回答完整问题：接口调用怎么一步步变成 JDBC 执行。

## `MappedStatement` 为什么是枢纽？

Mapper 代理拦截方法后，真正要找的是 `MappedStatement`。

可以把它理解成 MyBatis 内部的一张“执行说明书”：XML 或注解里的 `<select>`、`<insert>`、`<update>`、`<delete>` 会被解析成 `MappedStatement`，它把 SQL、参数映射、结果映射、缓存配置等信息集中在一起。

定位规则可以这样讲：

```text
Mapper 接口全限定名 -> namespace
Mapper 方法名       -> statement id
namespace + id      -> MappedStatement key
```

所以面试里不要只说“Mapper 通过动态代理实现”。更完整的表达是：代理对象把接口方法调用转成 `MappedStatement` 的执行，`MappedStatement` 再把静态配置、动态 SQL、参数和结果映射带入执行链。

还有一个容易答错的边界：Mapper 方法不要依赖重载来表达不同 SQL。MyBatis 的 statement 定位核心仍是 `namespace + statement id`，而 statement id 通常对应 Mapper 方法名；工程里应该让方法语义和 SQL 映射一一对应，避免靠重载制造歧义。

## Executor 后面还要看什么？

`Executor` 是执行调度中心，但它不是执行链的终点。

它主要连接几件事：

- 查询和更新调度。
- 事务提交和回滚。
- 一级缓存生命周期。
- 执行器类型选择，比如 `SimpleExecutor`、`ReuseExecutor`、`BatchExecutor`。
- 创建并调用更贴近 JDBC 的处理器。

真正靠近数据库动作的，是后面的三类处理器：

| 角色               | 负责什么                     | 排查问题                     |
| ------------------ | ---------------------------- | ---------------------------- |
| `StatementHandler` | 创建、预编译并执行 Statement | SQL 是否被改写、分页是否生效 |
| `ParameterHandler` | 给占位符设置参数             | 参数类型、空值、类型转换     |
| `ResultSetHandler` | 把结果集映射成对象           | 字段映射、嵌套映射、枚举转换 |

插件机制也要放在这条链上讲。MyBatis 插件不是随便拦截任意对象，常见拦截点集中在 `Executor`、`StatementHandler`、`ParameterHandler`、`ResultSetHandler` 这四类接口。分页插件通常会拦截 SQL 执行前的路径，按数据库方言改写 SQL，而不是让 `RowBounds` 自动变成物理分页。

## 缓存和分页怎么顺着源码讲？

**一级缓存**

一级缓存和 `SqlSession` 生命周期强相关。读源码时可以顺着 `Executor` 看查询前后如何命中、写入、清理缓存。项目里如果同一个会话内读到旧值，要回到事务边界、会话复用和清理时机上分析。

**二级缓存**

二级缓存是 namespace 级能力，不应该简单说成“全局缓存”。它会受缓存开关、映射配置、事务提交、对象序列化和跨服务一致性影响。面试里点到边界即可，不要把它说成高并发读场景的默认方案。

**分页**

原生 `RowBounds` 更偏结果集范围控制，不等于数据库层面的物理分页。真实项目里常见物理分页，要么直接写分页 SQL，要么依赖插件在执行前改写 SQL。讲插件时要落到拦截点和 SQL 改写，而不是只背“用了分页插件”。

## 面试里怎么讲成项目能力？

可以用慢 SQL 或分页问题组织表达：

```text
我们项目里某个列表接口页码越大越慢。
我没有只看 Mapper XML，而是顺着 MapperProxy 到 MappedStatement，
确认这个 Mapper 方法最终对应哪条 SQL、动态条件怎么拼出来。
然后继续看 Executor 到 StatementHandler 的执行链，
发现分页插件是在 StatementHandler 前后改写 SQL。
最后把无索引排序字段改掉，并补了分页参数和 SQL 日志校验。
```

这类表达能体现三个能力：知道业务入口、知道框架执行链、知道源码结论怎么落回 SQL 和排障。

## 容易踩的坑

- 不要一上来就说“直接看 Executor”，从业务入口看，Mapper 代理更容易串起全链路。
- 不要说 MyBatis 插件能拦截任何对象，常见拦截范围集中在四类核心接口。
- 不要把 `RowBounds` 等同于物理分页，物理分页通常依赖 SQL 或插件改写。
- 不要把缓存问题只归给 Executor，一级缓存、二级缓存的生命周期和边界不同。
- 不要只背 `SimpleExecutor`、`ReuseExecutor`、`BatchExecutor`，要说明它们影响 Statement 创建、复用和批处理方式。

## 小结

1. MyBatis 阅读入口建议从 Mapper 代理开始，因为它贴近业务调用。
2. `MappedStatement` 是接口方法、SQL、参数映射、结果映射和缓存配置的枢纽。
3. `Executor` 是调度层，后面还要看 `StatementHandler`、`ParameterHandler`、`ResultSetHandler`。
4. 插件和分页要放在执行链里讲，不能泛化成任意拦截或自动物理分页。
5. 面试表达要围绕“接口方法怎么变成 SQL 执行，再如何影响排障和优化”展开。

## 参考

综合 MyBatis 官方 Mapper XML、Java API、插件机制文档和源码执行链整理；重点核对了 `MapperProxy`、`MapperMethod`、`MappedStatement`、`Executor`、插件拦截点、分页和缓存边界。
