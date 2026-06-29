---
title: "Spring 事务为什么会失效？"
description: "从代理边界、回滚规则和传播行为讲清 @Transactional 失效根因。"
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
  text: "AOP 动态代理是怎么织入的？"
  link: "/system-design/framework/spring-aop-proxy-weaving.html"
next:
  text: "Spring MVC 请求处理流程是怎样的？"
  link: "/system-design/framework/spring-mvc-request-processing.html"
---

# Spring 事务为什么会失效？

> 大多数“事务失效”问题，根子都不在数据库，而在调用路径没经过代理、异常没有触发回滚规则，或者你以为自己开了新事务，实际上只是参与了旧事务。

先看一个最常见的误判：

```java
@Service
public class OrderService {

 public void createOrder() {
 saveOrder();
 }

 @Transactional
 public void saveOrder() {
 // insert ...
 throw new RuntimeException("boom");
 }
}
```

很多人第一反应是：

- `saveOrder()` 标了 `@Transactional`
- 里面抛了异常
- 那肯定会回滚

但这个例子里，事务大概率并不会按你想的方式生效。
因为真正决定事务是否生效的，不是注解写没写，而是：

1. 这次调用有没有经过 Spring 代理
2. 代理有没有能力拦到这个方法
3. 异常有没有触发默认回滚规则
4. 当前传播行为是不是你以为的那个事务边界

## 先抓总线：`@Transactional` 本质上还是 AOP

这篇的底层逻辑，和上一篇 AOP 文章是一条线。

`@Transactional` 本身只是元数据。真正起作用的是 Spring 在运行时做的事务增强，大致流程是：

1. Spring 为目标 Bean 创建代理
2. 外部调用进入代理
3. `TransactionInterceptor` 在方法前开启事务
4. 目标方法执行
5. 根据结果或异常决定提交还是回滚

可以先压成这条线：

```text
client
 -> proxy
 -> TransactionInterceptor
 -> target method
 -> commit / rollback
```

所以判断“事务为什么没生效”，第一步永远不是去看 SQL，而是先问：

**这次调用到底有没有经过事务代理？**

## 第一类失效：调用根本没经过代理

这是最常见、也最本质的一类。

### 1. 自调用

还是上面这个例子：

```java
public void createOrder() {
 saveOrder();
}
```

`createOrder()` 在同一个类里直接调 `saveOrder()`，本质上走的是：

```text
this.saveOrder()
```

而不是：

```text
proxy.saveOrder()
```

Spring 官方文档对这点说得非常明确：

- 默认是 `proxy` 模式
- 只有**通过代理进来的外部调用**才会被拦截
- self-invocation 不会触发事务

所以这类事务失效，不是注解不识别，而是**调用路径绕过了代理**。

### 2. 初始化阶段调用

还有一个很容易忽略的坑：在 `@PostConstruct` 里调事务方法。

官方文档也专门提醒过：

- 代理对象必须先完整初始化
- 不要指望初始化代码阶段就具备完整事务语义

也就是说，这种写法不稳：

```java
@PostConstruct
public void init() {
 syncData(); // 即使 syncData 上有 @Transactional，也别指望这里一定生效
}
```

原因还是一样：**此时代理链和 Bean 发布时机未必已经完全到位。**

### 3. 解决方式

更稳的做法通常是：

1. 把事务方法拆到另一个 Bean
2. 由外部去调用这个 Bean
3. 或者在更合适的生命周期点再调

如果只是为了硬让 self-invocation 生效，当然还能走：

- self injection
- `AopContext.currentProxy()`
- AspectJ 模式

但这些都不是首选。

## 第二类失效：代理拦不住这个方法

这类问题的核心，不是“注解没生效”，而是**代理能力边界**。

### 1. 方法可见性不符合代理语义

这条在旧资料里经常被说成“只有 public 方法事务才生效”。
这句话现在已经不够精确。

Spring 官方文档的更准确表述是：

- 在 proxy mode 下，事务方法通常还是建议用 `public`
- 从 Spring 6.0 开始，对 **class-based proxy**，`protected` 或包可见方法也能支持
- 但 **interface-based proxy** 里的事务方法仍然必须是 `public` 且定义在代理接口上

所以更稳的工程建议不是背版本细节，而是：

**事务方法默认写成 `public`，别拿可见性边界做团队约定。**

### 2. `final` / `private` 这类方法边界

如果你走的是 class-based proxy（比如 CGLIB），它本质上是靠子类重写来增强。

那就天然会有这些限制：

- `final` 方法不能被重写
- `private` 方法也不在可重写范围里

所以很多“我明明标了 `@Transactional` 但没进事务”的例子，本质上不是事务逻辑错了，而是代理根本挂不上去。

### 3. 注解标在接口上

官方文档还专门提醒：

- 推荐把 `@Transactional` 标在**具体类的方法上**
- 不要依赖接口上的事务注解

原因是：

- 在某些代理/织入模式下，接口上的注解并不总是能按你预期被识别
- 尤其切到 AspectJ 模式时，接口注解更容易被忽略

这类问题最危险的地方在于：
代码看起来能跑，但你不测回滚场景，就很可能一直没发现它没真正生效。

## 第三类失效：这个对象根本不是 Spring 管的

这类问题在项目里也很多见。

比如：

- 你自己 `new` 了一个 Service
- 某个工具类静态持有了一个对象
- Bean 根本没被扫描进容器

此时即使方法上写了 `@Transactional`，也只是写在一个普通对象上。
Spring 没接管它，就没有代理，也谈不上事务增强。

这类问题排查时，先别急着看数据库，先确认：

1. 这个类是不是 Bean
2. 这个调用方拿到的是不是 Spring 容器里的那个实例

## 第四类失效：异常发生了，但没有触发回滚规则

这是第二大类高频坑。

### 1. 默认只回滚运行时异常和 Error

Spring 官方文档明确写了默认行为：

- `RuntimeException` 回滚
- `Error` 回滚
- **checked exception 默认不回滚**

所以像这种代码：

```java
@Transactional
public void save() throws Exception {
 // ...
 throw new Exception("checked");
}
```

默认并不会帮你回滚。

很多人觉得“抛异常了怎么会不回滚”，这是把“Java 异常”和“Spring 默认事务回滚规则”混成一回事了。

### 2. 正确做法：显式写 `rollbackFor`

如果你确实希望受检异常也回滚，更稳的写法是：

```java
@Transactional(rollbackFor = Exception.class)
```

而且 Spring 官方文档还额外提醒了一点：

- 类型式规则更稳
- 模式字符串式规则要小心误匹配

所以常规项目里，优先用异常类型，不要图省事写一个模糊字符串模式。

### 3. 异常被你自己吃掉了

这也是很常见的误用：

```java
@Transactional
public void save() {
 try {
 // ...
 throw new RuntimeException("boom");
 } catch (Exception e) {
 log.error("error", e);
 }
}
```

这里代理看到的结果是什么？

**方法正常返回。**

那事务拦截器自然会按“正常结束”去提交，而不是回滚。

所以如果你要自己捕获异常，又想回滚，要么：

1. 继续往外抛
2. 要么显式 `setRollbackOnly()`

但第二种会让代码耦合 Spring 事务基础设施，一般不作为默认写法。

## 第五类失效：传播行为和你理解的不一样

很多事务问题，表面看是“没回滚”，本质上其实是**传播行为造成的边界错觉**。

### 1. `REQUIRED` 不是“各回各的”

`REQUIRED` 是默认传播行为。

它的语义是：

- 有事务就加入现有事务
- 没事务就开新事务

也就是说，调用链里多个 `REQUIRED` 方法，通常共享的是**同一个物理事务**。

这就会带来一个高频误区：

> 我以为 inner 方法失败只影响 inner，outer 还能继续提交。

很多时候并不是。

Spring 官方文档明确提到：

- 内层逻辑事务作用域可以标记 rollback-only
- 外层提交时如果还想提交，会得到 `UnexpectedRollbackException`

这不是 Spring 出 bug，而是 Spring 明确在告诉你：

**外层以为自己能提交，但内层其实已经把整个物理事务判死了。**

### 2. `REQUIRES_NEW` 也不是银弹

很多人一遇到事务边界问题就想上 `REQUIRES_NEW`。

它的语义是：

- 永远开独立物理事务
- 外层事务和内层事务彼此隔离

这确实能解决一部分“审计日志必须单独提交”的问题。
但 Spring 官方文档也明确提醒了另一个风险：

- 它会额外占一个连接
- 外层事务的连接还绑着
- 并发高时可能把连接池顶爆，甚至卡出死锁

所以 `REQUIRES_NEW` 不是“更强的事务”，而是“更贵的事务边界”。

### 3. `NESTED` 也不是所有库都一样

`NESTED` 依赖 savepoint 语义，Spring 官方文档直接点名：

- 它通常映射到 JDBC savepoint
- 更适合 JDBC 资源事务

所以如果有人把 `NESTED` 当成“全场景都可用的小事务”，这个理解也不稳。

## 第六类失效：事务管理器或上下文压根不对

这个坑在多数据源、Web 分层里更容易出。

### 1. 多事务管理器没选对

Spring 官方文档支持在 `@Transactional` 里显式指定事务管理器：

```java
@Transactional("order")
public void createOrder() {}
```

如果你项目里有多个 `TransactionManager`，结果默认拿错了，表现出来也会像“事务没生效”。

### 2. 注解驱动只扫到了错误的上下文

官方文档还有一个容易忽略的点：

- `@EnableTransactionManagement`
- `<tx:annotation-driven/>`

只会处理**同一个 application context 里**的 Bean。

所以如果你把事务注解驱动配置放在了只服务 MVC controller 的那个上下文里，而 Service Bean 并不在里面，事务增强也可能根本没挂上。

## 一张排障顺序图

如果线上真遇到“事务失效”，我建议按这个顺序收敛：

```text
1. 这次调用有没有经过代理？
2. 代理能不能拦住这个方法？
3. 这个对象是不是 Spring Bean？
4. 异常类型有没有触发回滚？
5. 异常是不是被自己吞了？
6. 传播行为是不是和预期一致？
7. 事务管理器 / 上下文是不是配错了？
```

很多时候走到第 2 步或第 4 步，问题就已经定位了。

## 一个更稳的工程习惯

与其事后排障，不如一开始就少踩坑。

更稳的事务写法通常是：

1. `@Transactional` 放在具体类的 `public` 方法上
2. 事务边界定义在 Service 层，不往 Controller 和 DAO 两头扩散
3. 不在同类内部自调用事务方法
4. 需要回滚 checked exception 时显式写 `rollbackFor`
5. 审计、补偿、消息发送这类“必须独立提交”的逻辑，先明确边界再决定是否用 `REQUIRES_NEW`

## 容易踩的坑

### “抛异常了就一定回滚”是错的

正确说法是：

**默认只对运行时异常和 Error 回滚。**

### “写了 `@Transactional` 就一定有事务”也是错的

真正起作用的是：

**代理是否创建成功，以及这次调用是否经过代理。**

### “事务失效”不全是一个问题

它通常至少分成三类：

- 没进代理
- 进了代理但回滚规则没命中
- 事务边界和传播行为理解错了

把这三类分开，排障速度会快很多。

## 小结

- `@Transactional` 本质上还是 AOP 代理，没经过代理的调用不会有事务语义。
- 自调用、初始化阶段调用、非 Spring 管理对象，是最常见的“根本没进事务代理”场景。
- 默认只对 `RuntimeException` 和 `Error` 回滚，checked exception 需要显式 `rollbackFor`。
- `REQUIRED`、`REQUIRES_NEW`、`NESTED` 对应的是不同事务边界，理解错传播行为也会被误判成事务失效。
- 事务问题排查优先看调用路径、代理边界、异常规则，再看数据库层。

## 参考

综合自 Spring 事务专题与 Spring 核心问题整理，并结合 Spring Framework 官方文档对 `@Transactional` 代理模式、自调用限制、方法可见性、默认回滚规则、多事务管理器和传播行为的说明，重写了常见失效场景与排障顺序。
