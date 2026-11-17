---
title: "从 0 搭一个可交付的 Spring Boot 多模块工程，骨架里该有哪些东西？"
description: "从模块划分、统一出口到横切能力与交付物，给出可落地的工程骨架与裁剪原则。"
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
  text: "后端也要懂体验：接口怎么设计才不折腾前端？"
  link: "/engineering/engineering-backend-api-experience.html"
next:
  text: "前后端联调怎么少返工？"
  link: "/engineering/engineering-api-contract-testing.html"
---

# 从 0 搭一个可交付的 Spring Boot 多模块工程，骨架里该有哪些东西？

> 骨架的价值不在"看起来专业"，而在两个很土的效果：新人第一天能把它跑起来，半年后接手的人还敢改。模块怎么切、返回怎么包、异常怎么收，都只为这两件事服务。

## 先定标准：好骨架的判据只有三条

聊"要几个模块"之前先定义什么叫好。把玄学换成能掐表、能数、能当场演示的指标——**模块数量、目录名字、有没有 `domain` 包，一个都不算**。这三条都能当场验证：新人入职那天掐表、随便挑个历史需求数 diff、翻一次线上 500 的排查记录。

| 指标             | 合格线                                                                       | 不合格的样子                                      |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| 本地启动要几步   | `clone` → `docker compose up -d` → `mvn spring-boot:run`，十分钟内且不用问人 | README 让你先找老张要库密码，再手动建六张表       |
| 加一个接口改几处 | 查询类 ≤ 4 个文件，不碰别人的模块，不复制配置                                | 得往 `common` 塞工具类，顺手改了三个人的文件      |
| 出问题能否追链路 | 一个 traceId 从入口日志串到 SQL 与下游，慢请求自己留痕                       | 只看到一句 `NullPointerException`，时间是三小时前 |

## 目录与模块：五个模块，各有"不该放什么"

```text
shop/
├─ pom.xml              # packaging=pom：只管版本、插件、modules
├─ shop-api/            # 对外契约：DTO、错误码、OpenAPI 注解
├─ shop-domain/         # 领域模型、用例编排、仓储接口；不依赖框架
├─ shop-infrastructure/ # Mapper、MQ 收发、外部 HTTP 适配
├─ shop-common/         # 真正跨模块的基础能力（越薄越好）
└─ shop-app/            # 启动类、配置装配、唯一打可执行包的地方
依赖方向：app → infrastructure → domain → api；common 谁都能用，但不许依赖业务模块
```

| 模块             | 职责                                       | 不该放什么                                         |
| ---------------- | ------------------------------------------ | -------------------------------------------------- |
| `app`            | 启动类、`@Configuration` 装配、打包插件    | 业务逻辑；任何 `if (order.getStatus() == ...)`     |
| `api`            | DTO、请求/响应模型、错误码枚举、文档注解   | 实体、Mapper、第三方实现的直接依赖                 |
| `domain`         | 领域对象、业务规则、用例编排、仓储接口定义 | `@RestController`、`@Mapper`、`HttpServletRequest` |
| `infrastructure` | 持久化实现、消息、缓存、外部系统客户端     | 业务规则判断；反向依赖 `domain` 的实现             |
| `common`         | 返回结构、异常基类、上下文、工具           | 某个业务域的"公共"代码、只被一个模块用的东西       |

分层内部怎么写（Controller 干几件事、事务边界放哪）见[分层架构怎么划分边界](/system-design/basis/design-layered-architecture.html)；父 pom 怎么收版本、`-pl -am` 怎么增量构建见 [Maven 多模块怎么组织](/tools/maven/maven-multi-module.html)。三个明确反对：

1. **一上来拆微服务**。代价是分布式事务、链路排查、联调环境翻倍，收益要等团队和流量到那个量级才出现。单体多模块先把边界做对，将来按模块切服务才有据可依。
2. **把 everything 塞 `common`**。它一旦装进"订单工具类""用户常量"，就成了所有人的共享可变状态：改一行，全仓库重新验证。判据很硬——**三个以上模块真在用、且与业务无关**才配进。
3. **为分层而分层**。十几张表的后台系统 `app` + `api` 两个模块就够，硬凑五层只会让加个字段改四个文件。模块是被依赖方向逼出来的，不是被名词表逼出来的。

## 统一出口：三件必做的事

**返回结构：要不要包 `code/message/data`**

| 方案                          | 适合                                 | 代价                                                    |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------- |
| 全 HTTP 200，靠 `code` 判成败 | 老前端只认一套判定、网关不便改状态码 | HTTP 语义废了，监控、重试、缓存、浏览器行为都拿不到信号 |
| 纯状态码 + 成功时裸返回数据   | 开放平台、内部 RPC                   | 业务细分原因（库存不足 vs 商品下架）只能塞 message      |
| **两层并用**（推荐）          | 绝大多数业务后端                     | 要维护一张"状态码 ↔ 业务码"映射表并写进文档             |

口径：**HTTP 状态码回答"请求被正确处理了吗"**（400 参数、401/403 身份权限、404 不存在、409 冲突、429 限流、500 故障），**body 的 `code` 回答"业务上到底怎么了"**。别出现"库存不足返回 200"这种只有前端看得懂的约定，否则告警会把失败当成功。响应体建议带上 `traceId`：用户截图给客服，后端直接查日志。

**错误码分段：让码本身携带定位信息**。错误码最怕两件事：全局自增撞号、发布后改语义让历史日志全错。用分段解决——`业务域(2位) + 类型(1位) + 序号(3位)`：

| 位段      | 取值                                                             | 说明                           |
| --------- | ---------------------------------------------------------------- | ------------------------------ |
| 第 1–2 位 | `10` 通用框架 / `20` 用户账号 / `30` 商品库存 / `40` 订单支付    | 业务域按段分配，谁的地盘谁维护 |
| 第 3 位   | `1` 参数 / `2` 业务规则 / `3` 权限 / `4` 依赖故障 / `5` 频控幂等 | 类型决定前端怎么处理           |
| 第 4–6 位 | `001`–`999`                                                      | 域内序号，删掉的留墓碑不复用   |

于是 `402015` 一眼能读成"订单域 · 业务规则 · 第 15 号"，配 409；`105001` 是"通用 · 频控幂等"，配 429 + `Retry-After`。三条纪律：**已发布的码不准改语义**；**删掉的码留墓碑、永不复用**（否则历史日志会被误读）；**枚举是唯一来源**，错误码文档从枚举生成，别手写一份 markdown 等着漂移。

**全局异常收口：日志留堆栈，响应不带堆栈**。目标不是"别报错"，而是**前端拿到能看的文案，后端拿到能查的堆栈**：

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)   // 参数校验 → 400 + 字段级文案
    public ResponseEntity<ApiResponse<Void>> onInvalid(MethodArgumentNotValidException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.fail(PARAM_INVALID, fieldMessages(e)));
    }
    @ExceptionHandler(BusinessException.class)                 // 业务拒绝 → 4xx，warn 不打堆栈
    public ResponseEntity<ApiResponse<Void>> onBusiness(BusinessException e) {
        log.warn("rejected code={} msg={}", e.getCode().code(), e.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiResponse.fail(e.getCode(), e.getMessage()));
    }
    @ExceptionHandler(Exception.class)                         // 系统故障 → 500，堆栈只进日志
    public ResponseEntity<ApiResponse<Void>> onUnknown(Exception e) {
        log.error("unexpected error traceId={}", MDC.get("traceId"), e);  // 第三个参数才是堆栈
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(SYSTEM_ERROR, "系统繁忙，请稍后重试"));
    }
}
```

两条红线：`log.error(e.getMessage())` 等于把堆栈扔了，必须 `log.error("ctx {}", ctx, e)`；不要 advice 和 filter 各记一次，同一次失败在日志里出现三遍反而看不清根因。还有一个坑——`@ExceptionHandler(Exception.class)` 会把 Spring MVC 自己的 404/405/415 一起吃掉，要么继承 `ResponseEntityExceptionHandler`，要么显式放行 `ErrorResponse`。

## 参数校验：错误文案要能直接甩给用户

校验分三层，别混：DTO 管格式（非空、长度、正则、范围，失败回 400 + 字段级文案，一次返回全部）；领域管业务（库存、状态机、额度，失败抛业务异常）；数据库约束是最后一道（唯一键冲突要翻译成业务码，别裸抛 SQL 异常）。注解不够用时写自定义校验器，别在 Service 里手动 `if (phone == null || ...)`：

```java
@Constraint(validatedBy = PhoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER}) @Retention(RetentionPolicy.RUNTIME)
public @interface Phone { String message() default "手机号格式不正确"; Class<?>[] groups() default {}; }
public class PhoneValidator implements ConstraintValidator<Phone, String> {
    private static final Pattern CN = Pattern.compile("^1[3-9]\\d{9}$");
    @Override public boolean isValid(String v, ConstraintValidatorContext ctx) {
        return v == null || CN.matcher(v).matches();      // null 交给 @NotBlank
    }
}
```

分组处理同一份 DTO 的创建/更新差异（`Create.class`、`Update.class`），但**更省事的是直接写两个 DTO**：分组注解一多，`@Null(groups = Create.class)` 这类声明就没人看得懂了。文案标准是"能原样展示给用户"：写"手机号格式不正确"，别写"size must be between 1 and 20"；要国际化走 `messages.properties`。错误码和字段提示怎么组织得让前端不用猜，见[后端也要懂体验：接口怎么设计才不折腾前端](/engineering/engineering-backend-api-experience.html)。

## 横切能力清单

共同点是：**每个接口都要，但不该出现在任何业务代码里**，用过滤器、拦截器、AOP 一次收口。判断有没有真收口，看一个信号就够：业务代码里出现 `auditService.record(...)`、`userContext.set(...)`、`redisLock.tryLock(...)` 这类"每个方法写一遍"的调用，说明还停在手工阶段。

| 能力         | 实现手段                               | 最小可用版本                                            | 常见坑                                            |
| ------------ | -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| 鉴权         | Spring Security + JWT / 分布式 Session | 过滤器解析 token 写进 `UserContext`，登录与健康检查放行 | 把 `userId` 当请求参数传；token 里塞可变权限      |
| 幂等         | 注解 + AOP + Redis SETNX，兜底唯一键   | 请求指纹（用户+接口+业务键）占位，TTL 覆盖重试窗口      | 只靠 Redis 不加唯一键，Redis 一抖就重复下单       |
| 限流         | 本地令牌桶 / Redis + Lua               | 按接口+用户限 QPS，超限 429 带 `Retry-After`            | 单机限流当集群限流；限流键用了 NAT 后的出口 IP    |
| 审计日志     | AOP 注解 + 异步落库或独立日志          | 谁、何时、对哪个对象、改了什么（前后值 diff）           | 审计写进主事务拖慢业务；密码 token 原样打进去     |
| 多租户上下文 | 拦截器 + ThreadLocal + MyBatis 拦截器  | 入口解析 `tenantId`，SQL 自动拼租户条件                 | 线程池/异步丢上下文；用完不清导致串号             |
| 优雅停机     | `server.shutdown=graceful` + 探针摘流  | 先 readiness=false，等在途请求与消费处理完再退出        | 直接 `kill -9`；停机超过编排层宽限期被强杀        |
| CORS         | 网关或 `CorsFilter` 统一配置           | origin 白名单精确列出，`allowCredentials` 与 `*` 不共存 | 每个 Controller 贴 `@CrossOrigin`；预检被鉴权拦掉 |

## 可观测：开箱就该有的四样

- **结构化日志**：JSON 输出，字段固定 `ts / level / logger / traceId / userId / tenantId / msg`，别让运维用正则解文本。`traceId` 在网关或过滤器生成并透传（优先 W3C `traceparent`），线程池、`@Async`、MQ 消费都要显式传递，否则链路断在第一个异步点。脱敏做在 appender 层而非每个调用处：手机号、身份证、银行卡、密码、token——**日志里搜得到明文密码，等于一次已经发生的数据事故**。
- **RED 指标**：Rate / Errors / Duration（P50/P95/P99），Micrometer + `/actuator/prometheus` 直接出。再加业务指标：下单成功率、支付回调延迟、消息堆积量——技术指标正常而业务指标崩，是最常见的事故形态。别用日志算指标，又贵又不准。
- **健康检查分离**：`liveness` 只证明进程活着，**绝不查数据库**；`readiness` 才查 DB、Redis、下游，失败就从负载均衡摘掉。启动慢（预热、加载缓存）用 `startupProbe` 兜，别把 `initialDelay` 一调了事。反例很经典：liveness 里查 DB，DB 抖动一秒，编排层把全部实例重启一遍，把可恢复的抖动放大成雪崩。
- **慢请求与慢 SQL 阈值**：接口阈值取 SLO 目标的一半（目标 200ms 则 500ms 记慢日志），记参数摘要、耗时、返回码但不记敏感原值；SQL 用 MyBatis 拦截器抓 `> 1s` 或返回行数异常的语句。慢日志可全量，正常请求按 1% 采样，否则日志成本会追平机器成本。

## 数据层约定

选型先看查询复杂度：MyBatis 适合 SQL 复杂、要精细控制执行计划、已有 DBA 规范的团队（代价是样板代码多、方言自己兜）；JPA 适合模型驱动、CRUD 为主的团队（代价是复杂查询易生成烂 SQL，得能读懂执行计划）。以下几条不随选型变化：

1. **禁止大 offset，分页要有上限**。`limit 100000, 20` 会让数据库先扫十万行，深分页改游标 `where id > #{lastId} order by id limit #{size}`，必须跳页则用延迟关联（先走覆盖索引取主键再回表）；`pageSize` 服务端强制 ≤ 100，`count(*)` 不是免费的，列表接口不一定需要 total。
2. **乐观锁优于悲观锁**。表加 `version`，更新走 `where id = ? and version = ?`，影响行数为 0 就返回 409 让调用方重试；`select ... for update` 只用在极短临界区。
3. **审计字段统一填充**。`created_at/created_by/updated_at/updated_by/deleted` 由拦截器或 ORM 回调自动写，别指望每个人记得；逻辑删除字段要进索引，否则查询静默扫全表。
4. **多数据源先想事务，慢 SQL 有阈值**。跨库写没有本地事务，需要强一致就回单库或引入可靠消息，不要假装有分布式事务；超过 `1s` 的语句进索引评审，阈值和慢请求日志用同一套标准。

## 配置与环境

差异只留"环境真正不同的东西"，其余收在公共文件里；这些配置最终怎么被条件装配成 Bean，口径见 [Spring Boot 自动装配原理是什么](/system-design/framework/spring-boot-auto-configuration-principles.html)：

```yaml
# application.yml —— 公共默认值：与环境无关的配置都放这；密钥一律来自环境变量
app.payment.gateway-url: ${PAY_GATEWAY_URL} # 不给默认值，缺失即启动失败
---
# application-prod.yml —— 只写环境差异
spring.datasource.url: jdbc:mysql://${DB_HOST}:3306/shop?useSSL=true
spring.datasource.password: ${DB_PASSWORD}
```

- `spring.profiles.active` 由环境变量注入，**镜像里不带环境**，同一个镜像从测试晋级到生产。
- **密钥不进仓库**：密码、AK/SK 走环境变量或密钥管理服务，本地用 `application-local.yml` 并写进 `.gitignore`，CI 加一道密钥扫描。
- **配置中心是可选件**：多环境多实例、要动态开关和灰度时才值得上；三台机器一个环境，引入它的运维成本大于收益。反过来，全公司只有一处能改配置、配置中心一挂服务就起不来，也是常见自伤。
- **启动自检 fail fast**：配置缺失应在启动那一秒炸，而不是上线三天后第一笔支付报空指针；还该查数据库连通性与版本、必需的表/迁移版本、时区与字符集、Redis/MQ 可达，检查失败就退出进程让编排层重试——**半个身子起来的服务比没起来的更危险**：

```java
@ConfigurationProperties(prefix = "app.payment")
@Validated
public record PaymentProperties(@NotBlank String gatewayUrl, @NotBlank String merchantId,
                                @Min(1000) @Max(60000) int timeoutMillis) { }
```

## 契约与文档

- **OpenAPI 自动生成**（springdoc），注解写清字段含义、示例值、错误码，生产环境关闭或加权限；**错误码文档由枚举生成**，和代码同源，天然不漂移。
- **版本策略**：路径版本 `/api/v1` 最省事。兼容规则写成清单——加字段兼容；加枚举值算"软不兼容"要提前通知；改字段含义、改类型、删字段都是破坏性变更，必须升 `/v2` 并保留 `/v1` 至少一个发布周期。
- 接口定稿后怎么防两端口径漂移，见[前后端联调怎么少返工](/engineering/engineering-api-contract-testing.html)。

## 构建与交付

多阶段 Dockerfile，依赖层和业务层分开，改一行代码不必重下全部依赖：

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
COPY . /src
RUN cd /src && mvn -B -pl shop-app -am package -DskipTests && java -Djarmode=tools -jar shop-app/target/app.jar extract --layers --destination /src/layers
FROM eclipse-temurin:21-jre
COPY --from=build /src/layers/dependencies/ ./
COPY --from=build /src/layers/spring-boot-loader/ ./
COPY --from=build /src/layers/application/ ./
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

老版本 Boot 用 `-Djarmode=layertools`，产出的层结构一样。收尾三件事：`.dockerignore` 排除 `target/`、`.git/`、`node_modules/`；确认没把 `sources`/`javadoc` 塞进镜像；落地后 `docker run --rm --entrypoint ls <image> /app` 看一眼，**源码和测试依赖出现在镜像里就是配置没写对**。

本地依赖一条命令起（给依赖配 healthcheck，等服务真就绪再连），别让人手工建库；流水线怎么分层、门禁卡在哪、制品怎么不可变晋级，见 [CI/CD 流水线怎么设计](/engineering/engineering-cicd-pipeline.html)：

```yaml
services:
  mysql:
    image: mysql:8.4
    environment: { MYSQL_DATABASE: shop, MYSQL_ROOT_PASSWORD: "${MYSQL_ROOT_PASSWORD}" }
    healthcheck:
      { test: ["CMD", "mysqladmin", "ping", "-h", "localhost"], interval: 5s, retries: 20 }
```

骨架这边只要保证一件事：干净机器上 `mvn -pl shop-app -am verify` 一条命令跑通。

## 交付物清单

代码能跑不等于能交付。骨架生成时就该把这五份东西留好位置（写法和更细的清单见[交付文档到底要交哪些](/engineering/engineering-delivery-docs.html)）：

| 交付物         | 最小内容                                           | 缺了会怎样                           |
| -------------- | -------------------------------------------------- | ------------------------------------ |
| README         | 三条命令跑起来、模块说明、常见问题                 | 新人靠问人起步，交接成本压在老人身上 |
| 环境说明       | 各环境地址、账号申请流程、配置项清单与默认值含义   | 上线前才发现少申请一个白名单         |
| 部署与回滚手册 | 步骤、验证点、回滚命令、数据回滚边界（哪些滚不回） | 出事时现编命令，越急越错             |
| 健康检查与监控 | 探针路径、关键指标、告警阈值与接收人               | 只有用户投诉才知道服务挂了           |
| 值班与联系     | 模块负责人、升级路径、外部依赖厂商联系方式         | 半夜找不到能定位的人                 |

## 容易踩的坑

1. **DTO 与 Entity 混用**。拿实体直接当请求/响应，结果是改个库字段就破坏接口、懒加载字段序列化炸、成本价这类内部字段意外暴露。`api` 模块存在的意义就是把这层隔开。
2. **`common` 变成垃圾桶**。判据只有一个：三个以上模块真在用且与业务无关。剩下的就地放，宁可重复两行也别开共享可变状态的口子。
3. **全局异常吞堆栈**。`catch (Exception e) { log.error(e.getMessage()); }`、只 catch 不记、包一层新异常却忘了 `initCause`——线上只剩一句 "null"，排查从十分钟变成一整天。
4. **把脚手架做成内部框架**。自研 RPC、自研校验、自研缓存层，再配一堆只有作者懂的注解。骨架该是**约定 + 少量薄工具**，加东西的门槛是"团队真的痛了"，不是"看起来更统一"。
5. **所有配置都进配置中心**。配置中心一挂就起不来，改错一个值全环境受影响。和代码强绑定的（超时、重试、序列化）留在仓库，和部署环境强绑定的才外置。
6. **为了"规范"牺牲启动速度**。包扫描范围开太大、几十个 starter 全引入、启动自检串行等六个下游——本地启动 40 秒、容器探针直接超时。规范是为了让人敢改，不是让人等。

## 面试怎么答

1. **模块边界**：五个模块 + 单向依赖，`api` 只放契约、`domain` 不依赖框架，小项目按两三个模块裁剪。
2. **统一出口与横切能力**：HTTP 状态 + 业务码两层语义、错误码分段、异常按参数/业务/系统三类收口；鉴权、幂等、限流、审计、租户、停机、CORS 用过滤器或 AOP 收口而非散落业务代码。
3. **可观测与测试**：结构化日志带 traceId 与脱敏、RED 指标、liveness 与 readiness 分离、慢请求与慢 SQL 阈值，单元测试与集成测试分层。
4. **交付物**：README、环境说明、部署与回滚、健康检查与告警、值班联系。

最后补一句裁剪原则：**骨架按团队规模裁剪**——三个人维护的系统不该按大厂五个模块加配置中心铺开，否则养脚手架的人力比写业务还多。能说清"我在什么规模下放弃了什么"，比背全一套目录更像做过项目。

## 小结

1. 判断骨架好坏不看模块多少，看三条可验证指标：启动几步、加接口改几处、故障能否按 traceId 追到底。
2. 模块按依赖方向切：`app → infrastructure → domain → api`，`common` 只装三个以上模块共用且与业务无关的东西。
3. 统一出口三件套：两层语义的返回结构、带业务域分段的错误码、分类收口的全局异常——日志留堆栈，响应带 traceId 不带堆栈。
4. 可观测、横切能力、配置自检要内建；交付物和代码同等重要；骨架按团队规模裁剪，别把大厂那套搬到三人团队。

## 参考

综合自 Spring Boot 官方文档（外部化配置与 `@ConfigurationProperties` 校验、Actuator 健康分组、分层 jar 与 `jarmode=tools`）、Maven 反应堆机制，以及多支团队脚手架落地与事故复盘的常见经验；站内《分层架构里 Controller、Service、领域模型怎么划界？》《多模块工程和私服怎么组织？》《Spring Boot 自动装配原理是什么？》三篇作为口径对齐来源。错误码分段方案、返回结构取舍表、Dockerfile 与 compose 示例均为自拟，用于说明取舍而非可直接照搬的模板。
