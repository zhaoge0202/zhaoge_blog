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

## 模型基础与输出

先理解Token、注意力和推理，再判断输出约束及微调的适用条件。

- [大模型到底怎么调、Token 和上下文窗口怎么算？](./ai-llm-basis.html) - Token、上下文窗口、采样参数和调用工程，把大模型调用讲清。
- [Attention 怎样利用上下文，位置编码解决什么问题？](./ai-transformer-attention.html) - 从一次工单问答理解注意力、因果遮罩、位置编码与生成边界。
- [大模型为什么首字慢，后续生成也会慢？](./ai-llm-inference-latency.html) - 从推理阶段、缓存与队列拆解模型首字延迟和输出速率。
- [Prompt 工程和结构化输出怎么落地？](./ai-prompt-structured-output.html) - Prompt 技巧、JSON 契约和 Function Calling，把结构化输出讲透。
- [什么时候需要微调，Prompt、RAG 和微调怎么选？](./ai-fine-tuning-decision.html) - 从知识时效、任务行为与成本判断提示词、检索和微调的分工。
- [SFT 和 LoRA 怎样准备数据，怎么验证训练有没有用？](./ai-fine-tuning-data-evaluation.html) - 围绕监督数据、参数适配与独立验证构建可核查的微调流程。

## RAG 与证据处理

从文档、表格和图片形成证据，再检查检索、生成与更新链路。

- [RAG 从切分到召回怎么做才不翻车？](./ai-rag.html) - 切分、向量库、召回、重排和评测，RAG 全链路怎么不翻车。
- [Embedding 和 Reranker 有什么区别，怎样用业务样本选型？](./ai-embedding-reranker.html) - 用业务证据说明语义编码、交互重排与检索模型的选型验证。
- [PDF、OCR 和正文怎样变成可引用的 RAG 证据？](./ai-rag-document-parsing.html) - 从阅读顺序、页码与标定样例建立文档解析的证据质量链路。
- [表格和 Excel 怎样保住字段关系，并支持可靠查询？](./ai-rag-table-evidence.html) - 保留表格的表头、单位与行列关系，验证检索和结构化计算。
- [图片和图表怎样进入知识库，回答时如何回查原图？](./ai-rag-visual-evidence.html) - 区分文字识别、视觉描述与图文检索，保留能回查的原图证据。
- [RAG 答错了，怎么区分召回、排序和生成问题？](./ai-rag-retrieval-diagnosis.html) - 用固定问集和黄金证据定位检索、上下文与生成失败。
- [知识库改版或撤权后，RAG 为什么还会答旧内容？](./ai-rag-index-lifecycle.html) - 用文档版本、索引发布和权限复核解释知识库更新链路。

## Agent 运行与治理

按运行、上下文、记忆、恢复、技能、协作和评测串起任务过程。

- [Agent、工具调用、多轮编排怎么搭？](./ai-agent-tools.html) - Agent Loop、工具注册、MCP 和多轮编排，搭一个能收敛的 Agent。
- [Agent 的一次运行怎样从模型走到工具再回到模型？](./ai-agent-runtime-loop.html) - 用工单查询串起流式工具调用、结果回填与运行停止条件。
- [Agent 上下文怎么装配，历史太长时怎么压缩？](./ai-agent-context-engineering.html) - 用可核算的模型预算说明证据装配、上下文压缩与恢复。
- [Agent 怎样记住用户偏好，并在之后更新或删除？](./ai-agent-memory.html) - 从作用域、来源和版本设计跨会话记忆的读写与撤销。
- [Agent 跑到一半中断，工作流怎样接着执行？](./ai-agent-workflow-recovery.html) - 用工单流程讲清节点状态、暂停恢复与外部操作防重。
- [Agent Skills 怎样按需加载，执行约束由谁保证？](./ai-agent-skills-harness.html) - 以工单分诊说明技能发现加载、工具权限和可验证的执行环境。
- [一个 Agent 不够用时，什么时候值得拆成多个？](./ai-agent-coordination.html) - 从依赖、状态隔离和结果合并判断多 Agent 协作是否划算。
- [怎么评测 Agent 真的完成了任务？](./ai-agent-evaluation.html) - 用可重置的测试环境验证业务终态、工具轨迹与成功稳定性。

## Agent 执行安全

解释不可信输入如何影响动作，以及执行环境和供应链怎样保持边界。

- [提示注入和工具投毒怎样影响 Agent，运行时如何限制后果？](./ai-agent-prompt-injection.html) - 沿间接注入和工具描述入口检查信任边界与服务端执行约束。
- [代码工具怎样限制文件、进程、凭据和网络出口？](./ai-agent-sandbox-isolation.html) - 从文件、进程、凭据和网络限制理解代码工具的实际隔离边界。
- [接入第三方工具和 Skill 后，怎样管理版本、权限与供应链？](./ai-agent-tool-supply-chain.html) - 用来源、版本、变更回归和撤销管理第三方工具与技能风险。

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

从网关、部署和观测，走到框架接入、流式输出、业务工具与上线治理。

- [AI 应用工程化、网关和成本怎么控？](./ai-application-engineering.html) - 网关路由、限流降级、评测闭环和成本控制，AI 应用怎么上生产。
- [模型服务怎样部署，并验证容量与过载行为？](./ai-model-serving.html) - 按版本与负载复现部署、容量测量和过载拒绝的验证过程。
- [一条 Agent Trace 怎样串起检索、工具、模型和费用？](./ai-agent-observability.html) - 从示例执行记录串联检索、工具、模型、耗时与费用的观测。
- [Java 后端怎么接大模型？Spring AI、LangChain4j 和直连 HTTP 怎么选？](./ai-java-integration-stack.html) - 从三条接入路线、抽象层设计到超时重试与密钥合规，讲清 AI 能力在 Java 侧的落地。
- [大模型流式输出怎么落到后端？SSE 为什么会卡住不出字？](./ai-streaming-sse-backend.html) - 从 SSE 协议、两种 Spring 实现到六层缓冲的排障顺序，讲清流式输出的落地与坑。
- [Function Calling 调内部接口要注意什么？写操作怎么防止被模型乱调？](./ai-tool-calling-business-api.html) - 从身份、校验、写操作确认到幂等与审计，讲清工具调用接业务接口的工程约束。
- [模型很慢，长任务怎么设计？状态机、回调和补偿怎么摆？](./ai-async-task-pipeline.html) - 从任务状态机、租约与幂等到分段超时与预算，讲清 AI 长任务的异步工程设计。
- [AI 功能怎么灰度、怎么评测、怎么兜底？](./ai-feature-rollout-guard.html) - 从灰度维度、评测准入到兜底矩阵与合规成本，讲清 AI 功能上线的工程闭环。

## Java 应用设计

通过接口、工具、状态、事务和测试片段，将前面的原则放回Java应用设计。

- [Java 工单 Agent 的接口与模块应怎样划分？](./ai-agent-java-project.html) - 用工单场景说明Java应用中的模型、工具、状态与接口边界。
- [Java Agent 怎样组织知识证据与工具调用？](./ai-agent-java-knowledge-tools.html) - 从一轮工单查询说明证据注入、调用标识和Java工具执行边界。
- [Java Agent 的审批与恢复怎样落到状态和事务？](./ai-agent-java-approval-recovery.html) - 以状态表和事务边界解释Java任务的可信确认、恢复与业务幂等。
- [Java Agent 的测试怎样分层并覆盖关键故障？](./ai-agent-java-evaluation.html) - 围绕模型替身、接口和业务终态设计Java应用的分层验收。

## 后续可以扩展的方向

- 实时语音Agent的首音、打断和迟到音频。
- A2A与跨运行时任务、状态和身份互操作。
- Computer Use、图结构检索与更深入的模型训练方法。
