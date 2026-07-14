---
title: "SOLID 五原则在后端项目里怎么落地？"
description: "用 Java 后端反例和改法讲清 SOLID，避免教条式背诵。"
breadcrumb: true
article: true
editLink: false
category:
  - "设计基础"
tag:
  - "必会"
  - "基础"
  - "项目实战"
prev:
  text: "设计基础"
  link: "/system-design/basis/"
next:
  text: "后端常用设计模式怎么选？策略、模板、责任链怎么用？"
  link: "/system-design/basis/design-common-patterns.html"
---

面试问 SOLID，十个人有九个会背"单一职责就是一个类只做一件事"，然后被追问"你项目里哪个类违反了、怎么改的"就卡住了。

背定义没用，SOLID 本质是**面向变化的取舍规则**：软件迭代时，哪些代码该稳如磐石，哪些代码该容易替换。这篇不讲概念，直接上后端项目里天天能遇到的反例和改法。

## 一句话地图

| 原则       | 一句话                       | 违反的典型信号                                      |
| ---------- | ---------------------------- | --------------------------------------------------- |
| S 单一职责 | 一个类只因一类原因改变       | 类名叫 XxxService 但方法数超过 20 个                |
| O 开闭     | 加新分支不改老代码           | 到处 `if (type.equals("xxx"))`                      |
| L 里氏替换 | 子类不能让父类的调用方"意外" | 子类重写方法却抛 `UnsupportedOperationException`    |
| I 接口隔离 | 不强迫实现用不到的方法       | 实现类里一堆 `throw new RuntimeException("不支持")` |
| D 依赖倒置 | 高层依赖抽象，不依赖实现细节 | Service 里直接依赖 Mapper 的动态 SQL API            |

## S：单一职责原则（SRP）

### 反例：God Service

电商下单场景，很多项目的 `OrderService` 最后会长成这样：

```java
@Service
public class OrderService {
    @Autowired private ProductMapper productMapper;
    @Autowired private OrderMapper orderMapper;
    @Autowired private SmsClient smsClient;
    @Autowired private PointsMapper pointsMapper;
    @Autowired private PayClient payClient;

    @Transactional
    public void createOrder(OrderRequest req) {
        Product product = productMapper.selectById(req.getProductId());
        if (product.getStock() < req.getCount()) {
            throw new BizException("库存不足");
        }
        productMapper.deductStock(req.getProductId(), req.getCount());   // 扣库存
        Order order = new Order(req);
        orderMapper.insert(order);                                       // 建单
        payClient.pay(order.getId(), order.getAmount());                 // 支付
        smsClient.send(req.getPhone(), "订单创建成功");                    // 通知
        pointsMapper.addPoints(req.getUserId(), (int) (order.getAmount() / 10)); // 积分
    }
}
```

问题在于**改变的原因太多**：积分规则要改、短信文案要改、支付要接新渠道——每个需求都要改这一个类，改积分逻辑手滑动了短信那段是常事，而且几乎没法单测。

### 改法：按"变化轴"拆分，用事件解耦非核心链路

```java
@Service
public class OrderService {
    @Autowired private InventoryService inventoryService;
    @Autowired private OrderRepository orderRepository;
    @Autowired private PaymentGateway paymentGateway;
    @Autowired private ApplicationEventPublisher eventPublisher;

    @Transactional
    public Long createOrder(OrderRequest req) {
        inventoryService.deduct(req.getProductId(), req.getCount());
        Order order = orderRepository.save(Order.of(req));
        paymentGateway.pay(order.getId(), order.getAmount());
        eventPublisher.publishEvent(new OrderCreatedEvent(order)); // 通知、积分不是下单核心职责
        return order.getId();
    }
}

// 短信、积分各自订阅事件，各自迭代，互不牵连
@Component
public class OrderNotificationListener {
    @Async @EventListener
    public void onOrderCreated(OrderCreatedEvent e) {
        smsClient.send(e.getOrder().getPhone(), "订单创建成功");
    }
}
```

`OrderService` 只留下库存、落库、支付这条强一致链路，短信和积分是"下单之后顺带发生的事"。判断标准是"这几段逻辑会不会因为不同需求方、不同迭代节奏而独立变化"，不是拆得越碎越好——库存和支付几乎总是一起变，拆开反而增加认知负担。

## O：开闭原则（OCP）

### 反例：if-else 堆出来的支付渠道

```java
public class PaymentService {
    public void pay(String type, BigDecimal amount) {
        if ("ALIPAY".equals(type)) {
            // 支付宝逻辑 30 行
        } else if ("WECHAT".equals(type)) {
            // 微信逻辑 30 行
        } else if ("UNIONPAY".equals(type)) {
            // 银联逻辑 30 行
        } else {
            throw new BizException("不支持的支付方式");
        }
    }
}
```

每接一个新渠道就插一段 `else if`，方法很快膨胀到几百行，复制粘贴改错变量名这种事天天发生。对"扩展"不开放，对"修改"也不封闭。

### 改法：策略模式 + Spring 自动装配

```java
public interface PaymentStrategy {
    String getType();
    void pay(BigDecimal amount);
}

@Component
public class AlipayStrategy implements PaymentStrategy {
    public String getType() { return "ALIPAY"; }
    public void pay(BigDecimal amount) { /* 支付宝逻辑 */ }
}

@Service
public class PaymentService {
    private final Map<String, PaymentStrategy> strategies;

    // Spring 把所有 PaymentStrategy 实现类注入进来，按 getType() 建 map
    public PaymentService(List<PaymentStrategy> list) {
        this.strategies = list.stream().collect(Collectors.toMap(PaymentStrategy::getType, s -> s));
    }

    public void pay(String type, BigDecimal amount) {
        PaymentStrategy strategy = strategies.get(type);
        if (strategy == null) throw new BizException("不支持的支付方式：" + type);
        strategy.pay(amount);
    }
}
```

新增"数字人民币"支付渠道，只要新写一个 `@Component` 实现 `PaymentStrategy`，`PaymentService` 一行不用改。

**但别迷信策略模式**：如果这系统这辈子就俩支付方式且不会再接新渠道，为了"开闭原则"硬造接口和工厂纯属过度设计。该用在**能预判会持续增长的分支点**上，不是所有 if-else 都要连根拔起。

## L：里氏替换原则（LSP）

### 反例：子类破坏父类的契约

最常见的翻车场景：为了图省事继承一个类，重写方法时改变了语义。

```java
public class Account {
    protected BigDecimal balance;

    public void withdraw(BigDecimal amount) {
        if (balance.compareTo(amount) < 0) throw new BizException("余额不足");
        balance = balance.subtract(amount);
    }
}

// 定期存款账户：约定未到期不能取款
public class FixedDepositAccount extends Account {
    private LocalDate maturityDate;

    @Override
    public void withdraw(BigDecimal amount) {
        if (LocalDate.now().isBefore(maturityDate)) {
            // 父类调用方完全没预期过的异常类型
            throw new UnsupportedOperationException("未到期，不能取款");
        }
        super.withdraw(amount);
    }
}
```

调用方原来只处理"余额不足"，传入 `FixedDepositAccount` 却抛出一个完全不同语义的运行时异常，毫无防备，线上直接报 500。这是里氏替换违反：**子类替换父类后，行为出现了父类契约之外的意外**。经典的"正方形继承矩形"是同一道理——子类看似是父类的特殊情况，实际上悄悄改变了方法的前置/后置条件。

### 改法：拆分契约，不硬凑继承

```java
public interface Withdrawable {
    void withdraw(BigDecimal amount);
}

public class Account implements Withdrawable {
    protected BigDecimal balance;
    public void withdraw(BigDecimal amount) { /* 正常取款逻辑 */ }
}

// 定期存款压根不实现 Withdrawable，取款是另一套业务动作
public class FixedDepositAccount {
    private BigDecimal balance;
    private LocalDate maturityDate;

    public void withdrawAtMaturity() {
        if (LocalDate.now().isBefore(maturityDate)) throw new BizException("未到期");
        // ...
    }
}
```

判断能不能继承很简单：**子类必须能在父类出现的任何地方无缝顶替，且不需要调用方额外判断类型**。子类重写方法若"什么都不做"、"抛父类没有的异常"、"缩小了参数范围"，说明这根本不是 is-a 关系，该用组合或拆成平级类。

## I：接口隔离原则（ISP）

### 反例：胖接口逼所有实现类陪跑

```java
public interface UserService {
    User getById(Long id);
    void create(User user);
    void update(User user);
    void exportToExcel(List<Long> ids);   // 只有后台管理端要用
    void syncToLdap(User user);           // 只有企业版要用
}
```

小公司项目起步图快，把跟"用户"沾边的操作都塞进一个接口。移动端 App 的 `UserServiceImpl` 也被迫 `@Override` `exportToExcel`、`syncToLdap`：

```java
@Override
public void exportToExcel(List<Long> ids) {
    throw new UnsupportedOperationException("移动端不支持该操作");
}
```

接口的调用方（比如某个通用权限校验切面扫描所有 `UserService` 方法做统一鉴权）根本不知道这是个假方法，等真调用到才炸。接口一改，所有不相关的实现类都要跟着重新编译、重新回归。

### 改法：按调用方拆小接口

```java
public interface UserQueryService {
    User getById(Long id);
}

public interface UserCommandService {
    void create(User user);
    void update(User user);
}

public interface UserExportService {
    void exportToExcel(List<Long> ids);
}

public interface UserLdapSyncService {
    void syncToLdap(User user);
}
```

`UserServiceImpl` 想实现全部就 `implements` 全部，移动端场景只依赖前两个，压根不知道 `exportToExcel` 这回事。接口粒度按"谁在用它"划分，而不是按"名字都带 User 前缀"划分——这是 ISP 和 SRP 的核心区别：**SRP 约束类的实现内聚，ISP 约束接口的调用方视角**，一个从内部看，一个从外部看。

## D：依赖倒置原则（DIP）

### 反例：Service 依赖 MyBatis 的实现细节

```java
@Service
public class OrderService {
    @Autowired private OrderMapper orderMapper; // MyBatis 生成的 Mapper

    public List<Order> queryRecentOrders(Long userId) {
        // 动态 SQL 拼接逻辑写在 Service 里，还依赖 MyBatis 专属的 Example API
        OrderExample example = new OrderExample();
        example.createCriteria().andUserIdEqualTo(userId)
                .andCreateTimeGreaterThan(LocalDateTime.now().minusDays(30));
        example.setOrderByClause("create_time desc limit 20");
        return orderMapper.selectByExample(example);
    }
}
```

问题不是"用了 MyBatis"，而是**高层业务逻辑（"最近订单"是什么）跟持久层技术细节（Example、Criteria）耦死了**。想把查询换成走 ES 或换成 JPA，Service 层要跟着大改；单测也没法脱离真实数据库或对生成类做复杂 mock。

### 改法：Service 依赖自定义仓储接口，实现细节下沉

```java
// 高层模块定义"需要什么"，不关心"怎么实现"
public interface OrderRepository {
    List<Order> findRecentOrders(Long userId, int days, int limit);
}

// MyBatis 只是这个接口的一种实现，是被倒置依赖的细节，原来那段 Example/Criteria 代码搬进这里
@Repository
public class OrderRepositoryMybatisImpl implements OrderRepository {
    @Autowired private OrderMapper orderMapper;

    @Override
    public List<Order> findRecentOrders(Long userId, int days, int limit) {
        OrderExample example = new OrderExample();
        example.createCriteria().andUserIdEqualTo(userId)
                .andCreateTimeGreaterThan(LocalDateTime.now().minusDays(days));
        example.setOrderByClause("create_time desc limit " + limit);
        return orderMapper.selectByExample(example);
    }
}

@Service
public class OrderService {
    @Autowired private OrderRepository orderRepository; // 只依赖抽象

    public List<Order> queryRecentOrders(Long userId) {
        return orderRepository.findRecentOrders(userId, 30, 20);
    }
}
```

单测 `OrderService` 只要 mock 一个 `OrderRepository` 接口，跟 MyBatis 无关；哪天迁到 ES，只要新写 `OrderRepositoryEsImpl`，Service 层不动。很多人以为依赖倒置就是"面向接口编程"，更准确地说是**谁该定义这个接口**：接口应该长在高层模块（业务）这边，由低层模块去满足它，而不是让业务代码迁就持久层框架生成的 API。

## 原则之间怎么配合

| 场景                                   | 主要靠的原则                  |
| -------------------------------------- | ----------------------------- |
| 一个类改哪个功能都要碰                 | SRP：拆职责                   |
| 加新分支就要改老代码                   | OCP：抽象 + 策略/扩展点       |
| 继承之后调用方开始做 `instanceof` 判断 | LSP：改用组合，或收紧继承层级 |
| 实现类里一堆"不支持"的空实现           | ISP：接口按调用方拆小         |
| Service 层跟某个具体框架 API 焊死      | DIP：面向自定义抽象编程       |

它们不是五条互不相干的规则，而是同一件事从五个角度切入：把"容易变"的部分和"不易变"的部分分开，让容易变的部分可以被替换，而不牵连不易变的部分。

## 跟设计模式是什么关系

设计模式是"术"，SOLID 是"道"。策略模式落的是开闭原则，装饰器和适配器落的是开闭原则加接口隔离，模板方法落的是里氏替换（子类不能破坏父类定义的算法骨架），依赖注入本身就是依赖倒置原则的工程实现。

反过来说，不是每次违反了某条原则就必须祭出对应的设计模式。支付渠道的例子若只有两种方式且长期不变，直接留着 if-else 反而更直观——策略模式引入的接口、工厂、Spring 装配本身也要花认知成本维护。这也是资深工程师和背书应届生的区别：不是"记住了几种模式对应几条原则"，而是看一眼代码就知道现在的复杂度值不值得为将来的变化买单。原则是判断力的落脚点，不是必须无脑套用的模板。

## 面试怎么答

面试官问"讲讲 SOLID"，别从"S 是 Single Responsibility……"开始背。直接说：这五条本质是控制"变化的传播范围"，然后挑一两个项目里真实踩过的坑（比如 God Service 拆分、if-else 支付渠道改策略模式）讲清楚"改之前什么问题、改之后解决了什么、有没有过度设计的顾虑"，比背五条定义有说服力得多。

## 小结

1. SOLID 的核心是**控制变化的传播范围**，不是五条要背的定义。
2. 每个原则都对应一类后端坏味道：God Service、膨胀 if-else、继承破坏契约、胖接口、框架焊死。
3. 模式是手段、原则是方向；只有两种长期不变的实现，硬上策略模式可能过度设计。
4. 依赖倒置的关键是**接口归业务定义**，而不是“到处 new 接口”。
5. 面试优先讲项目取舍，而不是按字母顺序背诵。

## 参考

结合 Java 后端常见工程反例整理；设计模式与 SOLID 的对应关系参考通用 OO 设计实践，未照搬资料定义堆砌。
