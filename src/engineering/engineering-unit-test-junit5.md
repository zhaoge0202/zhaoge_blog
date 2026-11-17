---
title: "单元测试怎么写才不是自嗨？JUnit 5 和 Mockito 的边界在哪？"
description: "从测试结构、参数化与断言到 Mock 的边界与反模式，讲清单测在工程里的正确写法。"
breadcrumb: true
article: true
editLink: false
category:
  - "工程与交付"
tag:
  - "项目实战"
  - "细节题"
  - "进阶"
prev:
  text: "Java 项目的测试怎么写才不白写？"
  link: "/engineering/engineering-testing-strategy.html"
next:
  text: "集成测试怎么跑得像线上？Testcontainers 和契约测试怎么摆？"
  link: "/engineering/engineering-integration-test-testcontainers.html"
---

# 单元测试怎么写才不是自嗨？JUnit 5 和 Mockito 的边界在哪？

> 单测的合格线只有三条——快、确定、失败只指向一个原因；Mock 的划线只有一句——只替身你不拥有、且慢或不稳定的外部协作者。上一篇讲钱该花在哪一层，这篇只讲 JUnit 5 和 Mockito 的具体写法、边界与坑。

## 先立标准：好单测只看三条

| 指标     | 口径                                   | 不合格的样子                                   |
| -------- | -------------------------------------- | ---------------------------------------------- |
| 快       | 单类全部用例 < 1s，整套单测 < 1 分钟   | 起 Spring 容器、连 Redis、开头先 `sleep(1000)` |
| 确定     | 换机器、换时区、换执行顺序，结果都一样 | 断言里带 `now()`、`UUID`、`HashMap` 的迭代顺序 |
| 单因失败 | 一个用例只验证一条规则                 | 一个方法压 20 个断言，红了还得二分排查         |

破任何一条，测试就从资产变负债：慢的没人跑，不稳的没人信，多因失败的没人知道该改哪儿。

不值得写单测的也说清：纯 getter、`@Data` 生成的 `equals`、一层透传的 Controller、`@Value` 配置、Mapper 接口本身、真 SQL 的分支。它们的正确性不在 Java 代码里，硬写只能产出 `verify(mapper).selectById(1L)` 这种"断言我调用了它"。一句话标准：**换一种实现还能绿的用例，测的才是行为**。值得写的那张表在 [Java 项目的测试怎么写才不白写](/engineering/engineering-testing-strategy.html) 里，这里不重复。

## JUnit 5 的结构：注解，以及"每个方法一个新实例"

JUnit 5 是平台 + 引擎的组合，日常写的 API 全在 Jupiter（`org.junit.jupiter.api.*`），依赖引 `junit-jupiter` 一个就够；`junit-vintage-engine` 只给遗留的 JUnit 4 用例续命，新项目别引。

| 注解                       | 语义                  | 实践口径                          |
| -------------------------- | --------------------- | --------------------------------- |
| `@Test`                    | 一个测试方法          | 方法名写业务语言，别写 `test1`    |
| `@BeforeEach`/`@AfterEach` | 每个用例前后各一次    | 准备夹具；收尾必须放 `@AfterEach` |
| `@BeforeAll`/`@AfterAll`   | 整个类前后各一次      | 默认必须 `static`，否则启动报错   |
| `@DisplayName`             | 报告里的可读名        | 中文场景名比方法名值钱            |
| `@Nested`                  | 内部类分场景          | 组织"状态 × 行为"矩阵             |
| `@Tag`                     | 打标签，配 `-Dgroups` | 打 `slow`，让快慢分道跑           |
| `@Disabled("原因")`        | 跳过                  | 必须写原因，否则半年后没人敢删    |

最容易出事的语义是默认的 `PER_METHOD`：**每个 `@Test` 都新建一个测试类实例**。成员变量因此天然隔离，`@BeforeAll` 也因此必须 `static`——它比实例先存在。

```java
class CounterTest {
    private int calls;    // 不共享：下一个用例里它还是 0

    @Test void 第一次调用应为1() { assertEquals(1, ++calls); }
    @Test void 第二次调用也应为1() { assertEquals(1, ++calls); }
}
```

要真共享（起一次嵌入式服务、加载大字典），只能用 `static` 字段自己保证线程安全，或标 `@TestInstance(Lifecycle.PER_CLASS)`——后者等于主动打开"用例互相污染"的门，只给昂贵资源用。而 `@Nested` 解决的是可读性，把测试类写成场景句：外层 `class CancelOrderTest` 标 `@DisplayName("订单取消")`，内层分 `@Nested class Shipped`（已发货）与 `Paid`（已支付未发货），报告里拼成"订单取消 → 已发货 → 应拒绝取消"；内部类**不能是 `static`**，外层 `@BeforeEach` 先于内层执行，共用夹具写外层。

## 参数化：把边界条件写成一张表

分支密集的规则一个个写 `@Test` 是浪费，`@ParameterizedTest` 的价值是把"输入 → 期望"变成可审阅的表：

```java
@ParameterizedTest(name = "第 {index} 条：{0} 元分 {1} 份，首份应为 {2}")
@CsvSource({ "100.00, 3, 33.34", "0.01, 3, 0.01", "0.00, 3, 0.00", "1.00, 1, 1.00" })
void 均摊金额的边界(BigDecimal total, int parts, String first) {   // 期望值用 String 保精度
    assertEquals(new BigDecimal(first), allocator.allocate(total, parts).get(0));
}
```

五个数据源各管一段：`@ValueSource` 单参数一组值；`@CsvSource` 是 2~4 个参数的边界表；`@CsvFileSource` 给放不进源码的用例；`@MethodSource` 给要 `new` 或要算的参数（方法须 `static`、返回 `Stream<Arguments>`）；`@EnumSource` 遍历枚举矩阵，可配 `EXCLUDE` 排除不适用项。`@CsvSource` 有三个细节：未加引号的值会被 trim，保留空格写 `'  x  '`；空串用 `emptyValue = ""` 声明；`useHeadersInDisplayName = true`（5.8.2+）能把首行当表头显示。参数靠隐式转换（单参构造 / `parse` / `valueOf`），`BigDecimal`、`LocalDate` 直接能接，转换失败时错误不友好——对象复杂就走 `@MethodSource`。

`@TestFactory` 只在"用例集来自配置、字典、样本文件"时值得用：返回 `Stream<DynamicTest>`，数据加一条、测试就多一条。两个坑：动态测试只有跑起来才知道存在，IDE 里没法点开某条调试；`@BeforeEach` 只对工厂方法跑**一次**，不会为每条动态测试各跑一遍。

## 断言：一个测试只该失败在一个原因上

`assertEquals` 是 fail-fast，压一堆断言时第一个红了，后面的金额、买家、时间根本没被检查：

```java
// 反面：只知道"结果不对"，不知道错在几处
assertEquals("CREATED", order.getStatus());
assertEquals(new BigDecimal("37.50"), order.getAmount());   // 这行可能压根没跑
// 正面：assertAll 全跑完再汇总，一次看到全部差异
assertAll("下单结果",
    () -> assertEquals("CREATED", order.getStatus()),
    () -> assertEquals(0, new BigDecimal("37.50").compareTo(order.getAmount())),
    () -> assertEquals("U100", order.getBuyerId()),
    () -> assertNotNull(order.getCreatedAt()));
```

| 断言            | 正确姿势                                    | 坑                                                                                 |
| --------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `assertEquals`  | `(expected, actual, message)`，顺序别记反   | JUnit 4 旧 API 是 actual 在前；同类型时编译器不报错，失败信息反过来骗你            |
| `assertAll`     | 一个行为内的多个侧面用 `Executable...` 聚合 | 别拿它掩盖"本就该拆成三个用例"                                                     |
| `assertThrows`  | 接住异常对象，再断 `code` 或稳定片段        | 它把**子类**也算通过：断 `IllegalArgumentException` 会放过 `NumberFormatException` |
| 异常消息        | 断错误码、断关键字                          | 断整句中文文案，改一个字就红                                                       |
| `assertTimeout` | 在当前线程跑完再判红                        | `assertTimeoutPreemptively` 另起线程并中断，ThreadLocal（事务、MDC）带不过去       |
| 浮点            | `assertEquals(0.1 + 0.2, 0.3, 1e-9)`        | 第三参叫 **`delta`**；`offset` 是 AssertJ `isCloseTo` 的叫法，同一个概念           |
| `BigDecimal`    | `compareTo == 0`，或统一 scale 再比         | `equals` 连 scale 一起比，`1.0` 与 `1.00` 不等——报表差一分钱的经典来源             |

异常那条要和 [异常怎么设计](/java/basis/java-basis-exception.html) 的口径对齐：抛得越具体，断言就该越具体；要精确到"不能是子类"，用 5.9 才有的 `assertThrowsExactly`。

## 扩展模型：`@ExtendWith` 与 `ParameterResolver`

`@ExtendWith` 挂 `Extension` 实现，能介入生命周期、异常处理、参数解析；最常用的是 `ParameterResolver`——把测试方法要的东西注入进去，比如让扩展解析出一个固定时钟：

```java
@ExtendWith(OverdueClockExtension.class)
class OverdueTest {
    @Test void 账期落在上月应判逾期(Clock clock) { assertTrue(checker.isOverdue(invoice, clock)); }
}
```

内置的够用一半：`@TempDir`（字段或参数都行，用例结束自动删）、`TestInfo`（方法名、标签）、`TestReporter`（往报告写键值对，CI 上排障省事）。`@ExtendWith` 是声明式、类级别、只能写常量；`@RegisterExtension` 是编程式，能读实例字段、能按条件注册。两者都能被自定义注解组合——把 `@Tag("fast")` 和 `@ExtendWith(...)` 一起挂在自研的 `@FastTest` 上，全项目一个注解搞定。`@TempDir` 的两个边界：路径随机器变，别断言绝对路径；它只清自己建的目录，别指到 `target/`。

## Mockito 三件套：`@Mock`、`@Spy`、`@InjectMocks`

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repository;    // 空壳：方法返回 0/null/空集合
    @Mock SmsClient smsClient;
    @InjectMocks OrderService service;   // 按 构造器 → setter → 字段 注入
}
```

| 注解           | 是什么                                   | 用错的样子                                                |
| -------------- | ---------------------------------------- | --------------------------------------------------------- |
| `@Mock`        | 完全空壳，方法返回默认值，不跑真实逻辑   | 当"半个真对象"用，忘打桩直接 NPE，堆栈在很远的地方        |
| `@Spy`         | 包在真对象外，默认调真方法，可选择性打桩 | `when(spy.get())` 会先真调一次，副作用已经发生            |
| `@InjectMocks` | 把替身塞进被测类                         | 构造器有多个、类型对不上时**静默留 null**，报错离现场很远 |

`@Mock` 没生效（忘 `@ExtendWith`、也没 `openMocks`）时字段就是 `null`，报 NPE 而不是"未初始化"；`@Spy` 打桩要用 `doReturn(...).when(spy).method()`；`@InjectMocks` 的静默失败最贵，所以生产代码优先构造器注入，测试里干脆显式 `new OrderService(repository, smsClient)`。

## 打桩、捕参与严格桩

```java
when(repository.findById(1L)).thenReturn(Optional.of(paidOrder("A001")));
when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));       // 回显入参
doThrow(new SmsTimeoutException("超时")).when(smsClient).send(anyString()); // void 只能这么打
```

- **`when` 用于有返回值的方法，`doThrow/doAnswer/doNothing` 用于 void 与 spy**，这是语法分工，不是风格偏好。
- **参数匹配走 `equals()`**：DTO 没重写 `equals` 就匹配不上，用 `argThat` 或 `ArgumentCaptor`；裸值和 matcher 混用直接抛 `InvalidUseOfMatchersException`。
- **`thenAnswer` 比一串 `thenReturn` 更贴近真实现**：返回值依赖入参（自增 ID、回显字段、按 key 取实体）时用它。
- **`verify` 的粒度就是耦合的粒度**：`verify(sms).send(...)` 锁的是"取消必须发通知"，合理；`verify(repository).findById(1L)` 锁的是"实现必须先按 ID 查"，重构一次就红。
- **返回值断言不了的东西用 `ArgumentCaptor`**：`var captor = ArgumentCaptor.forClass(Order.class)` 抓进库的对象，`verify(repository).save(captor.capture())` 之后断言 `captor.getValue().getStatus()`。

### 严格桩：`UnnecessaryStubbingException` 不是噪音

`MockitoExtension` 默认 `Strictness.STRICT_STUBS`：类里任何一条桩没被调用，整类报错；传了没打过桩的参数，报 `PotentialStubbingProblem`。它通常指着三种情况之一：① 注释里的假设被写成了桩，用例压根不走那条分支；② 被测代码改过分支，桩已经过期；③ 你在测一个不存在的行为。处理顺序是**删掉没用的桩 > 改测试让桩真被走到 > `lenient()` 局部放行**（只给 `@BeforeEach` 的公共桩）**> 类级 `@MockitoSettings(strictness = LENIENT)`**（等于关掉这层保护）。口径差异要留意：手工 `MockitoAnnotations.openMocks(this)` 默认是宽的，换种初始化方式就少一层检查——这也是优先用扩展的理由。

## Mock 的边界：只 mock 外部协作者

划线只有一句：**mock 你不拥有、且慢或不稳定的东西；不要 mock 你要验证的行为本身。**

| 该 mock                               | 不该 mock                                | 为什么                                          |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| 第三方 HTTP（短信、支付、物流、地图） | 自己的 Repository / Mapper               | SQL 条件、方言、约束是 bug 高发区，替身等于不验 |
| MQ 发送、对象存储、缓存写             | 值对象、DTO、领域实体                    | 它们没有行为可替，mock 出来只是一堆假数据       |
| 时钟、随机数、ID 生成器               | 被测类自身或它的任何方法                 | 拿假实现测假实现，等于什么都没测                |
| 别的服务 / 内部 RPC 客户端            | `BigDecimal`、集合、`String` 等 JDK 类型 | 没有外部依赖，替身只会让断言偏离真实语义        |

过度 verify 的代价很具体：实现从 `findById` 换成 `findByIdAndTenantId`（多租户改造），行为一点没变，测试红一片。**值得 verify 的是对外副作用**——消息发了几条、审计有没有写、失败重试了几次；**不值得的是内部调用顺序和方法名**，那是实现的自由。

桩数据也要"像真的"，用 object mother 收口：

```java
class Orders {
    static Order paid(String orderNo) {      // 状态、金额、时间都是业务上合法的组合
        return Order.builder().orderNo(orderNo).status(PAID)
            .amount(new BigDecimal("37.50")).buyerId("U100")
            .createdAt(Instant.parse("2026-03-01T02:00:00Z")).build();
    }
}
```

拿 `new Order()`（字段全 null）当桩，被测算金额就 NPE，你分不清是自己的 bug 还是数据太假；工厂方法还能在业务规则变化时只改一处。

## 时间与并发：等事件，不睡时间

领域代码不要直接调 `System.currentTimeMillis()` / `LocalDateTime.now()`，注入 `java.time.Clock`：`Clock.fixed` 冻结瞬间、`Clock.tickMillis` 每次前进、`Clock.offset` 整体平移。测试里 `Clock.fixed(Instant.parse("2026-03-01T02:00:00Z"), ZoneId.of("Asia/Shanghai"))` 就能断言跨时区口径；测"三次重试后超时"用 `tick` 比 `sleep(3000)` 快几个数量级，结果还稳定。别用 `LocalDateTime.now().plusDays(1)` 造数据，跨零点、跨月末、CI 跑在 UTC 都会红。

并发断言的正路是等事件：

```java
CountDownLatch started = new CountDownLatch(1);
executor.submit(() -> { started.countDown(); service.handle(cmd); });
assertTrue(started.await(2, TimeUnit.SECONDS));                            // 等"开始"
await().atMost(Duration.ofSeconds(2)).untilAsserted(() -> assertEquals(PAID, repo.find("A001").getStatus()));
```

`Thread.sleep(2000)` 同时错两次：机器快就白等、机器慢就红，还把"顺序假设"藏起来；Awaitility 失败时会打印最后一次实际值，比 sleep 后裸断言好排查一个数量级。偶发红要**先隔离再修**：`@RepeatedTest(10)` 连跑，或开 `junit.jupiter.execution.parallel.enabled=true` 打乱顺序，能逼出"共享状态"与"时序假设"两类根因；CI 里加重试只是把红刷绿，把定位成本推给下一个人（[CI/CD 流水线怎么设计](/engineering/engineering-cicd-pipeline.html) 是同一个立场）。

## Spring 切片测试：成本对照

| 写法               | 起什么                                          | 适合断言                   | 耗时口径（预热后）            |
| ------------------ | ----------------------------------------------- | -------------------------- | ----------------------------- |
| 纯 JUnit + Mockito | 什么都不起                                      | 分支、计算、异常、协作契约 | < 10ms / 用例                 |
| `@WebMvcTest`      | 只 MVC 层：Controller、参数绑定、JSON、异常处理 | 路由、校验、错误码、字段名 | 2–8s / 类                     |
| `@DataJpaTest`     | 只 JPA 层，默认嵌入式库 + 事务回滚              | 映射、派生查询、约束       | 2–8s / 类                     |
| `@SpringBootTest`  | 整个容器                                        | 事务边界、事件、跨层编排   | 首次 15–25s，之后 1–3s / 用例 |

成本曲线怎么涨的：TestContext 按"配置组合"缓存容器，每多一种 `@MockitoBean`/属性覆盖/切片组合都算一份新配置、重建一个 `ApplicationContext`——切片测试慢往往不是测得多，而是配置分桶太碎。所以 Controller 里只有一行 `return service.x()` 时别切片；接缝上的规则交给 [集成测试怎么跑得像线上](/engineering/engineering-integration-test-testcontainers.html)，mock 掉 Repository 的单测永远绿。（`@MockBean`/`@SpyBean` 自 Boot 3.4 起改用 `@MockitoBean`/`@MockitoSpyBean`。）

## 覆盖率：能看什么，看不出什么

JaCoCo 给三个数：行覆盖（这行执行过没有，用来找死代码）、分支覆盖（`if`/`switch` 每个方向走过没有）、圈复杂度（方法里独立路径数，用来判断哪个方法该拆）。但 100% 覆盖也能是错的，因为它只证明"执行过"——一个用例通篇 `assertDoesNotThrow(() -> calc.discount(100, VIP))`，行覆盖满格、语义覆盖为零。

补这个洞的是**变异测试**（PIT）：把 `>` 改成 `>=`、`+` 改成 `-`、返回值换成 `null`，看测试能不能红；变异分数低说明断言太软，这正是覆盖率看不见的维度。代价是慢（一个模块几分钟到几十分钟），所以只对核心包跑夜间流水线。阈值要克制：挂 `BRANCH 0.6` 是提醒不是 KPI，真挂门禁就必须配 `excludes`——Lombok 生成的 `equals/hashCode`、`record` 自动方法、`String switch` 编译出的两层 `switch` 都会拖低分母；不排除的话，团队第一件事就是给 getter 补测试凑数。

## 反模式清单

| 反模式               | 会怎么咬你                                 | 改法                               |
| -------------------- | ------------------------------------------ | ---------------------------------- |
| 测实现细节           | 换 `findById` → `findByIdAndTenantId` 就红 | 断言结果与对外副作用               |
| 断言日志文本         | 改一条日志、换个语言就红                   | 断可观测事实：库状态、返回值、指标 |
| 测试间共享可变状态   | 单跑绿、全跑红，最后没人敢动这个类         | 每方法新实例 + 每用例自造数据      |
| 依赖执行顺序         | 同上，CI 一并行就随机红                    | `MethodOrderer.Random` 自检        |
| 随机数据不可复现     | 失败重现不了，等于没测                     | 固定种子，或注入 `Supplier`        |
| 一个测试几十个断言   | 红了还要二分定位                           | 拆用例，同一用例内用 `assertAll`   |
| 为覆盖率写无断言测试 | 数字好看，行为没锁住                       | 删掉，或补真断言                   |

## 面试怎么答

按"标准 → 能力 → 边界"三层走最稳。先给三条硬指标（快、确定、单因失败），顺手说清哪些代码不值得写单测——这一层决定你有没有判断力。再挑三四个最有信息量的 JUnit 5 能力：每个方法一个新实例（所以成员变量不是共享状态、`@BeforeAll` 得 `static`）、`@ParameterizedTest` + `@CsvSource` 把边界写成表、`assertAll`/`assertThrows` 的断言口径、`@ExtendWith` + `ParameterResolver` 注入 `Clock`/`@TempDir`。最后落到 Mock 的边界：只 mock 不拥有且慢的外部协作者，过度 verify 等于把实现钉死，`UnnecessaryStubbingException` 说明桩和分支对不上，不是框架太吵。

**能主动说出"哪些不该 mock"，基本就能确认你真在项目里写过单测**——只会背 `@Mock`/`@InjectMocks` 的人，通常也说不清 Repository 被替身掉之后丢了哪些验证。并发带上"等事件不等时间"即可，要展开时引到 [线程池](/java/concurrent/java-concurrency-thread-pool.html)。

## 容易踩的坑

| 坑                                                 | 表现与修法                                                                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| JUnit 4 / 5 的 `@Test` 混用                        | IDE 补全 import 了 `org.junit.Test`，跑起来报"没有可运行的方法"                                                                              |
| `assertThrows` 断在父类异常上                      | 子类也算通过；要精确类型用 `assertThrowsExactly`（5.9+）                                                                                     |
| `BigDecimal` 用 `assertEquals`                     | `equals` 比 scale，`1.0 != 1.00`；改 `compareTo` 或统一 scale                                                                                |
| `@BeforeAll` 非 static / `@Nested` 内部类写 static | 前者启动直接失败，后者编译失败                                                                                                               |
| 忘注册 `MockitoExtension`                          | `@Mock` 字段是 null，报 NPE 而不是"未初始化"                                                                                                 |
| `mockStatic` 当万能药                              | 3.4 引入（需切 `mockito-inline`），5.0 起成默认，JDK 21+ 动态挂 agent 会告警；能 mock 静态恰恰说明依赖被藏了，优先注入 `Clock`/`IdGenerator` |

## 小结

1. 好单测的三条硬指标是快、确定、单因失败；破任何一条，测试就会从资产变成没人跑、没人信的负债。
2. JUnit 5 默认每个测试方法一个新实例，成员变量不是共享状态，`@BeforeAll` 因此必须 `static`；`@Nested` 用来把测试类写成可读的场景句。
3. 规则密集处用 `@ParameterizedTest` + `@CsvSource` 写成边界表；断言用 `assertAll` 一次看全差异，`assertThrows` 接异常后断错误码，浮点带 `delta`，`BigDecimal` 用 `compareTo`。
4. Mock 只画在"不拥有、且慢或不稳定"的外部协作者上，不 mock 值对象和被测类；过度 verify 等于把实现钉死，`UnnecessaryStubbingException` 是设计反馈不是噪音。
5. 时间靠注入 `Clock`，异步靠 `CountDownLatch`/Awaitility 等事件，禁止 `Thread.sleep`；覆盖率只用来找没执行过的分支，断言够不够硬得靠变异测试来问。

## 参考

综合自 JUnit 5 用户指南（生命周期与 `PER_METHOD` 语义、参数化各数据源、断言与超时、扩展模型与 `@TempDir`）、Mockito 官方文档与 Javadoc（`MockitoExtension` 的严格桩、`ArgumentCaptor`、spy 与 void 打桩、静态 mock 的版本演进）、JaCoCo 与 PIT 的公开文档，以及站内 [Java 项目的测试怎么写才不白写](/engineering/engineering-testing-strategy.html) 的分层与 Mock 划线口径——站内那篇管原则，本篇只补 JUnit 5 / Mockito 的具体写法与边界。

复核后纠正了三处常见说法：一是"浮点比较用 `offset`"——JUnit 5 第三参叫 `delta`，`offset` 是 AssertJ `isCloseTo` 的术语；二是"Mockito 3.4.0 以后就支持静态方法 mock"——3.4.0 只是引入 `mockStatic`，当时还需显式切 `mockito-inline`，5.0 起 inline mock maker 才成默认；三是"`assertThrows` 断言了类型就算严谨"——它把子类也算通过，要精确类型得用 5.9 才有的 `assertThrowsExactly`。文中耗时是本地与 CI 的量级参考，随机器与上下文配置变化，别当基准值。
