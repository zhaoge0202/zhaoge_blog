---
title: "集成测试怎么跑得像线上？Testcontainers 和契约测试怎么摆？"
description: "从真库测试、容器编排到契约测试与 CI 耗时控制，讲清集成测试在工程里的落地。"
breadcrumb: true
article: true
editLink: false
category:
  - "工程与交付"
tag:
  - "项目实战"
  - "体系化"
  - "进阶"
prev:
  text: "单元测试怎么写才不是自嗨？JUnit 5 和 Mockito 的边界在哪？"
  link: "/engineering/engineering-unit-test-junit5.html"
next:
  text: "交付文档到底要交哪些？"
  link: "/engineering/engineering-delivery-docs.html"
---

# 集成测试怎么跑得像线上？Testcontainers 和契约测试怎么摆？

> 集成测试买的不是更多用例，而是"和真实中间件协作时发生的那些行为"——SQL 方言、事务边界、序列化、消息语义、连接池。Testcontainers 负责把真组件搬到 JVM 旁边，契约测试负责在联调之前拦住字段与语义变更，两件事各管一段，谁也替不了谁。

## 为什么集成测试值得花钱？

单元测试的断言对象是"我写的那段分支"，集成测试的断言对象是"中间件的实际行为"。下面这些事，只有真组件在场才验得出来：

| 只有真组件能验的 | 具体表现                                                                      | Mock 掉之后的假象                          |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| SQL 方言与约束   | 唯一键冲突抛哪种异常、`ONLY_FULL_GROUP_BY` 是否拒绝、`decimal(10,2)` 怎么截断 | `save()` 永远成功，冲突分支一行没走        |
| 事务边界         | 方法返回后到底提交了没有、`AFTER_COMMIT` 事件触发没、回滚有没有留下孤儿行     | 事务从不提交，事件永不触发                 |
| 序列化与字段口径 | JSON 字段名与类型、时间精度、`Long` 是否被转成字符串                          | 序列化器都没参与，前端口径无从校验         |
| 消息语义         | 消费位点什么时候提交、重复投递怎么处理、分区 key 是否保序                     | 只证明"发送方法被调用"，不证明消费后状态对 |
| 连接池与并发     | `Connection is not available, request timed out` 只在并发用例里冒头           | 单线程跑通，压测时线程池全卡死             |

代价也要摆明：起容器要十几秒、断言要造数据、失败定位比单测麻烦。所以职责要划清——**分支与计算交给单测，接缝交给集成测试**。分层怎么切、覆盖率怎么用，见 [Java 项目的测试怎么写才不白写](/engineering/engineering-testing-strategy.html)；纯逻辑的写法见 [单元测试怎么写才不是自嗨](/engineering/engineering-unit-test-junit5.html)。

| 层级     | 起什么                    | 能证明                        | 证明不了                | 单次耗时               | 维护成本 |
| -------- | ------------------------- | ----------------------------- | ----------------------- | ---------------------- | -------- |
| 单元测试 | 什么都不起，Mock 掉依赖   | 分支、边界、金额与时间换算    | SQL、事务、序列化、鉴权 | < 10ms                 | 低       |
| 集成测试 | Spring 容器 + 真 MySQL/MQ | 业务规则 + 方言 + 事务 + 消息 | 页面行为、第三方、性能  | 首次 15–25s，之后 1–3s | 中高     |
| 端到端   | 真部署 + HTTP + 下游      | 链路通不通、配置与字段对不对  | 出错在哪一层            | 分钟级                 | 高、最脆 |

## H2 到底骗了你哪几件事？

很多项目为了"跑得快"，把数据源换成 H2 并加 `MODE=MySQL`，就认为等价了。H2 的兼容模式是在语法层面尽量像，行为层面另算——下表逐条对照，都能在官方兼容模式说明里查到：

| 差异面             | H2（`MODE=MySQL`）                                                                              | MySQL 8                                               | 会怎么咬你                                               |
| ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `ON DUPLICATE KEY` | 支持，但**必须先配 `MODE=MySQL`**，不配直接语法错；`INSERT IGNORE`、`REPLACE INTO` 只有部分支持 | 原生                                                  | 换个库就报语法错，或者换写法后语义悄悄变了               |
| 分页               | `LIMIT/OFFSET` 支持；但 PageHelper 这类会按 JDBC URL 猜方言                                     | `LIMIT offset, size` + count 改写                     | 你验的是 H2 方言那条 SQL，跟线上不是同一条               |
| `GROUP BY` 严格性  | 不校验 `ONLY_FULL_GROUP_BY`                                                                     | 默认开启，非聚合列不在 `GROUP BY` 里直接 1055         | `SELECT a, b, SUM(c) GROUP BY a` 在 H2 全绿、上线 500    |
| 窗口函数           | 有，但函数名、窗口帧默认值、`NULLS FIRST/LAST` 与聚合函数名（`GROUP_CONCAT`）对不上             | 完整                                                  | 报表类 SQL 换库就得改写法                                |
| 锁与隔离级别       | 默认 READ_COMMITTED，没有 InnoDB 那套间隙锁/next-key lock                                       | 默认 REPEATABLE READ + 间隙锁                         | 死锁、幻读、超卖用例在 H2 上全绿——因为压根没这类锁       |
| 字符集与排序规则   | 文本比较默认**区分大小写**（要 `SET IGNORECASE TRUE` 才不区分），没有 collation                 | `utf8mb4_0900_ai_ci`：大小写、变音符号都不敏感        | 唯一索引在 MySQL 上让 `'ABC'` 和 `'abc'` 冲突，H2 不冲突 |
| `DATETIME` 精度    | 兼容模式把 `DATETIME` 当成 `TIMESTAMP`，默认保留到微秒                                          | 默认 0 位小数秒，`DATETIME(3)` 才有毫秒，且是四舍五入 | "创建时间相等"的断言 H2 绿、MySQL 红，毫秒被抹平         |
| JSON 与函数索引    | 没有 `->>`、`JSON_TABLE`；函数索引不能直接建，要用 `GENERATED ALWAYS AS` 生成列模拟             | 原生 JSON 函数 + 生成列索引                           | 建表脚本在 H2 上根本跑不起来，或者被改得面目全非         |

结论一句话：**用 H2 跑 MySQL 业务，是"用错工具得出对的结论"。**绿灯证明的是"H2 上能跑"，而你交付的是 MySQL。要么用 Testcontainers 起真库，要么干脆把这些用例降级成"逻辑烟雾测试"，别拿它的绿灯当验收。注意 `DATABASE_TO_LOWER=TRUE` 这类参数是建库时定死的，中途改会让标识符对不上。

## Testcontainers 的最小骨架长什么样？

核心只有三件事：告诉 JUnit 去管容器（`@Testcontainers`）、把容器声明成静态字段（`@Container static`）、把容器里的地址注入 Spring（`@DynamicPropertySource` 或 `@ServiceConnection`）。

```java
@SpringBootTest
@Testcontainers
abstract class MySqlITBase {                        // 子类共用这份容器定义，起停跟随测试类

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0.36")
        .withDatabaseName("app").withUsername("app").withPassword("app")
        .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_0900_ai_ci");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MYSQL::getJdbcUrl);
        r.add("spring.datasource.username", MYSQL::getUsername);
        r.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired protected JdbcTemplate jdbc;
}
```

四个容易含糊的点：

1. **容器生命周期**：静态字段的容器由扩展在这个测试类里托管——第一个用例前启动、最后一个用例后停止；写成实例字段就变成每个测试方法起停一次。把定义提到基类只是省代码、统一参数（镜像、字符集这些只写一遍），**它并不保证跨类只起一次**：要"一个 JVM 一个容器"，用 Singleton 模式——`static { MYSQL.start(); }` 手动起、不让扩展接管，JVM 退出时交给 Ryuk 收尾。这也是并行跑用例的前提。
2. **"和 JVM 同生共死"靠 Ryuk 兜底**：JVM 被 `kill -9` 时 JUnit 没机会停容器，由 Testcontainers 的 resource reaper 容器负责清理，所以本地不会越跑越多。
3. **Boot 3.1 之后可以少写属性**：`@ServiceConnection static MySQLContainer<?> MYSQL` 会自动接上 `spring.datasource.*`，手写 `@DynamicPropertySource` 只在要覆盖额外参数时才需要。
4. **reuse 的真实门槛**：`withReuse(true)` 单独写是没用的，要 `~/.testcontainers.properties` 里加 `testcontainers.reuse.enable=true`（或环境变量 `TESTCONTAINERS_REUSE_ENABLE=true`）；更关键的是**容器不能交给 JUnit 扩展托管**——官方说复用要求手动 `start()`、且不能被 `@Container` 或 try-with-resources 停掉，否则类一结束就 stop。官方同时提醒 reuse 是实验特性、不适合 CI：配置必须完全一致，资源也不一定清干净。

Kafka 和 Redis 同理，只是容器类型不同：

```java
// Kafka：类名在 2.x 迁到了 org.testcontainers.kafka，旧的 org.testcontainers.containers.KafkaContainer 已废弃
@Container
static final KafkaContainer KAFKA = new KafkaContainer("apache/kafka-native:3.8.0");
// r.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);

// Redis 没有官方模块，GenericContainer 就够；见到 new RedisContainer<>(...) 基本是社区模块
@Container
static final GenericContainer<?> REDIS =
    new GenericContainer<>("redis:7.4-alpine").withExposedPorts(6379);
// r.add("spring.data.redis.host", REDIS::getHost);
// r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
```

镜像选型也有讲究：想跟公司现网一致就锁 `mysql:8.0.36` 这种具体 tag，别用 `latest`（拉取不稳定，行为还会漂）；Kafka 一侧用 `confluentinc/cp-kafka` 镜像时对应 `ConfluentKafkaContainer`，别把两个类名混着写。

## 启动慢怎么办？

这是集成测试进 CI 的主要阻力——不是写不出来，是"跑一次三分钟"没人愿意在提交前跑。按耗时来源对症下药：

| 耗时来源                       | 典型量级       | 优化手段                                                                                                                                                  |
| ------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 拉镜像                         | 10–60s（首次） | CI 里先 `docker pull` 预热，或用内网 registry 做镜像缓存；tag 写死                                                                                        |
| 容器初始化（MySQL 建数据目录） | 8–20s          | 用 Singleton 模式（`static { MYSQL.start(); }`）让全模块共用一个；本机 reuse（手动 start）；`withTmpFs(Map.of("/var/lib/mysql","rw"))` 把数据目录挂进内存 |
| Spring 上下文启动              | 1–3s / 套      | 少用 `@MockitoBean`，每个不同组合都是一套新上下文；用 `@ServiceConnection` 省掉自定义属性                                                                 |
| 建表 / 迁移                    | 1–5s           | Flyway 每类跑一次，别每个方法重建 schema                                                                                                                  |
| 数据准备                       | 0.1–1s / 用例  | `@Sql` 批量脚本或 `batchUpdate`，别在循环里逐条 `save()`                                                                                                  |
| 串行执行                       | 整段           | 开 `junit.jupiter.execution.parallel.enabled=true`；但并行别和 `@Testcontainers` 扩展混用（官方只保证顺序执行），要并行就手动 Singleton 起容器            |
| 固定 `sleep`                   | 累积           | 换 Awaitility 等终态                                                                                                                                      |
| 全量回归                       | 分钟级         | 只跑改动模块：`mvn -pl order-service -am verify`；`*IT` 交给 failsafe 在 `verify` 阶段跑，主线单测保持秒级                                                |

验收标准很朴素：**整套集成测试控制在 3 分钟内，才会有人真的在提 PR 前跑它**。阶段怎么分段、哪些检查卡在 PR、哪些放到合并后，见 [CI/CD 流水线怎么设计](/engineering/engineering-cicd-pipeline.html)。本地想手工看一眼容器长什么样，用 [Docker Compose 本地联调怎么用](/tools/docker/docker-compose.html) 那套更直观；两者不冲突——Compose 给人用，Testcontainers 给测试用。

## 数据准备和隔离怎么不互相踩？

- **一个容器、每类一个 schema**：容器共享，但每个测试类用自己的库名（或 Flyway 先 `clean` 再 `migrate`），代价可控又互不污染；每个方法重建库太慢，不值得。
- **`@Transactional` 回滚只在纯本地事务时用**：涉及 MQ 发送、`AFTER_COMMIT` 事件、`REQUIRES_NEW` 的用例，包上回滚就等于让这些行为永不发生，用例会绿得毫无意义。
- **准备数据用 `@Sql` 而不是在 Java 里 `new` 一堆实体**：脚本可读、可复用，还能顺手写清"这条数据为什么长这样"。
- **别拿生产 dump 当测试数据**：里面是真实 PII，体量大到导入就要几分钟，而且不可解释——某个 `status=3` 到底代表什么没人知道，最该覆盖的边界值（0 件、负库存、超长字符串）生产里恰恰没有。要的是表结构 + 分布特征，不是数据本身。

```java
@Sql(scripts = "/sql/clean-order-tables.sql", executionPhase = BEFORE_TEST_METHOD)
class OrderApiIT extends MySqlITBase {

    @Test
    void 回调重放时只入账一次() throws Exception {
        jdbc.update("INSERT INTO orders(order_no, status, amount) VALUES ('A001','CREATED',199.90)");
        // 同一个回调打两次：第二次必须命中幂等，不能多一条流水
    }
}
```

注意唯一键别写死成固定值，否则这个用例只能在干净库上跑一次；用"用例维度前缀 + 自增"或每次 `clean` 完再造。

## 断言该断在哪一层？

三条规则，都是从"改一次就疼"的地方倒推出来的：

1. **断言业务结果 + 落库结果，不断言 SQL 文本**。`verify(mapper).insert(any())` 只要实现从 `insert` 换成 `insertBatch` 就红，而行为一点没坏——这是把实现细节写进了测试。
2. **异步行为等终态，别等固定时长**。定时任务、消息消费、状态机推进都属于"最终一致"，用 Awaitility 轮询到条件成立为止。
3. **消息类断言"消费后的数据库状态"，不是"消费方法被调用"**。后者证明不了幂等、证明不了落库、更证明不了位点提交时机。

```java
// 只断 200 等于没断：200 也可能是 {"code":"SYSTEM_ERROR"} 的壳
mockMvc.perform(post("/api/pay/callback").contentType(APPLICATION_JSON).content(payload))
       .andExpect(status().isOk());

assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE order_no='A001'", String.class))
    .isEqualTo("PAID");
assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pay_flow WHERE order_no='A001'", Integer.class))
    .isEqualTo(1);   // 回调重放一次，这里必须还是 1

// 消费类用例：等"库里状态变了"，不是等 sleep，也不是 verify(listener)
await().atMost(Duration.ofSeconds(5)).pollInterval(Duration.ofMillis(100))
       .untilAsserted(() -> assertThat(jdbc.queryForObject(
           "SELECT status FROM orders WHERE order_no='A001'", String.class)).isEqualTo("SHIPPED"));
```

## 契约测试补的是哪一段？

集成测试全在自己进程里跑，跨服务、跨前后端的"字段口径"它管不到；等联调发现，已经写完代码了。消费者驱动契约把这件事提前到 PR 阶段，分两步：

1. **消费者侧**用 Pact 的 mock server 声明"我期望你返回什么"，运行后生成 `pact.json` 并发布到 broker；
2. **提供者侧**在 CI 里拿这份契约打自己的真实接口，任何字段删除、类型变更、状态码语义变化都会让 provider 侧红。

```java
// 消费者：mock server 记下期望，生成契约
@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "order-api")
class OrderClientPactTest {
    @Pact(consumer = "order-web")
    RequestResponsePact 查询订单(PactDslWithProvider b) {
        return b.uponReceiving("查询存在的订单").path("/api/orders/A001").method("GET")
            .willRespondWith().status(200)
            .body(new JsonBody(o -> o.stringType("id", "1802345678901234")
                                      .stringValue("payAmount", "199.90")))   // 金额必须是字符串
            .toPact();
    }
    // 真正的触发在测试方法里：@PactTestFor 起 mock server，让客户端打一次，契约才落盘
}

// 提供者：用契约验真实接口，@State 负责准备数据
@Provider("order-api")
@SpringBootTest(webEnvironment = RANDOM_PORT)
class OrderProviderPactTest {
    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verify(PactVerificationContext ctx) { ctx.verifyInteraction(); }

    @State("订单 A001 已存在")
    void 准备数据() { jdbc.update("INSERT INTO orders(order_no, status) VALUES ('A001','PAID')"); }
}
```

Spring Cloud Contract 方向相反，契约写在提供方仓库（Groovy/Kotlin/YAML DSL，形如 `request { method 'POST'; url '/api/orders' }` 对 `response { status 201; body(...) }`），插件一次生成两样东西：提供方的 `MockMvc` 验收测试，和给消费方用的 stub jar；消费方 `@AutoConfigureStubRunner(ids = "com.acme:order-api:+:stubs:8090")` 起桩代替真实服务。**它的软肋是 base class**：如果 base class 里把 service mock 掉了，provider 侧就变成"只测注解"，契约形同虚设。

放在 CI 的哪一步：**编译之后、集成测试之前**。契约生成与 provider 验证是分钟级，能在合并前拦住 `payAmount` 从字符串改成数字、`status` 枚举少一个值、200 改成 422 这类变更；部署前再跑一次 `can-i-deploy` 确认"这个版本对所有消费者都成立"。口径与 [前后端联调怎么少返工](/engineering/engineering-api-contract-testing.html) 保持一致：一个团队两个人前后端，OpenAPI schema + CI diff 的性价比更好，跨公司对接、服务多到数不清时才值得养 broker。

**边界必须说清**：契约测试锁的是形状与语义，锁不了 SQL、事务、消息、性能；它也替代不了真实联调（网关、鉴权、CORS、网络都会在联调时才现形）。所以它是集成测试的补充，不是缩写。

## 哪些做法让集成测试变成新的负债？

| 反模式                      | 为什么亏                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------- |
| 把 e2e 当集成测试           | 一个环境问题让二十条用例一起红，定位还不如翻日志；e2e 只该是上线前那 10 个冒烟接口 |
| 集成测试依赖共享测试环境    | 别人跑一遍你的用例就红，环境一挂全员停工                                           |
| 测试里 `sleep` 等结果       | 慢机器红、快机器绿，最后靠重跑刷绿，真 bug 被重试盖住                              |
| 只断言 HTTP 200             | 200 也可能是 `{"code":"SYSTEM_ERROR"}`，金额与状态一个没验                         |
| 在集成测试里堆业务分支      | 起容器的成本乘以分支数量，一次十分钟，最后没人跑                                   |
| `verify(mapper)` / 断言 SQL | 实现一换就红，行为没坏，测试却成了改代码的阻力                                     |

## 面试怎么答这条？

按三段递进，正好对上"测试不是白写"：

1. **先划边界**：什么该进集成测试——跨进程协作的行为（SQL 方言与约束、事务提交与事件、序列化、消息语义、连接池）；分支与计算留在单测。一句话概括：**单测证明"我算对了"，集成测试证明"我和别人配合对了"**。
2. **再讲落地**：`@Testcontainers` + `static @Container` + `@DynamicPropertySource`（或 `@ServiceConnection`）起真 MySQL/Kafka/Redis；耗时治理按"镜像预热 → 容器共享与复用 → 上下文与数据 → 并行与按模块跑"压，目标是整套进 3 分钟。
3. **最后补契约**：跨服务字段与语义用 Pact/Spring Cloud Contract 在 PR 阶段拦，部署前用 `can-i-deploy` 卡一道；但要说清它不替代集成测试，也不替代真实联调。

## 容易踩的坑

- **`withReuse(true)` 写了没效果**：要么没开全局开关，要么容器被 `@Container` 托管、类结束就 stop，压根没机会复用。
- **并行 + `@Testcontainers`**：官方只保证顺序执行，并行下容器与端口映射都可能出问题；要并行就手动 Singleton 起容器。
- **H2 绿灯当验收**：最常见三处是 `ONLY_FULL_GROUP_BY` 不校验、字符集大小写不敏感缺失、`DATETIME` 精度差异。
- **`@Transactional` 包住集成测试**：MQ 发不出去、`AFTER_COMMIT` 不触发，用例看着全绿，线上第一条消息就丢。
- **复用容器但没清库**：上次跑剩的 `order_no='A001'` 让这次唯一键冲突，而且只在"第二次跑"时红。
- **只 pull 了 MySQL**：CI 上第一次跑 `apache/kafka-native` 还在拉镜像，超时；后面靠重试掩饰。
- **SCC 的 base class 里 mock 掉业务**：provider 测试退化成注解检查，契约拦不住任何真实变更。

## 小结

1. 集成测试值钱的地方在接缝：SQL 方言与约束、事务边界、序列化、消息语义、连接池——这些只能在真组件上验。
2. H2 只能当逻辑烟雾测试：`ON DUPLICATE KEY` 要配模式才支持，但 `ONLY_FULL_GROUP_BY`、字符集大小写、`DATETIME` 精度、间隙锁、JSON 函数五项差异足以让绿灯失真。
3. Testcontainers 骨架就三件事：`@Testcontainers`、`static @Container`、注入地址（`@DynamicPropertySource`/`@ServiceConnection`）；容器随类起停、Ryuk 兜底，reuse 要全局开关且不能交给 JUnit 托管、也不适合 CI。
4. 耗时按"镜像 → 容器 → 上下文 → 数据 → 并行 → 按模块跑"压，整套进 3 分钟才有人真的跑。
5. 契约测试补的是跨服务的字段与语义，放 PR 阶段最划算；它拦不住 SQL、事务和真实联调的问题，别拿它替代集成测试。

## 参考

综合自 Testcontainers for Java 官方文档（JUnit 5 扩展的容器生命周期与"仅支持顺序执行"的限制、Reusable Containers 的开关与限制、Kafka 模块的类迁移与镜像对应关系、MySQL 模块）、H2 官方文档的 MySQL 兼容模式章节（`ON DUPLICATE KEY UPDATE` 与 `INSERT IGNORE`/`REPLACE INTO` 的支持程度、`DATABASE_TO_LOWER`、文本比较默认区分大小写、函数索引需用生成列模拟、`DATETIME` 按 `TIMESTAMP` 处理）、MySQL 8 参考手册（`ONLY_FULL_GROUP_BY` 默认开启、小数秒精度与四舍五入、`utf8mb4_0900_ai_ci`）、Pact JVM 与 Spring Cloud Contract 文档，以及 Spring Boot 测试章节（`@ServiceConnection`、TestContext 上下文缓存）。

核对说明：H2 那一节按官方兼容模式列表逐条核对，其中"H2 不支持 `ON DUPLICATE KEY UPDATE`"是常见误传——它在 `MODE=MySQL` 下是支持的，真正的坑是不配模式、以及 `INSERT IGNORE`/`REPLACE INTO` 只有部分支持。`withReuse(true)` 依赖 `~/.testcontainers.properties` 里的 `testcontainers.reuse.enable=true`，且要求手动 `start()`、不能被 JUnit 扩展停掉，按官方"Reusable Containers"页核对。示例代码为便于阅读裁剪了包名与 import，实际使用时按项目版本调整。
