---
title: "AI 应用开发"
description: "系统理解模型原理、RAG证据、Agent运行与安全、MCP和Java应用设计。"
article: false
breadcrumb: true
editLink: false
next:
  text: "大模型到底怎么调、Token 和上下文窗口怎么算？"
  link: "/ai/ai-llm-basis.html"
---

# AI 应用开发

面向后端开发者，先理解模型怎样处理输入，再学习证据、Agent运行和业务接入。
推荐按“模型基础 → RAG与证据 → Agent运行 → 执行安全 → MCP → 应用工程 → Java设计”阅读，也可以按具体问题查阅。

## 面试怎么复习

用这 16 道题做自测。先用自己的话答一遍，再用后半句检查能不能说清工程取舍。按目标岗位选择知识库或 Agent 方向加练。

### AI 应用基础

1. **一次模型请求要给输入和输出各留多少 Token？** 追问检索结果、历史消息和工具定义都要怎样计入预算。 [模型调用与上下文](./ai-llm-basis.html)
2. **Java 业务服务怎样选择接入方式？** 追问供应商换版时，哪些接口要由自己的应用层掌握。 [Java 接入选型](./ai-java-integration-stack.html)
3. **用户等不到第一个字，从哪里开始查？** 追问怎样分开测量服务端排队、模型首字和下游缓冲。 [推理耗时](./ai-llm-inference-latency.html) · [SSE 排障](./ai-streaming-sse-backend.html)
4. **新模型单次调用更便宜，值得替换吗？** 追问用同一批工单怎样比较成功率、重试开销和每次成功的成本。 [业务模型选型](./ai-business-model-selection.html)

### RAG 与知识库

5. **怎样设计一个跨团队的企业知识库？** 追问文档规模怎样影响容量，答案怎样引用到原文，读权限由谁决定。 [企业知识库系统设计](./ai-enterprise-knowledge-base-design.html)
6. **检索已经命中，为什么还是答错？** 追问怎样验证例外条款是否进入候选、重排结果和模型上下文。 [RAG 故障定位](./ai-rag-retrieval-diagnosis.html)
7. **租户明明有足够多的文档，为什么向量查询只返回几条？** 追问怎样用精确近邻和执行计划验证召回损失。 [向量索引调优](./ai-pgvector-filtered-recall.html)
8. **索引更新延迟时，怎样让撤权仍然生效？** 追问旧索引、答案缓存和引用下载各在哪一层复核授权。 [知识库更新与撤权](./ai-rag-index-lifecycle.html)

### Agent 与上线

9. **模型给出的工具参数已经合法，后端还要检查什么？** 追问谁可以操作这笔业务，用户什么时候要确认。 [业务工具调用](./ai-tool-calling-business-api.html)
10. **用户确认后服务崩溃，怎样恢复且避免重复写入？** 追问如何区分调用还没发生与调用结果未知。 [Java Agent 的审批与恢复](./ai-agent-java-approval-recovery.html)
11. **远程 MCP 已经拿到 Token，为什么还可能越权？** 追问令牌受众、工具权限和业务资源权限分别由谁验证。 [MCP 授权](./ai-mcp-authorization.html)
12. **新版本平均分更高，为什么 CI 还要拦住？** 追问怎么用业务终态和关键分组判断能不能发布。 [评测发布门槛](./ai-eval-ci-release-gates.html)

### 模型能力与实施

13. **模型自报 95% 把握，能直接据此执行吗？** 追问 Token 概率、事实校准与授权各自能证明什么。 [幻觉与拒答](./ai-hallucination-abstention.html)
14. **输出很短，为什么仍消耗大量生成预算？** 追问推理 Token、无可见答案的截断和任务总预算。 [推理模型预算](./ai-reasoning-model-budget.html)
15. **同一道题换模型后答得不同，怎样判断谁更好？** 追问证据、权限、时间与初始业务状态应该怎样冻结。 [评测集设计](./ai-evaluation-dataset.html)
16. **Java Agent 的模块已经划分好，第一步先接什么？** 追问只读、证据、确认和恢复各阶段需要哪些验收依据。 [分阶段接入](./ai-agent-java-delivery.html)

## 模型基础与输出

先理解 Token、注意力与训练路线，再学习推理预算、事实边界、输出约束和微调的适用条件。

- [大模型到底怎么调、Token 和上下文窗口怎么算？](./ai-llm-basis.html) - Token、上下文窗口、采样参数和调用工程，把大模型调用讲清。
- [Attention 怎样利用上下文，位置编码解决什么问题？](./ai-transformer-attention.html) - 从一次工单问答理解注意力、因果遮罩、位置编码与生成边界。
- [预训练、后训练、偏好优化和蒸馏分别改变什么？](./ai-training-alignment-distillation.html) - 按目标、数据和模型制品理解训练路线，区分 SFT、LoRA、RLHF、DPO 与蒸馏。
- [大模型为什么首字慢，后续生成也会慢？](./ai-llm-inference-latency.html) - 从推理阶段、缓存与队列拆解模型首字延迟和输出速率。
- [推理模型的思考预算、输出上限和调用状态怎样管理？](./ai-reasoning-model-budget.html) - 区分思考档位、生成额度与任务时限，处理截断、续接和无可见输出。
- [模型为什么会自信地答错，什么时候该追问或拒答？](./ai-hallucination-abstention.html) - 从证据与概率校准理解幻觉，同时衡量回答覆盖率、错误风险和误拒。
- [Prompt 工程和结构化输出怎么落地？](./ai-prompt-structured-output.html) - Prompt 技巧、JSON 契约和 Function Calling，把结构化输出讲透。
- [什么时候需要微调，Prompt、RAG 和微调怎么选？](./ai-fine-tuning-decision.html) - 从知识时效、任务行为与成本判断提示词、检索和微调的分工。
- [SFT 和 LoRA 怎样准备数据，怎么验证训练有没有用？](./ai-fine-tuning-data-evaluation.html) - 围绕监督数据、参数适配与独立验证构建可核查的微调流程。

## RAG 与证据处理

从文档、表格和图片取得证据，再检查查数口径、检索质量和知识更新。

- [RAG 从切分到召回怎么做才不翻车？](./ai-rag.html) - 切分、向量库、召回、重排和评测，RAG 全链路怎么不翻车。
- [Embedding 和 Reranker 有什么区别，怎样用业务样本选型？](./ai-embedding-reranker.html) - 用业务证据说明语义编码、交互重排与检索模型的选型验证。
- [PDF、OCR 和正文怎样变成可引用的 RAG 证据？](./ai-rag-document-parsing.html) - 从阅读顺序、页码与标定样例建立文档解析的证据质量链路。
- [表格和 Excel 怎样保住字段关系，并支持可靠查询？](./ai-rag-table-evidence.html) - 保留表格的表头、单位与行列关系，验证检索和结构化计算。
- [自然语言查数怎样对齐指标口径、权限和结果？](./ai-natural-language-analytics.html) - 从一句业务问题生成受控查询计划，用固定数据核对权限、时区和聚合结果。
- [图片和图表怎样进入知识库，回答时如何回查原图？](./ai-rag-visual-evidence.html) - 区分文字识别、视觉描述与图文检索，保留能回查的原图证据。
- [RAG 答错了，怎么区分召回、排序和生成问题？](./ai-rag-retrieval-diagnosis.html) - 用固定问集和黄金证据定位检索、上下文与生成失败。
- [向量索引加了租户过滤，为什么凑不齐 Top K？](./ai-pgvector-filtered-recall.html) - 用相同租户条件比较精确近邻和近似索引，检查候选数量、召回和查询计划。
- [知识库改版或撤权后，RAG 为什么还会答旧内容？](./ai-rag-index-lifecycle.html) - 用文档版本、索引发布和权限复核解释知识库更新链路。
- [GraphRAG 什么时候值得用，怎样验证图检索带来的收益？](./ai-rag-graph-retrieval.html) - 用多跳证据和固定对照理解图检索的收益、更新成本与授权边界。

## Agent 运行与治理

按运行、上下文、记忆、恢复、技能、协作和评测串起任务过程。

- [Agent、工具调用、多轮编排怎么搭？](./ai-agent-tools.html) - Agent Loop、工具注册、MCP 和多轮编排，搭一个能收敛的 Agent。
- [Agent 的一次运行怎样从模型走到工具再回到模型？](./ai-agent-runtime-loop.html) - 用工单查询串起流式工具调用、结果回填与运行停止条件。
- [Agent 上下文怎么装配，历史太长时怎么压缩？](./ai-agent-context-engineering.html) - 用可核算的模型预算说明证据装配、上下文压缩与恢复。
- [Agent 怎样记住用户偏好，并在之后更新或删除？](./ai-agent-memory.html) - 从作用域、来源和版本设计跨会话记忆的读写与撤销。
- [Agent 跑到一半中断，工作流怎样接着执行？](./ai-agent-workflow-recovery.html) - 用工单流程讲清节点状态、暂停恢复与外部操作防重。
- [Agent Skills 怎样按需加载，执行约束由谁保证？](./ai-agent-skills-harness.html) - 以工单分诊说明技能发现加载、工具权限和可验证的执行环境。
- [一个 Agent 不够用时，什么时候值得拆成多个？](./ai-agent-coordination.html) - 从依赖、状态隔离和结果合并判断多 Agent 协作是否划算。
- [A2A 怎样跨服务委托任务、校验身份和跟踪状态？](./ai-a2a-delegation.html) - 沿两个服务之间的委托链理解身份范围、任务状态、续跟踪与幂等。
- [怎么评测 Agent 真的完成了任务？](./ai-agent-evaluation.html) - 用可重置的测试环境验证业务终态、工具轨迹与成功稳定性。

## Agent 执行安全

解释不可信输入如何影响动作，以及执行环境和供应链怎样保持边界。

- [提示注入和工具投毒怎样影响 Agent，运行时如何限制后果？](./ai-agent-prompt-injection.html) - 沿间接注入和工具描述入口检查信任边界与服务端执行约束。
- [代码工具怎样限制文件、进程、凭据和网络出口？](./ai-agent-sandbox-isolation.html) - 从文件、进程、凭据和网络限制理解代码工具的实际隔离边界。
- [接入第三方工具和 Skill 后，怎样管理版本、权限与供应链？](./ai-agent-tool-supply-chain.html) - 用来源、版本、变更回归和撤销管理第三方工具与技能风险。
- [Computer Use Agent 怎样操作界面，并确认动作真的成功？](./ai-agent-computer-use.html) - 用界面观察、受控执行与结果复核验证操作，处理页面变化与结果未知。

## MCP 协议与工程实践

按2026-07-28规范讲清接入、原语、请求、传输、授权与排障，明确旧协议差异。

- [MCP 解决什么问题，和 Function Calling、Agent、Skill 有什么关系？](./ai-mcp-architecture.html) - 从订单助手的接入链路讲清 MCP 的架构、职责边界与选型依据。
- [MCP 的 Tools、Resources、Prompts 应该怎么区分？](./ai-mcp-primitives.html) - 用订单助手理解 MCP 三类原语、输入输出契约与上下文边界。
- [MCP 如何发现能力、处理请求，并兼容新旧协议？](./ai-mcp-lifecycle.html) - 讲清 MCP 新旧版本的能力发现、请求元数据与协议兼容机制。
- [MCP 的 stdio 和 Streamable HTTP 有什么区别？](./ai-mcp-transports.html) - 从进程和 HTTP 链路理解 MCP 传输、流式响应与断线边界。
- [远程 MCP 如何认证授权，为什么有 Token 仍会越权？](./ai-mcp-authorization.html) - 沿远程调用链讲清 MCP 授权发现、令牌受众与租户隔离边界。
- [Java 后端如何把业务接口封装成 MCP Server？](./ai-mcp-java-server.html) - 用只读订单查询串起 Java MCP 工具注册、身份注入与验证流程。
- [MCP 工具不出现、调用超时和重复执行时怎么排查？](./ai-mcp-troubleshooting.html) - 按链路定位 MCP 故障，分清协议错误、工具失败与业务幂等。

## AI 能力接入业务系统

从网关、部署和观测，走到 Java 接入、流式交互、业务工具与发布门槛。

- [AI 应用工程化、网关和成本怎么控？](./ai-application-engineering.html) - 网关路由、限流降级、评测闭环和成本控制，AI 应用怎么上生产。
- [模型服务怎样部署，并验证容量与过载行为？](./ai-model-serving.html) - 按版本与负载复现部署、容量测量和过载拒绝的验证过程。
- [模型权重和 KV Cache 怎样估算显存，量化能省多少？](./ai-model-memory-quantization.html) - 用限定假设下的算例拆分权重、缓存和运行时开销，解释量化与多卡容量边界。
- [一条 Agent Trace 怎样串起检索、工具、模型和费用？](./ai-agent-observability.html) - 从示例执行记录串联检索、工具、模型、耗时与费用的观测。
- [Java 后端怎么接大模型？Spring AI、LangChain4j 和直连 HTTP 怎么选？](./ai-java-integration-stack.html) - 从三条接入路线、抽象层设计到超时重试与密钥合规，讲清 AI 能力在 Java 侧的落地。
- [大模型流式输出怎么落到后端？SSE 为什么会卡住不出字？](./ai-streaming-sse-backend.html) - 从 SSE 协议、两种 Spring 实现到六层缓冲的排障顺序，讲清流式输出的落地与坑。
- [两个模型都说兼容，网关切流量为什么会失败？](./ai-llm-provider-contracts.html) - 用契约验收模型能力、流式切换和每次调用的用量。
- [业务模型怎么选，什么情况下值得换？](./ai-business-model-selection.html) - 在同一批工单上比较成功率、响应速度和成功完成任务的成本。
- [实时语音 Agent 怎样降低首音延迟，并处理打断后的旧音频？](./ai-realtime-voice-agent.html) - 量出用户听到的第一声，让打断、取消和迟到音频可追踪。
- [Function Calling 调内部接口要注意什么？写操作怎么防止被模型乱调？](./ai-tool-calling-business-api.html) - 从身份、校验、写操作确认到幂等与审计，讲清工具调用接业务接口的工程约束。
- [模型很慢，长任务怎么设计？状态机、回调和补偿怎么摆？](./ai-async-task-pipeline.html) - 从任务状态机、租约与幂等到分段超时与预算，讲清 AI 长任务的异步工程设计。
- [AI 功能怎么灰度、怎么评测、怎么兜底？](./ai-feature-rollout-guard.html) - 从灰度维度、评测准入到兜底矩阵与合规成本，讲清 AI 功能上线的工程闭环。
- [AI 评测集怎样保存证据、权限和状态，避免数据泄漏？](./ai-evaluation-dataset.html) - 组织用例、环境与评分依据，按来源切分并隔离每次尝试。
- [模型或 Prompt 变更后，CI 怎样用评测决定能不能发布？](./ai-eval-ci-release-gates.html) - 按同题对照和关键分组生成报告，验证该挡住的退步会挡住。

## Java 应用设计

用工单 Agent 练习接口、工具、审批和测试，再用企业知识库串起容量估算、文档授权和上线验收。

- [Java 工单 Agent 的接口与模块应怎样划分？](./ai-agent-java-project.html) - 用工单场景说明Java应用中的模型、工具、状态与接口边界。
- [Java Agent 怎样组织知识证据与工具调用？](./ai-agent-java-knowledge-tools.html) - 从一轮工单查询说明证据注入、调用标识和Java工具执行边界。
- [Java Agent 的审批与恢复怎样落到状态和事务？](./ai-agent-java-approval-recovery.html) - 以状态表和事务边界解释Java任务的可信确认、恢复与业务幂等。
- [Java Agent 的测试怎样分层并覆盖关键故障？](./ai-agent-java-evaluation.html) - 围绕模型替身、接口和业务终态设计Java应用的分层验收。
- [Java 工单 Agent 怎样分阶段接入，并定义每一步的验收？](./ai-agent-java-delivery.html) - 沿可信只读、模型工具、政策证据、确认写入和故障恢复组织实施步骤。
- [怎样设计一个能撤权、可追溯的企业知识库？](./ai-enterprise-knowledge-base-design.html) - 从面试题的规模和目标出发，设计入库、问答、撤权与故障验收链路。
