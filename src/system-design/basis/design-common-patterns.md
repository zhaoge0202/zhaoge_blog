---
title: "后端常用设计模式怎么选？策略、模板、责任链怎么用？"
description: "从业务场景和边界讲清后端高频设计模式，而不是背类图。"
breadcrumb: true
article: true
editLink: false
category:
  - "设计基础"
tag:
  - "高频"
  - "项目实战"
  - "基础"
prev:
  text: "SOLID 五原则在后端项目里怎么落地？"
  link: "/system-design/basis/design-solid-principles.html"
next:
  text: "RESTful 接口怎么设计才不容易返工？"
  link: "/system-design/basis/design-restful-api.html"
---

> 设计模式不是拿来背类图的，是遇到"这块以后大概率会变"的代码时，脑子里该冒出来的一种隔离手段。3-5 年后端项目里真正高频用到的模式不超过 10 个，这篇只讲这些，不做 23 种模式的扫盲课。

先说个大部分人踩过的坑：背了一遍《设计模式》，能画出所有类图，结果面试官问"你项目里哪里用过策略模式"，答不上来；或者反过来，为了显得"会设计"，一个只有两个分支的 if-else 硬是包出接口、工厂、Spring 装配三层，代码没有变简单反而更难读。

这两种都是没把模式当成解法，而是当成了目标。真正该问的问题永远是：**这段代码的哪一部分，未来最可能被替换或增加？把这部分隔离出来的成本，值不值得？**

带着这个问题看下面几个模式。

## 策略模式：把"选哪种算法/规则"从 if-else 里拎出来

### 场景

支付渠道、优惠券叠加规则、灰度路由算法——这类东西有一个共同特征：**同一个行为，有好几种互斥的实现方式，而且业务方还会不断加新的**。

[SOLID 那篇](./design-solid-principles.html#o-开闭原则-ocp)已经用支付渠道讲过一次策略模式怎么替代 if-else，这里换个场景：**优惠券叠加计算**。

```java
public interface DiscountRule {
    String getType();
    BigDecimal apply(BigDecimal originAmount, Coupon coupon);
}

@Component
public class FullReductionRule implements DiscountRule {
    public String getType() { return "FULL_REDUCTION"; }
    public BigDecimal apply(BigDecimal originAmount, Coupon coupon) {
        return originAmount.compareTo(coupon.getThreshold()) >= 0
                ? originAmount.subtract(coupon.getValue()) : originAmount;
    }
}

@Service
public class DiscountService {
    private final Map<String, DiscountRule> rules;

    // Spring 把所有 DiscountRule 实现类收集进来，按 getType() 建 map
    public DiscountService(List<DiscountRule> ruleList) {
        this.rules = ruleList.stream()
                .collect(Collectors.toMap(DiscountRule::getType, r -> r));
    }

    public BigDecimal calc(BigDecimal amount, Coupon coupon) {
        DiscountRule rule = rules.get(coupon.getType());
        if (rule == null) {
            throw new BizException("不支持的优惠类型：" + coupon.getType());
        }
        return rule.apply(amount, coupon);
    }
}
```

### 结构

一句话：**接口定义"做什么"，多个实现类各自"怎么做"，一个上下文类（这里是 `DiscountService`）负责在运行时选中并调用对应的实现**。选择方式可以是 Spring 的 `Map<String, XxxStrategy>` 自动装配（最常见），也可以是简单工厂返回实例，或者干脆用枚举持有策略引用。

### 边界

策略模式解决的是"分支会持续增长"这件事，不是所有 if-else 都值得改。判断标准很朴实：**这个分支点未来会不会经常加新成员？** 优惠券类型、支付渠道、消息推送渠道这种业务上确定会越来越多的地方值得抽；一个"性别只有男女"这种基本不会变的分支，硬套策略模式纯属增加认知负担。

## 模板方法：流程步骤固定，变化点留给子类填——和回调有什么不同？

### 场景

对账、数据同步、批量导入这类任务，流程骨架几乎每次都长得一样：**拉取数据 → 校验 → 转换 → 落库 → 通知**，但每个环节的具体实现因业务而异（有的从 SFTP 拉文件，有的从第三方 API 拉）。这种"流程固定、步骤可换"的场景就是模板方法的地盘。

```java
public abstract class DataSyncTemplate {

    // 模板方法，final 防止子类打乱流程顺序
    public final SyncResult sync() {
        List<RawRecord> raw = fetch();
        List<RawRecord> valid = validate(raw); // 有默认实现的钩子，子类按需覆盖
        int count = save(transform(valid));
        log.info("同步完成，共 {} 条", count);
        return new SyncResult(count);
    }

    protected abstract List<RawRecord> fetch();
    protected abstract List<Entity> transform(List<RawRecord> raw);
    protected abstract int save(List<Entity> entities);

    protected List<RawRecord> validate(List<RawRecord> raw) {
        return raw.stream().filter(RawRecord::isValid).collect(Collectors.toList());
    }
}

public class SftpOrderSyncTask extends DataSyncTemplate {
    protected List<RawRecord> fetch() { /* 从 SFTP 拉文件解析 */ return null; }
    protected List<Entity> transform(List<RawRecord> raw) { /* 转成订单实体 */ return null; }
    protected int save(List<Entity> entities) { /* 批量插入 */ return 0; }
}
```

`JdbcTemplate`、`RestTemplate`、`TransactionTemplate` 这些 Spring 里以 Template 结尾的类，走的也是这套思路——把"打开连接、处理异常、关闭资源"这种死板但容易出错的流程锁死，把"具体查什么、写什么"这一个点留给你实现。

### 模板方法 vs 回调，到底选哪个？

这是经常被问到的细节题。两者目的很像（复用流程、隔离变化点），实现方式完全不同：

| 维度     | 模板方法                                     | 回调                                                                  |
| -------- | -------------------------------------------- | --------------------------------------------------------------------- |
| 复用手段 | 继承，子类重写抽象方法                       | 组合，把行为作为参数（接口/Lambda）传进去                             |
| 灵活度   | 受限于类的继承层级，一个子类只能定一套变化   | 每次调用都能传不同的行为，同一个类可以复用出无数种组合                |
| 典型代表 | 传统 Template 类、`HttpServlet.doGet/doPost` | `JdbcTemplate.query(sql, rowMapper)`、`Comparator`、Java 8 函数式接口 |

实际上 Spring 自己也在从"继承式模板方法"往"组合式回调"迁移：早期版本很多地方是抽象类 + 子类重写，后来 `JdbcTemplate` 这类核心组件改用 `RowMapper`、`PreparedStatementSetter` 这种回调接口配合模板方法——**流程骨架仍然用模板方法锁住，但变化点用回调传入，而不是逼你继承一个类**。这样一个 `JdbcTemplate` 实例可以复用给成百上千种不同的查询，如果是纯继承式模板方法，你得为每种查询都写一个子类。

写新代码时，如果变化点只有一处、逻辑简单，直接用回调（函数式接口）往往比新建一个抽象类干净；只有当"这套流程本身需要被当成一个可复用、可扩展的类型"时，继承式模板方法才更合适。

## 责任链：Filter、网关过滤器、审批流是怎么串起来的？

### 场景

一个请求要经过好几道独立的处理关卡，每道关卡可以选择"处理完继续往下传"或者"直接拦下来不往下走了"——鉴权、限流、参数校验、日志、审批多级会签，都是这个模型。最典型的落地就是 Servlet 的 `Filter` 链和网关的过滤器链。

```java
public abstract class ApprovalHandler {
    protected ApprovalHandler next;

    public ApprovalHandler setNext(ApprovalHandler next) {
        this.next = next;
        return next;
    }

    public final void handle(LeaveRequest request) {
        if (doHandle(request) && next != null) {
            next.handle(request); // 当前节点放行才传给下一个
        }
    }

    protected abstract boolean doHandle(LeaveRequest request);
}

public class TeamLeaderApproval extends ApprovalHandler {
    protected boolean doHandle(LeaveRequest request) {
        if (request.getDays() > 3) return true; // 超过 3 天需要继续往上审
        request.approveBy("组长");
        return false; // 3 天以内组长审完就结束，不再往下传
    }
}

// 组装链路
ApprovalHandler chain = new TeamLeaderApproval();
chain.setNext(new HrApproval()).setNext(new BossApproval());
chain.handle(leaveRequest);
```

Servlet 的 `FilterChain`、Spring Cloud Gateway 的 `GlobalFilter`、Netty 的 `ChannelPipeline` 本质都是同一个套路：**每个节点只关心自己这一段逻辑，要不要往下传、要不要提前拦截，由节点自己决定，调用方完全不用知道链上有多少节点、顺序是什么**。

### 结构

核心就是每个处理器持有"下一个处理器"的引用，`handle` 方法里做完自己的事之后决定是否调用 `next.handle()`。Spring 里更常见的写法是不手写链表，而是注入一个 `List<XxxFilter>`，按 `@Order` 排序后用 for 循环依次调用——效果等价，实现上更省事。

### 边界

链条一长，出问题时不好定位是哪个节点拦的——排障时最好让每个节点在拒绝时打清晰的日志（拒绝原因 + 节点名），而不是简单 `return false`。另外要想清楚"短路"语义：是一个节点通过才能进下一个（AND 语义，鉴权、限流常见），还是任意一个节点处理了就算完（审批流这种，有些节点会终止链路）。这两种语义如果混用容易出 bug。

## 观察者 / 发布订阅：Spring 事件和 MQ 到底差在哪？

### 场景

"下单成功之后要发短信、加积分、更新统计报表"——这类"一件事发生后，有好几个不相关的模块要跟着反应"的场景，用观察者模式解耦主流程和这些附带逻辑。Spring 事件机制（`ApplicationEvent` + `@EventListener`）就是这个模式在框架层面的现成实现。

```java
public class OrderCreatedEvent extends ApplicationEvent {
    private final Order order;
    public OrderCreatedEvent(Object source, Order order) {
        super(source);
        this.order = order;
    }
    public Order getOrder() { return order; }
}

@Service
public class OrderService {
    @Autowired
    private ApplicationEventPublisher publisher;

    @Transactional
    public Long createOrder(OrderRequest req) {
        Order order = orderRepository.save(Order.of(req));
        publisher.publishEvent(new OrderCreatedEvent(this, order));
        return order.getId();
    }
}

@Component
public class OrderPointsListener {
    // 事务提交之后才触发，避免主流程还没提交、下游就读到脏数据
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onOrderCreated(OrderCreatedEvent e) {
        pointsService.grant(e.getOrder());
    }
}
```

这里有个很容易被面试问到、也很容易踩的坑：如果直接用 `@EventListener` 而不是 `@TransactionalEventListener(AFTER_COMMIT)`，事件监听器可能在 `createOrder` 的事务**还没提交**时就执行了——这时候如果监听器逻辑需要查这笔订单（比如另开一个连接查询），可能查不到，因为事务还没提交、其他连接看不见这行数据。用 `AFTER_COMMIT` 能保证监听器一定在主事务成功提交之后才跑。

### 和 MQ 的差别，别混着说

很多人会把"用了观察者模式"和"用了消息队列"混为一谈，说到底是同一件事的两种实现深度，差别很大：

| 维度     | Spring 事件                          | MQ（RocketMQ/Kafka 等）                    |
| -------- | ------------------------------------ | ------------------------------------------ |
| 进程边界 | 同一个 JVM 进程内                    | 跨进程、跨服务                             |
| 持久化   | 没有，进程重启事件就没了             | 消息落盘，可持久化                         |
| 可靠性   | 发布者挂了，监听者根本收不到通知     | 有确认机制、重试、死信队列                 |
| 耦合程度 | 发布者和监听者仍在同一个部署单元里   | 完全解耦成不同服务，可以独立部署、独立扩容 |
| 适用场景 | 单体应用内部模块解耦（下单后发通知） | 跨服务异步通信、削峰填谷、最终一致性       |

一句话总结：**Spring 事件解决的是"同一个应用内，别让主流程和附带逻辑写在一个方法里"；MQ 解决的是"两个不同的服务之间，怎么可靠地异步通信"**。如果附带逻辑失败了会不会导致数据不一致、丢了要不要紧，是判断该用哪个的关键——不能接受丢失的（比如积分发放要保证最终到账），光靠进程内的 `@Async` 事件是不够的，得配合 MQ 或者本地消息表这类可靠机制。

## 装饰器：不改一行原代码，怎么叠加能力？

### 场景

Java IO 流是装饰器模式的教科书案例：`BufferedInputStream` 包一层 `FileInputStream` 就有了缓冲能力，再包一层 `GZIPInputStream` 就有了解压能力，一路往外包，`InputStream` 本身一行代码没改：

```java
InputStream in = new GZIPInputStream(
        new BufferedInputStream(
                new FileInputStream("data.gz")));
```

业务场景里更常见的例子是**给一个既有能力叠加横切增强**，比如给限流器叠加统计功能：

```java
public interface RateLimiter {
    boolean tryAcquire();
}

public class RedisRateLimiter implements RateLimiter {
    public boolean tryAcquire() { /* 基于 Redis 令牌桶 */ return true; }
}

// 装饰器：跟被装饰对象实现同一个接口，内部持有它，叠加统计能力
public class MetricsRateLimiter implements RateLimiter {
    private final RateLimiter delegate;
    private final MeterRegistry registry;

    public MetricsRateLimiter(RateLimiter delegate, MeterRegistry registry) {
        this.delegate = delegate;
        this.registry = registry;
    }

    public boolean tryAcquire() {
        boolean acquired = delegate.tryAcquire();
        registry.counter("rate_limiter", "result", acquired ? "pass" : "reject").increment();
        return acquired;
    }
}
```

调用方拿到的还是一个 `RateLimiter`，完全不知道背后被套了一层统计逻辑，而且这层还能继续往外叠（比如再包一层熔断降级）。

### 边界：和代理模式很像，但目的不同

装饰器和代理写出来的代码结构几乎一模一样——都是实现同一个接口、内部持有目标对象、方法里调用目标对象的方法。区别在于**意图**：装饰器强调"叠加新功能"，而且通常支持多层嵌套；代理强调"控制访问"（权限校验、延迟加载、远程调用封装），一般不强调多层叠加。Spring AOP 生成的动态代理属于后者，它怎么在运行时给 Bean 套一层代理、织入 advice，[AOP 那篇](/system-design/framework/spring-aop-proxy-weaving.html)已经讲得很细，这里不重复。

## 工厂 / 简单工厂：创建细节该收在哪？

### 场景

对象创建过程本身有点复杂（要判断类型、要读配置、要做初始化），而且这个创建逻辑将来可能会变，就该把"new 这个动作"从业务代码里收走，交给一个专门的工厂。

最常见的落地是配合策略模式，用简单工厂根据类型选出对应的策略实例——前面 `DiscountService` 构造函数里那段 `Collectors.toMap` 其实就是一种简单工厂的写法（只不过是 Spring 帮你把所有实现类收集好，你只需要按 key 取）。手写版本更直观：

```java
public class PaymentStrategyFactory {
    private static final Map<String, PaymentStrategy> STRATEGIES = Map.of(
            "ALIPAY", new AlipayStrategy(),
            "WECHAT", new WechatPayStrategy()
    );

    public static PaymentStrategy get(String type) {
        PaymentStrategy strategy = STRATEGIES.get(type);
        if (strategy == null) {
            throw new BizException("不支持的支付方式：" + type);
        }
        return strategy;
    }
}
```

工厂模式再往上还分工厂方法、抽象工厂，但日常后端项目基本用不到那么细的分类——**记住一句话就够用：凡是"创建这个对象需要判断逻辑，或者创建过程可能变化"的地方，把 `new` 收进一个工厂方法/工厂类里，调用方只管要结果，不管怎么造的**。Spring 的 `BeanFactory`/`ApplicationContext` 本质就是一个超大号的工厂，根据 `BeanDefinition` 决定怎么创建、怎么组装每一个 Bean，只不过它还管生命周期，功能远超"工厂模式"这四个字。

## 一张选型表

| 遇到的场景                                               | 该想到的模式                             |
| -------------------------------------------------------- | ---------------------------------------- |
| 同一个行为有多种互斥实现，还会持续增加                   | 策略模式                                 |
| 一套流程步骤固定，个别步骤因业务而异                     | 模板方法（继承）/ 回调（组合），优先回调 |
| 一个请求要依次经过多个独立、可插拔的处理关卡             | 责任链                                   |
| 一件事发生后，多个不相关模块要联动，且能接受"事件可能丢" | 观察者（进程内用 Spring 事件）           |
| 联动逻辑不能丢、需要跨服务                               | 别硬套观察者，直接上 MQ                  |
| 想在不改原类的前提下叠加一层能力，且可能叠多层           | 装饰器                                   |
| 想在方法调用前后插入权限校验、日志、事务这类横切逻辑     | 代理（多半直接用 Spring AOP，不用手写）  |
| 创建对象要做类型判断或读配置，且创建方式可能变           | 简单工厂                                 |

## 容易踩的坑

**为了用模式而用模式。** 团队里最容易出现的过度设计，往往不是复杂系统，而是简单场景被强行套上策略接口 + 工厂 + Spring 装配三件套。如果一个分支点未来大概率不会再增加分支，直接留 if-else 比强行抽象更省心——上线快、新人接手也快。判断值不值得抽，看的是"变化的可能性"，不是"能不能抽"。

**"单例模式"在 Spring 项目里基本不用自己写。** 很多人一提单例就习惯性去写双重检查锁那套：

```java
public class Singleton {
    private static volatile Singleton instance;
    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

在 Spring 项目里这段代码九成九用不上——Bean 的默认 scope 就是 `singleton`，整个应用只会有一个实例，由容器通过内部的单例注册表统一管理，你只需要 `@Component`/`@Service` 加上去、要用的地方 `@Autowired` 进来就行。真正需要自己手写单例的场景已经很少了（比如脱离 Spring 容器的纯工具类、静态上下文持有者），面试被问"单例模式怎么写"更多是考察对并发安全（`volatile` 防止指令重排、双重检查锁的意义）的理解，不代表项目里真该这么写。

## 小结

- 判断值不值得用某个模式，先问"这段代码的哪一部分未来最可能变"，不是先想"能套哪个模式"。
- 策略模式解决"多种互斥实现、还会持续增加"的分支膨胀；模板方法锁流程骨架、留变化点，能用回调（组合）就别硬继承。
- 责任链把"依次经过多个独立处理关卡"的逻辑拆成互不感知的节点，Filter 链、网关过滤器、审批流都是这个模型。
- 观察者（Spring 事件）解决的是同进程内主流程和附带逻辑解耦，不能替代 MQ——能不能接受"联动逻辑丢失"是选型的分界线。
- 装饰器和代理写法很像，但意图不同：装饰器叠加功能、支持多层嵌套，代理控制访问、常见于 Spring AOP 场景。
- Spring 里单例基本是容器管的事，别自己手写双重检查锁；工厂模式收敛的是创建细节，常和策略模式搭配使用。

## 参考

综合自仓库内 IO 设计模式、Spring 设计模式相关参考材料，并结合项目里策略、模板方法、责任链、观察者、装饰器、工厂的实际落地场景重新组织和改写；补充了模板方法与回调的对比、Spring 事件与 MQ 的边界区分等资料中未展开的部分。
