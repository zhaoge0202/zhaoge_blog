---
title: "Java Agent 的审批与恢复怎样落到状态和事务？"
description: "以状态表和事务边界解释Java任务的可信确认、恢复与业务幂等。"
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
    text: "Java Agent 怎样组织知识证据与工具调用？",
    link: "/ai/ai-agent-java-knowledge-tools.html",
  }
next:
  { text: "Java Agent 的测试怎样分层并覆盖关键故障？", link: "/ai/ai-agent-java-evaluation.html" }
---

# Java Agent 的审批与恢复怎样落到状态和事务？

> 把草稿、确认与业务执行分别建模，状态更新控制执行权，业务唯一约束保护副作用，恢复再核实真实终态。

## 升级一张工单，为什么要拆开三个服务职责？

假设 alice 要升级本人工单 T-1048，当前状态为 `WAITING_VENDOR`。模型可以整理目标团队和理由，但需要由可信入口确认实际草稿，才能提交升级。
用户可能稍后才确认，进程也可能在业务提交后、任务记录更新前退出。

| 服务职责  | 处理内容                               | 事务安排                           |
| --------- | -------------------------------------- | ---------------------------------- |
| `prepare` | 查询证据，生成并校验草稿，保存等待状态 | 模型调用在事务外，保存草稿用短事务 |
| `confirm` | 核验调用者与草稿，记录确认并取得执行权 | 确认记录与任务条件更新保持原子性   |
| `execute` | 复核前提，创建升级并记录业务操作结果   | 本地业务变更与防重记录在同一事务   |

长模型调用放进数据库事务，会延长连接和锁的占用，超时后也不能回滚已经完成的远程动作。
协调层可以保持非事务调用，分别委托持久化与业务服务处理短事务。
任务通用结构见[可恢复工作流](./ai-agent-workflow-recovery.html)，这里具体讨论 Java 与数据库边界。

## 任务、审批和操作记录分别需要哪些字段？

任务记录保存 `runId`、可信租户与用户、`phase`、`stateVersion` 和草稿版本。审批记录绑定操作号、动作类型、目标工单、参数摘要、工单版本、确认人、确认时间与有效期。
业务操作记录保存幂等键、参数摘要、处理状态和结果引用。

参数摘要应基于确定的字段规范生成，覆盖目标、动作、金额或团队等关键参数。
只对任意 JSON 原文计算哈希，可能因字段顺序而变化，也可能遗漏服务端默认补上的含义。
摘要帮助校验一致性，不能代替身份验证和受保护的审批记录。

`operationId` 在同一业务意图的重试中保持稳定。
它不能在每次恢复时重新生成，也不能因为模型提出“用户已同意”就取得审批状态。
授权绑定的整体设计见[业务工具约束](./ai-tool-calling-business-api.html)。

## 两次确认同时到达，怎样只让一个推进任务？

确认接口先从可信主体定位草稿，核对参数、对象版本、期限和实际确认动作。
在同一短事务中保存确认，并通过状态和版本完成条件更新。
下面省略建表与参数绑定，只展示争取执行权的 SQL 形状。

```sql
UPDATE agent_run
SET phase = 'EXECUTING', state_version = state_version + 1
WHERE run_id = :runId
  AND tenant_id = :trustedTenantId
  AND owner_id = :trustedUserId
  AND phase = 'WAITING_USER'
  AND state_version = :expectedVersion;
```

影响一行表示这个预期状态被当前请求推进，零行则重新读取当前状态。
它可能已经被确认、取消或完成，不能把所有零行都当成成功，也不能无条件覆盖状态。
CAS 保护的是任务状态迁移，审批有效性和业务操作防重仍需各自校验。

事务提交后的执行触发可用可靠投递或恢复扫描衔接，不能只依赖一段内存回调。
执行器崩溃后的重新接管还需状态版本或租约保护，相关调度边界沿用[长任务设计](./ai-async-task-pipeline.html)。

## 业务操作号怎样落成数据库约束？

下面是一份教学用的操作表片段，不是完整迁移脚本。
所有幂等键组成字段都不可为空，避免空值语义削弱预期约束。

```sql
CREATE TABLE agent_operation (
    tenant_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    operation_id VARCHAR(64) NOT NULL,
    owner_id VARCHAR(64) NOT NULL,
    args_digest CHAR(64) NOT NULL,
    state VARCHAR(24) NOT NULL,
    result_ref VARCHAR(128),
    PRIMARY KEY (tenant_id, action_type, operation_id)
);
```

重复请求先按当前主体检查对象可见性，再比较原参数摘要。
同一键、同一参数已经成功时返回原结果，仍在处理时返回处理中或有限等待。
同一键改参数应返回明确冲突，不能静默复用原授权。

“先查询没有记录，再插入”仍有并发间隙，最终需要唯一约束。
发生唯一键冲突时不能直接返回成功，应让失败事务正确结束，再在有效的新边界查询原状态。
不同数据库与持久化框架对失败事务和异常的处理不同，不能在已标记回滚的事务里继续假装提交。
更完整的重复请求处理见[接口幂等](../high-availability/high-availability-idempotency-design.html)。

## Spring 事务方法应该放在哪里？

下面省略字段与构造注入，只画出事务职责，类型、仓储和异常映射由应用实现。假定操作记录与升级记录使用同一事务管理器控制的数据库，协调层通过 Spring 注入的另一个 Bean 调用。

```java
@Service
public class UpgradeService {
    @Transactional
    public UpgradeResult execute(ConfirmedIntent intent) {
        var ticket = tickets.lockVisible(intent.subject(), intent.ticketId());
        guard.requireValidApprovalAndVersion(intent, ticket);
        operations.insertRunning(intent.key(), intent.argsDigest());
        var result = tickets.createEscalation(intent);
        operations.markSucceeded(intent.key(), result.id());
        return result;
    }
}
```

`ConfirmedIntent` 应由可信服务层根据审批记录构造，不是把模型传来的字段改名后直接反序列化。
锁定与业务校验在事务内再次确认当前版本和权限，避免确认之后对象已经变化。
本例抛出错误时，业务写入与操作结果应按配置一起回滚，仍需核对异常类型及回滚规则。

Spring 默认代理模式中，同类直接调用这个方法不会触发该方法的事务增强。
如果外层已有事务，可能只是沿用外层边界，不能据此认为开启了独立事务。
可以拆到独立 Bean，也可使用 `TransactionTemplate` 显式包住短数据库操作，详见[Spring 事务失效](../system-design/framework/spring-transaction-failure-cases.html)。

`REQUIRES_NEW` 表示独立的物理事务，不自动提供恰好执行一次的语义。
它还会影响连接占用和锁等待，不能代替操作号、唯一约束或跨系统结果查询。

## 业务提交了，检查点没写成功，恢复时怎样判断？

假设业务事务已经保存升级记录和 `SUCCEEDED` 操作结果，随后工作流写检查点前进程退出。
任务可能仍显示 `EXECUTING`，但新升级工单确实存在。
业务事务与检查点分别提交时，即使使用同一数据库，也可能有这个间隙。

恢复者先取得适当执行权，并重新检查当前主体对任务与结果的访问范围。
再按原操作号查询业务终态，成功则引用原结果补齐检查点。
不能只根据旧任务阶段再次创建，也不能因为旧审批现在过期，就把已提交业务当成没发生。

尚未执行的操作则需要重新检查审批期限、草稿摘要、工单版本和业务前提。
参数变化后重新展示并确认，取消或撤回不能被旧恢复请求重新打开。
未取得可靠终态时保留结果未知，并按业务规则查询或对账。

本地操作记录和变更放进同一事务，可以保护这一提交域。
下游若还有外部服务，需要稳定的下游操作号、查询与回调等机制，单个 Spring 事务不能回滚另一系统已经完成的动作。

## 怎样验证设计覆盖了真正的故障窗口？

测试思路分别覆盖并发确认、过期审批、同键改参数和业务提交后丢失检查点，检查升级记录数、操作号、参数摘要、审批版本与任务终态，避免只断言接口返回“成功”。
事务测试还要验证调用确实经过代理，回滚规则与所用数据库一致，不能只看注解存在。
分层测试如何组织，继续看[Java Agent 测试](./ai-agent-java-evaluation.html)。

## 小结

1. 准备、确认和执行有不同职责，长模型调用在数据库事务外完成。
2. 审批绑定可信主体、参数、对象版本与期限，CAS 只负责预期状态的迁移。
3. 稳定业务键、参数一致性与唯一约束共同防重，重复时按真实处理状态返回。
4. Spring 代理和回滚规则决定事务是否生效，`REQUIRES_NEW` 不提供外部恰好执行一次。
5. 业务提交与检查点之间可能存在窗口，恢复先查询业务终态，再判断是否需要继续执行。

## 参考

综合站内工作流恢复、工具调用安全、接口幂等和 Spring 事务资料，于 2026-11-20 核对以下官方说明。
LangGraph 暂停文档仅用于核对“恢复可能重新进入节点”的机制，不将其具体 API 套到 Java 服务。

- [Spring：声明式事务与代理边界](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)
- [Spring：事务传播行为](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)
- [Spring：编程式事务管理](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html)
- [H2：数据库特性、锁与恢复](https://h2database.com/html/features.html)
- [LangGraph：Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)

SQL 与 Java 片段用于解释职责和边界，本文未执行建表、启动 Spring 服务或验证数据库故障恢复，也不提供独立示例工程。
