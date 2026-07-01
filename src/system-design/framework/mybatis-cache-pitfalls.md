---
title: "MyBatis 一级缓存和二级缓存为什么容易踩坑？"
description: "从 SqlSession、本地缓存、命名空间缓存和一致性边界讲清 MyBatis 缓存陷阱。"
breadcrumb: true
article: true
editLink: false
category:
  - "框架"
tag:
  - "高频"
  - "项目实战"
  - "排障"
prev:
  text: "Spring Boot 自动装配原理是什么？"
  link: "/system-design/framework/spring-boot-auto-configuration-principles.html"
next:
  text: "MyBatis 插件机制和分页插件怎么工作？"
  link: "/system-design/framework/mybatis-plugin-pagination-mechanism.html"
---

# MyBatis 一级缓存和二级缓存为什么容易踩坑？

> MyBatis 缓存最容易答错的地方，不是“一二级缓存分别是什么”，而是你以为它们能帮你提速，结果真正遇到的是对象被复用、脏数据、跨 namespace 不共享，甚至线上根本不敢开二级缓存。

先看一个很典型的误判：

```java
User user1 = userMapper.selectById(1L);
user1.setName("temp");

User user2 = userMapper.selectById(1L);
```

很多人会本能觉得：

- 第二次查询命中了一级缓存
- 所以只是少查了一次数据库
- 返回结果应该和数据库一致

但在默认配置下，这里的 `user2` 很可能会直接拿到同一个对象引用。
也就是说，你改 `user1`，其实已经把本地缓存里的对象也改了。

这就是为什么 MyBatis 缓存题经常不在“会不会用”，而在“你知不知道它到底缓存了什么、缓存活多久、什么时候会被清掉、哪些场景根本不该信它”。

## 先抓总线：MyBatis 有两层缓存，但作用范围完全不同

MyBatis 官方文档把缓存分成两类：

1. 本地缓存（local cache）
2. 二级缓存（second level cache）

最容易记混的不是名字，而是边界。

可以先压成这张表：

| 层级     | 常见叫法       | 作用范围              | 默认状态                                             |
| -------- | -------------- | --------------------- | ---------------------------------------------------- |
| 一级缓存 | 本地缓存       | `SqlSession` 级别     | 默认开启                                             |
| 二级缓存 | namespace 缓存 | Mapper namespace 级别 | 默认框架能力开启，但要显式声明 `<cache/>` 才真正用上 |

先把一句话立住：

**一级缓存更像 MyBatis 执行期的会话内缓存，二级缓存才更接近大家脑子里“可复用的 Mapper 级缓存”。**

## 一级缓存为什么经常被低估？

因为很多人把它理解成“只是顺手缓存一下同一个查询结果”。

实际上官方文档写得很清楚，本地缓存有两个重要用途：

1. 避免同一 `SqlSession` 内重复查同样的数据
2. 帮助解决循环引用和加速嵌套查询

也就是说，它不只是一个“优化开关”，还是 MyBatis 结果映射过程的一部分。

这也是为什么：

**一级缓存没法被完全关闭。**

你最多只能把它的作用域从 `SESSION` 改成 `STATEMENT`，而不是把它彻底禁掉。

## 一级缓存默认到底缓存多久？

官方文档的答案非常明确：

- 默认 `localCacheScope = SESSION`
- 生命周期跟 `SqlSession` 绑定

而且一级缓存会在这些时机被清空：

- `update`
- `commit`
- `rollback`
- `close`
- 手动 `clearCache()`

所以它的核心边界不是“方法级”，而是：

**同一个 `SqlSession` 还活着，这份本地缓存就还活着。**

## 一级缓存为什么容易踩“对象引用”这个坑？

这是最值得主动讲的一点。

官方文档直接提醒：

- 当 `localCacheScope=SESSION` 时
- MyBatis 返回的是缓存里那个对象的**同一引用**

这意味着：

```java
User user1 = mapper.selectById(1L);
user1.setName("changed");

User user2 = mapper.selectById(1L);
```

此时 `user2` 很可能看到的已经不是数据库值，而是你刚在 Java 内存里改过的那个对象。

所以这类坑的本质不是“缓存过期”，而是：

**同一个 session 内，你拿到的不是数据快照，而是同一份对象引用。**

这也是官方文档为什么明确建议：

**不要随手修改 MyBatis 返回的对象，再在同一 session 里继续依赖它的缓存结果。**

## `localCacheScope=STATEMENT` 能解决什么？

如果你把：

```xml
<setting name="localCacheScope" value="STATEMENT"/>
```

那一级缓存的作用域就会缩到“单条语句执行期间”。

它能缓解的主要是：

- 同一 `SqlSession` 内对象引用被复用太久
- 长 session 场景里本地缓存带来的脏感知问题

但也别想太多，它并不是“更高级缓存策略”，而是：

**拿缓存命中率换更少的副作用。**

如果你的服务层本来就是短 session、短事务，这个设置未必值得改；如果你是复杂批处理、长会话、多次相同查询又会改返回对象，那这个设置就更有意义。

注意，它也不是“彻底关闭一级缓存”。MyBatis 仍然需要本地缓存辅助处理循环引用和嵌套查询，只是缓存不再跨多次 statement 共享。

## 二级缓存到底是什么？

二级缓存比一级缓存更接近大家平时说的“Mapper 缓存”。

官方文档对它的核心描述有两句很关键：

1. 缓存配置和缓存实例绑定在 **SQL Mapper 的 namespace** 上
2. 要启用它，需要在映射文件里显式加：

```xml
<cache/>
```

所以别把它理解成“整个应用一个全局缓存”。
更准确地说，它是：

**同一个 namespace 下语句共享的一份缓存。**

## 为什么很多人以为“开启了二级缓存”，其实根本没开？

因为 MyBatis 这里有两层“开关”概念：

### 第一层：全局能力开关

配置里有：

```xml
<setting name="cacheEnabled" value="true"/>
```

这表示框架层面允许二级缓存能力。

### 第二层：Mapper 级别真正声明缓存

你还得在对应 mapper XML 里显式写：

```xml
<cache/>
```

如果没有这句，单靠 `cacheEnabled=true`，并不会神奇地把所有 mapper 都缓存起来。

这也是很多“我们不是开了缓存吗”的第一层误会。

还有一个提交边界也容易被忽略：二级缓存是事务性的。查询结果不是刚查完就立刻对其他 `SqlSession` 可见，而是在当前 `SqlSession` 正常 `commit` 后才真正进入二级缓存；如果回滚，或者期间执行了需要刷缓存的写操作，就不能按“已经查过所以别人能命中”来理解。

## 二级缓存为什么容易踩 namespace 边界？

因为它不是按表缓存，也不是按 service 缓存，而是按 **mapper namespace**。

这会带来两个常见误判：

### 1. 同一张表，不同 Mapper 之间不自动共享

如果你有：

- `UserMapper`
- `AdminUserMapper`

两个 mapper 都查 `user` 表，但 namespace 不同，那它们的二级缓存默认也不是同一份。

### 2. 更新语句只会按 namespace 刷自己的缓存

官方文档给了默认行为：

```xml
<select ... flushCache="false" useCache="true"/>
<insert ... flushCache="true"/>
<update ... flushCache="true"/>
<delete ... flushCache="true"/>
```

这说明：

- `select` 默认会用二级缓存
- `insert/update/delete` 默认会清缓存

但注意，清的是**当前 namespace 绑定的那份缓存**。

所以如果多套 mapper 指向同一业务数据，而你又没设计好 namespace/cache-ref 边界，就会出现：

**这里更新了，那里对应 namespace 的缓存却没一起失效。**

这才是二级缓存在线上最真实的风险之一。

这也解释了一个排障细节：同一个 namespace 内的写操作默认会刷本地缓存和二级缓存，但跨 namespace 的写操作不会自动帮你推断“其实改的是同一张业务表”。

## `cache-ref` 是干什么的？

官方文档专门提供了：

```xml
<cache-ref namespace="xxx"/>
```

它的作用就是：

**让当前 namespace 复用另一个 namespace 的缓存配置和缓存实例。**

这个东西能解决一部分“多个 mapper 其实操作同一份数据”的缓存割裂问题。

但工程上也别太乐观，因为一旦你开始跨 namespace 共享缓存，缓存失效和语义边界也会更复杂。

## `readOnly` 为什么也会影响缓存安全？

二级缓存还有一个很容易被忽略的配置：`readOnly`。

如果缓存是默认的读写模式，MyBatis 会尽量返回对象副本，安全性更好，但成本更高，通常要求结果对象能被序列化。

如果你把 `readOnly=true` 打开，缓存会把同一个对象实例返回给不同调用方，性能更好，但前提是调用方绝对不能修改返回对象。否则多个线程或多个调用方之间可能互相污染。

所以二级缓存的风险不只是“会不会过期”，还包括：

- 返回对象是不是能被修改
- 是否依赖序列化复制
- 多线程下是否共享同一实例
- 缓存大小、淘汰策略、刷新间隔是否符合业务访问模型

这也是为什么“开二级缓存提速”不能只看命中率，还要看对象模型和并发访问方式。

## 二级缓存为什么在线上常被禁用？

很多人第一次学 MyBatis，会把二级缓存理解成“免费提速”。
但真实项目里，很多团队根本不开，原因通常不是不会配，而是不敢信它的一致性边界。

原因主要有 4 类：

### 1. 缓存粒度太粗

二级缓存按 namespace 管，不是按业务读模型管。
复杂系统里，同一份数据可能被很多查询形态复用，命中和失效都不好推理。

### 2. 更新来源不只 MyBatis 一个口子

如果数据还会被这些路径改：

- 其他服务
- 定时任务
- 直接 SQL
- 管理后台

那 MyBatis namespace 缓存很容易就变成局部真相。

### 3. 分布式环境下更麻烦

如果你是多实例部署，默认二级缓存不是天然分布式一致的。
除非你自己接了合适的缓存实现并解决同步问题，不然很容易出现实例 A 刷了、本地 B 还旧着。

### 4. 收益往往不如你想的大

很多现代 Java 项目：

- 已经有 Redis
- 已经有查询结果缓存层
- 服务层事务和 session 生命周期很短

这时 MyBatis 二级缓存带来的额外复杂度，常常大于收益。

所以更现实的判断往往是：

**一级缓存是框架执行期能力，二级缓存是一个要谨慎评估的一致性设计选择。**

## 一个最容易踩坑的组合：长 session + 改返回对象

这是一级缓存里最隐蔽、也最不容易第一眼想到的问题。

比如在一个长生命周期 `SqlSession` 里：

```java
List<User> list1 = mapper.listActiveUsers();
list1.get(0).setStatus("TEMP");

List<User> list2 = mapper.listActiveUsers();
```

此时你以为第二次只是命中缓存少查一次库，实际上你可能已经把缓存里的对象给改脏了。

所以如果项目里还有这种长 session、批处理、手工 session 管理逻辑，排查“为什么查出来的数据莫名其妙变了”，一定要想到一级缓存对象复用这个方向。

## 一个更稳的排障顺序

如果线上怀疑 MyBatis 缓存有坑，我建议按这个顺序收敛：

```text
1. 这是一级缓存问题，还是二级缓存问题？
2. 当前 SqlSession 生命周期有多长？
3. 返回对象有没有在 Java 内存里被改过？
4. namespace 是否和更新语句对齐？
5. 是否有 cache-ref 或多 mapper 共享同一业务数据？
6. 当前事务是否已经提交，还是还停在当前 SqlSession 里？
7. `readOnly`、序列化、缓存大小和淘汰策略是否符合预期？
8. 数据是否还会被系统外部路径修改？
9. 多实例下缓存实现是否真的一致？
```

很多时候走到第 3 步或第 4 步，问题就已经暴露了。

## 工程上更稳的用法

如果你问“那 MyBatis 缓存到底怎么用才稳”，我的建议会比较保守：

### 1. 一级缓存默认接受，但别长时间持有 session

短 session、短事务是最自然的使用方式，别把 `SqlSession` 当长生命周期对象养着。

### 2. 不要修改 MyBatis 直接返回的对象后，又继续依赖同 session 查询结果

这是一级缓存最容易被忽略的坑。

### 3. 二级缓存先问一致性，再问命中率

如果数据变更路径复杂、实例多、mapper 多，先别急着开。

### 4. 真要开二级缓存，先把 namespace 边界梳理清楚

否则你以为开的只是缓存，实际上埋进去的是数据一致性炸点。

## 容易踩的坑

### “一级缓存就是一次请求内重复查少查几次库”

这句话太浅了。
它还意味着：

**同一 session 内返回的可能是同一个对象引用。**

### “二级缓存是全局缓存”

不对。
默认它是 **namespace 级** 缓存。

### “开了 `cacheEnabled=true` 就已经用了二级缓存”

也不对。
还得有 mapper 里的 `<cache/>` 或相关缓存配置。

### “二级缓存命中后对象就一定安全”

也不稳。
如果是 `readOnly=true`，不同调用方可能拿到同一个缓存对象实例，修改返回对象会带来共享污染。

## 小结

- MyBatis 一级缓存是 `SqlSession` 级别的本地缓存，默认开启，清空时机和 session 生命周期强相关。
- 一级缓存最容易踩的坑，不是命中率，而是同一 session 内对象引用复用导致的脏感知。
- 二级缓存是 namespace 级且事务性的，真正启用通常还需要 mapper 显式声明 `<cache/>`。
- `select`、`update`、`insert`、`delete` 默认对缓存的 `useCache/flushCache` 行为不同，失效边界要按 namespace 理解。
- 二级缓存在线上是否值得开，核心不是“能不能提速”，而是一致性边界、对象共享、更新路径和分布式同步成本。

## 参考

基于 MyBatis 官方文档中 Mapper、Configuration、Plugins、Caching、Dynamic SQL 与 RowBounds 等相关章节整理。
