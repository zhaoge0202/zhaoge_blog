---
title: "Java Agent 的测试怎样分层并覆盖关键故障？"
description: "围绕模型替身、接口和业务终态设计Java应用的分层验收。"
breadcrumb: true
article: true
editLink: false
category:
  - "AI 应用开发"
tag:
  - "项目实战"
  - "体系化"
prev:
  {
    text: "Java Agent 的审批与恢复怎样落到状态和事务？",
    link: "/ai/ai-agent-java-approval-recovery.html",
  }
next:
  {
    text: "怎样设计一个能撤权、可追溯的企业知识库？",
    link: "/ai/ai-enterprise-knowledge-base-design.html",
  }
---

# Java Agent 的测试怎样分层并覆盖关键故障？

> 用替身控制外部不确定性，再分别验证业务分支、接口、数据库和恢复边界，最终断言任务状态与真实副作用。

## 模型回答“已经升级”，测试应该看哪里？

假设 alice 要升级本人工单 T-1048。
接口返回成功文本，却可能没有升级记录，也可能因两次确认创建了两条，或错误地操作了别人的工单。
仅断言 HTTP 200 或回答包含“成功”，无法区分这些情况。

先定义正确的终态和不可违反的约束，再选择验证层次。
通用的任务评测与多次运行指标见[Agent 评测](./ai-agent-evaluation.html)，这里关注 Java 应用中不同测试各能证明什么。

## 单元、接口、数据库与模型评测怎样分工？

- 单元测试使用模型、时钟和远程工具的替身，检查参数校验、预算、状态分支和错误分类。
- 接口测试检查反序列化、认证、对象权限、响应契约与错误映射，必要时通过真实 HTTP 验证。
- 数据库集成测试检查约束、锁、事务提交和并发防重，使用与目标部署相符的数据库。
- 进程恢复测试检查磁盘状态和重启后的行为，不能只在同一内存上下文里换一个对象。
- 真实模型与 Prompt 评测使用版本化问集，单独衡量事实、拒答、质量和成本。

这些层次会有交叠，但证明范围不同。
调用了某个 Repository 方法，不能证明 SQL 已提交；一条正确回答也不能证明权限检查先于业务写入。

## 模型替身怎样帮助单测，而不把业务本身替掉？

替身可以按顺序返回工具调用、非法参数、下游失败和最终回答，使测试可重复。
它替换的是模型适配边界，工具选择、权限、状态机和业务服务仍经过被测代码。
不能让替身直接给出最终成功状态，再用这个状态断言自己成功。

下面是 JUnit 5 风格的服务层断言示意，省略导入和应用类型，没有配套可运行项目。
`DemoFixture`、`ScriptedModel` 和方法均为教学占位，记录应由实际被测行为产生，不能预先填好成功计数。

```java
@Test
@Timeout(3)
void repeatedConfirmationCreatesOneUpgrade() {
    var fixture = DemoFixture.waitingTicket("alice", "T-1048");
    var agent = fixture.agentWith(ScriptedModel.upgradeProposal("T-1048"));
    var run = agent.ask(fixture.subject(), "升级 T-1048");
    var approval = fixture.userApprovalFor(run);
    agent.confirm(fixture.subject(), approval);
    agent.confirm(fixture.subject(), approval);
    assertEquals(1, fixture.upgrades().count(run.operationId()));
    assertEquals("SUCCEEDED", fixture.runs().phase(run.id()));
    assertEquals(0, fixture.audit().unauthorizedWrites());
}
```

这段只表达重复确认的服务层判据，不证明 HTTP 认证、数据库唯一约束或并发请求已经验证。
顺序重复之外，还要另设同时提交的用例，不能把两次连续调用当成并发测试。
未知工具、缺失或多余参数、类型错误和响应截断，也应有可区分的失败结果。

## MockMvc 通过后，为什么仍需要真实 HTTP 场景？

MockMvc 适合快速检查 MVC 路由、校验、过滤器和异常映射，但不会启动真实嵌入式服务器。
在 Spring Boot 3.5 中，`@SpringBootTest(webEnvironment = RANDOM_PORT)` 提供真实 Web 环境，可用 HTTP 客户端请求分配的端口。
具体注解和客户端 API 要按项目版本核对。

真实接口场景要携带测试凭据，让服务端安全链取得当前主体。
只在测试线程设置身份，不能自动代表发出的 HTTP 请求已经通过服务端认证。
换用户、换租户、伪造参数和直接猜测任务 ID，都应验证无法访问越界数据。

供应商适配可以用受控 HTTP 响应检查 Schema、工具调用标识、流式片段和错误码。
契约符合并不证明业务正确，仍要核查终态、记录归属和授权事件顺序，边界见[接口契约测试](../engineering/engineering-api-contract-testing.html)。

## 数据库测试怎样避免“在 H2 能跑”被当成上线结论？

H2 可以用于针对其自身行为的测试，也可以承担一部分逻辑烟雾验证。
若目标是 PostgreSQL 或 MySQL，就不能用兼容模式推导其 SQL 方言、唯一键、锁和隔离级别完全一致。
迁移脚本、空值约束、重复键异常和并发提交需要在目标引擎及版本上核对。

Testcontainers 可以帮助测试使用真实组件，但需要相应运行环境。
没有执行条件时，记录这一层未验证，不能用内存仓储的结果替代。
框架扩展的容器生命周期与并行支持也要核实，详见[集成测试与 Testcontainers](../engineering/engineering-integration-test-testcontainers.html)。

随机端口 HTTP 测试中，客户端与服务端通常位于不同线程和事务。
测试方法的 `@Transactional` 自动回滚，不会自动撤销服务端提交的数据。
涉及独立事务、提交后事件和外部动作时，尤其需要显式设计清理与结果查询。

## 哪些故障应该进入同一份案例清单？

下面是待实现与执行的场景设计，判据应从环境和业务记录取得，不接受模型自报的副作用计数。

| 场景                         | 应检查的结果                                   |
| ---------------------------- | ---------------------------------------------- |
| 缺身份、越用户或越租户       | 拒绝访问，没有越界内容进入模型或响应           |
| 未知工具、非法参数或截断调用 | 进入受控失败，不执行猜测出来的动作             |
| 工具结果夹带额外指令         | 不扩大工具或数据权限，不产生额外写入           |
| 未审批、审批过期或草稿改参   | 不写入，不能复用旧确认                         |
| 重复与并发确认               | 同一业务意图只有一次副作用，同键改参返回冲突   |
| 业务已提交、响应丢失         | 查询原操作终态，不因网络超时再次创建           |
| 等待状态或检查点窗口后重启   | 从持久状态恢复，并核对已有业务结果             |
| 超时、取消或预算耗尽         | 任务终态明确，已提交动作仍可查询，不能虚报回滚 |

授权检查和确认必须先于写入，多个合法只读查询次序则不必强制一致。
有关参数绑定、事务与恢复窗口的设计，见[Java 审批与恢复](./ai-agent-java-approval-recovery.html)。

## 恢复、超时与测试隔离怎样设计才可复核？

若要证明进程重启可恢复，应使用独立进程和磁盘状态，并明确在什么位置退出、恢复后读取了什么。
“业务提交后、检查点未保存”需要真实区分提交边界，不能只在一个待回滚事务里抛异常模拟全部情况。
本篇描述这些验收条件，没有执行重启或故障注入。

每个案例使用独立身份范围、操作号和数据命名空间，避免上一次成功留下的记录帮助下一次通过。
时间判断可注入可控制的 `Clock`，异步状态用有截止时间的条件等待，避免固定长时间休眠。
接口使用随机端口，临时目录、连接池、线程和测试启动的进程在结束时清理，并核实没有残留。

单元测试应保持快速且有合理超时，前例的 3 秒仅为防挂起的教学设置。
生命周期、数据库和进程场景分别设置上限，不要把整套测试都设成无期限等待。
JUnit 超时和线程中断不保证远程请求或子进程已经停止，资源回收仍需单独设计。

## 真实模型和 Prompt 回归放在哪里？

不依赖外网的确定性回归可以作为常规 CI 基线。
真实模型评测另行固定模型、Prompt、工具定义、知识快照、任务集和预算，保留运行条件。
不能把每次调用真实模型、比对一段唯一字符串作为全部单测的前提。

模型切换后，分别观察业务通过、安全拒绝、证据与引用、表达质量和成本。
生成存在波动，需要合适样本与重复运行，统计方式回链到[通用评测](./ai-agent-evaluation.html)，不混报替身与真实模型结果。
采样日志和评测记录也要脱敏，失败诊断不能将令牌、完整工单正文或评分答案泄露给被测 Agent。

## 小结

1. 替身控制模型与外部依赖，业务执行、权限和状态机仍需经过实际被测路径。
2. 服务层、HTTP、数据库和进程恢复分别取证，不能用一层的通过代表全部正确。
3. H2 与目标数据库的差异需要核对，服务端 HTTP 事务不会随测试方法自动回滚。
4. 关键故障检查终态、授权顺序与副作用，案例隔离、超时和清理也是测试设计的一部分。
5. 真实模型与 Prompt 回归单独度量，不依赖它们生成唯一文本来支撑无外网单测。

## 参考

综合站内 Agent 评测、Java 审批恢复、JUnit、数据库集成与接口契约资料，并于 2026-11-20 对照以下官方原文。
核对了随机端口的真实服务器、HTTP 事务边界、容器生命周期和 JUnit 超时语义。

- [Spring Boot 3.5：Testing Spring Boot Applications](https://docs.spring.io/spring-boot/3.5/reference/testing/spring-boot-applications.html)
- [Testcontainers：JUnit 5 Integration](https://java.testcontainers.org/test_framework_integration/junit_5/)
- [JUnit 5.12.2：Timeout](https://docs.junit.org/5.12.2/api/org.junit.jupiter.api/org/junit/jupiter/api/Timeout.html)

JUnit 片段仅表达教学判据，本文没有配套测试工程，未执行真实 HTTP、数据库、容器、独立进程恢复或模型评测，未把设计清单写成已通过的测试结果。
