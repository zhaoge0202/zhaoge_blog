---
title: "贫血模型和充血模型怎么选？"
description: "从业务复杂度与不变式保护讲清两种模型的取舍，而不是站队。"
breadcrumb: true
article: true
editLink: false
category:
  - "设计基础"
tag:
  - "进阶"
  - "项目实战"
  - "基础"
prev:
  text: "分层架构里 Controller、Service、领域模型怎么划界？"
  link: "/system-design/basis/design-layered-architecture.html"
next:
  text: "秒杀系统怎么设计？"
  link: "/system-design/case/design-case-seckill.html"
---

# 贫血模型和充血模型怎么选？

> 这不是"哪个更先进"的问题，是"谁来保证业务规则不会被绕过"的问题——先看清代价，再决定实体要不要长肉。

## 先看长什么样：贫血模型

贫血模型（Anemic Domain Model）说的是：实体只有字段 + getter/setter，一点业务逻辑都不带，所有判断、校验、状态流转全部写在 Service 里。绝大多数 Spring 项目默认就是这个样子：

```java
@Entity
public class Order {
    private Long id;
    private BigDecimal amount;
    private String status;      // UNPAID / PAID / CANCELLED
    private LocalDateTime payTime;
    // 一堆 getter/setter，省略
}

@Service
public class OrderService {

    public void pay(Long orderId, BigDecimal payAmount) {
        Order order = orderRepository.findById(orderId);
        if (!"UNPAID".equals(order.getStatus())) {
            throw new BizException("订单状态不对，不能支付");
        }
        if (payAmount.compareTo(order.getAmount()) < 0) {
            throw new BizException("支付金额不足");
        }
        order.setStatus("PAID");
        order.setPayTime(LocalDateTime.now());
        orderRepository.save(order);
    }

    public void cancel(Long orderId) {
        Order order = orderRepository.findById(orderId);
        if (!"UNPAID".equals(order.getStatus())) {
            throw new BizException("订单状态不对，不能取消");
        }
        order.setStatus("CANCELLED");
        orderRepository.save(order);
    }
}
```

`Order` 本身就是个数据容器，任何人拿到它都能 `setStatus("PAID")` 一步到位，跳过所有校验。规则能不能生效，完全取决于**每一个改状态的地方是不是都记得手写一遍校验**。

## 换成充血模型什么样

充血模型（Rich Domain Model）把这些判断、状态流转搬进实体自己的方法里，实体不再是纯数据袋，而是带行为的对象：

```java
public class Order {
    private Long id;
    private BigDecimal amount;
    private OrderStatus status;
    private LocalDateTime payTime;

    public void pay(BigDecimal payAmount) {
        if (status != OrderStatus.UNPAID) {
            throw new BizException("订单状态不对，不能支付");
        }
        if (payAmount.compareTo(amount) < 0) {
            throw new BizException("支付金额不足");
        }
        this.status = OrderStatus.PAID;
        this.payTime = LocalDateTime.now();
    }

    public void cancel() {
        if (status != OrderStatus.UNPAID) {
            throw new BizException("订单状态不对，不能取消");
        }
        this.status = OrderStatus.CANCELLED;
    }

    // 只暴露只读 getter，没有 setStatus 这种口子
    public OrderStatus getStatus() { return status; }
}

@Service
public class OrderService {
    public void pay(Long orderId, BigDecimal payAmount) {
        Order order = orderRepository.findById(orderId);
        order.pay(payAmount);          // 规则收在实体内部，Service 只管编排
        orderRepository.save(order);
    }
}
```

关键区别不是"代码写在哪个类里"这么简单的位置问题，而是：充血模型里根本不存在 `setStatus(PAID)` 这个方法，想让订单变成已支付状态，**只能**走 `pay()` 这一条路，规则想绕都绕不开。贫血模型里 `setStatus` 是公开的，今天 `OrderService` 记得校验，明天来了个 `RefundService` 直接 `order.setStatus("CANCELLED")` 忘了判断，规则就悄悄失效了——而且编译器、代码审查都不会提醒你，只有等线上出问题才发现。

这就是"不变式保护"这件事的本质：**贫血模型靠人记住去校验，充血模型靠类型系统和封装让违规操作根本写不出来。**

## 充血模型不是免费的

代价主要在工程摩擦上，不是代码好不好看的问题：

- **ORM 框架天生更喜欢贫血对象。** JPA/Hibernate 需要无参构造函数、需要 setter 来做属性回填，MyBatis 的结果集映射也默认靠 setter。硬要在实体里塞满业务方法，ORM 层面不会报错，但实体职责变得又要管映射、又要管规则，容易越写越乱。
- **实体不该反过来依赖 Service/Repository。** 有些人为了"充血得更彻底"，把 `Repository` 或者别的 Bean 注入到实体里，让实体自己去查库、发消息——这是把领域对象和基础设施焊死了，实体没法脱离 Spring 容器 `new` 出来测试，等于丢了充血模型最大的好处（纯对象、单测零成本）。**正确做法是 Service 把外部数据查好、当参数传进去，实体方法内部只做纯计算和状态判断，不做 IO。**
- **学习成本更高。** 新人接手贫血模型，只要知道"逻辑找 Service"就能上手；充血模型要求团队统一遵守"状态只能通过语义方法改"这个约定，写错一次（比如又留了个 `setStatus` 当后门）保护就名存实亡。

## 什么时候贫血就完全够用

后台管理系统、报表查询、大部分内部 CRUD 接口——这类场景的共同点是：**规则少、变化快、几乎不存在需要跨字段保护的不变量**。加个用户、改个商品标题、查一页订单列表，本质就是"读数据、判断权限、存数据"，Service 里写三行 if 就完事，实体承担规则毫无必要。这种场景下，充血模型不但不会带来好处，反而增加一层没人需要的抽象——为了几行简单校验去维护实体方法、写领域单测，纯属浪费。

## 什么时候该让实体长肉

判断标准很具体：**这个对象有没有复杂的状态机？有没有好几条字段必须一起满足的不变量？** 典型的是订单和库存。

订单的状态流转不是随便跳的：未支付能取消、能支付；已支付能发货、能申请退款；已发货不能再取消；已退款的订单不能再支付。这是一张有方向的状态图，规则天然属于"这个对象自己应该知道的事"，而不是散落在下单、支付、退款、发货四五个 Service 里各写一遍：

```java
public enum OrderStatus { UNPAID, PAID, SHIPPED, CANCELLED, REFUNDED }

public class Order {
    private OrderStatus status;

    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED = Map.of(
            OrderStatus.UNPAID, Set.of(OrderStatus.PAID, OrderStatus.CANCELLED),
            OrderStatus.PAID, Set.of(OrderStatus.SHIPPED, OrderStatus.REFUNDED),
            OrderStatus.SHIPPED, Set.of()
    );

    private void transitionTo(OrderStatus target) {
        if (!ALLOWED.getOrDefault(status, Set.of()).contains(target)) {
            throw new BizException(status + " 不能变成 " + target);
        }
        this.status = target;
    }

    public void pay(BigDecimal payAmount) {
        // 金额校验略
        transitionTo(OrderStatus.PAID);
    }

    public void ship() { transitionTo(OrderStatus.SHIPPED); }
    public void refund() { transitionTo(OrderStatus.REFUNDED); }
}
```

库存扣减是另一个典型不变量场景：**扣减之后库存不能为负**，这条规则如果放在 Service 里，每个调用扣减的地方都得记得先查一遍再判断，并发下还容易漏判；放进实体方法，`deduct(int count)` 内部直接把校验和扣减锁在一起，天然杜绝"忘了判断导致超卖"这种低级错误。这类场景里，充血模型省下来的排错成本，远超过它带来的工程摩擦。

## 别为了 DDD 这两个字硬上

看到"充血模型"容易联想到 DDD 那一整套：聚合根、值对象、领域事件、防腐层。但充血模型本身只是"把规则放进实体方法"这一件事，不需要照搬整套战术设计。如果一个订单模块状态机就三五个状态、没有别的聚合需要一起保护，直接在 `Order` 类里写几个语义方法就够了，没必要再拆值对象、定义聚合边界、引入领域事件——这些概念解决的是更大规模、更多聚合协作时的复杂度问题，用在一个简单模块上只会让代码看起来"很讲究"，实际维护成本不降反升。**该长肉的地方长肉，其余地方保持贫血，两种模型混用在同一个项目里完全正常**，不必非此即彼。

## 一张选型表

| 维度          | 贫血模型                              | 充血模型                                 |
| ------------- | ------------------------------------- | ---------------------------------------- |
| 逻辑位置      | Service                               | Entity 方法                              |
| 不变式保护    | 靠每个调用方记得校验，容易漏          | 方法内部锁死状态迁移，绕不过去           |
| 单测成本      | 要 mock Repository/Service 才能测规则 | 实体是纯对象，`new` 出来直接测           |
| 与 ORM 契合度 | 天然契合 JPA/MyBatis                  | 需要处理无参构造、懒加载这类摩擦         |
| 团队认知成本  | 低，所有人都知道去 Service 找逻辑     | 需要团队守住"只能走语义方法"的约定       |
| 适合场景      | CRUD 为主、规则简单、变化快           | 强状态机、多不变量：订单、库存、账户余额 |

## 容易踩的坑

**半吊子充血。** 实体里既写了 `pay()` 这种语义方法，又留着 `setStatus()` 当后门，两条路都能改状态，保护形同虚设。要做就做彻底：`setStatus` 直接删掉，逼所有调用方走语义方法。

**给实体注入 Repository/Service。** 这是把领域对象焊死在 Spring 容器上，测试要拉起整个上下文才能 `new` 一个 `Order`，充血模型最大的好处（零依赖单测）反而没了。数据该由 Service 查好当参数传进去。

**看见"聚合根""值对象"就想套。** 简单模块别为了显得专业硬上完整 DDD 战术设计，判断标准始终是"这个对象有没有需要保护的不变量"，不是"这套术语听起来高不高级"。

## 小结

- 贫血模型把逻辑全放 Service，实体只是数据容器；充血模型把规则收进实体方法，靠封装而非人的记性来防止违规操作。
- 贫血模型的风险是"规则散落在多处、容易被绕过"；充血模型的代价是"和 ORM、依赖注入有摩擦，团队要守约定"。
- CRUD 为主、规则简单、变化快的模块，贫血模型足够，不必强行充血。
- 状态机复杂、存在多字段联合不变量的模块（订单流转、库存扣减），充血模型能把校验锁死在一处，省下的排错成本远超摩擦成本。
- 不要因为"这是 DDD 最佳实践"就给简单模块叠加聚合根、值对象这些概念，两种模型完全可以在同一个项目里混用。

## 参考

综合项目内分层架构与领域建模相关讨论，结合订单状态流转、库存扣减这类真实场景重新组织；补充了充血模型注入 Repository 导致的耦合问题、半吊子充血这类实践中常见但资料里较少展开的坑点。
