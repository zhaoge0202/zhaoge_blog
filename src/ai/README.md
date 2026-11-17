---
title: "AI 应用开发"
description: "AI 应用开发专题，讲后端如何把大模型接进业务：Prompt、RAG、Agent，到 Java 侧接入与上线兜底。"
article: false
breadcrumb: true
editLink: false
next:
  text: "大模型到底怎么调、Token 和上下文窗口怎么算？"
  link: "/ai/ai-llm-basis.html"
---

# AI 应用开发

后端工程师怎么把大模型接进业务：从 Prompt、RAG 到 Agent 与工程落地，再到把 AI 能力真正接进 Java 业务系统的那一段——流式输出、工具调用、异步长任务、灰度与兜底。作为知识库的外延方向，单独沉淀。

## 题目列表

- [大模型到底怎么调、Token 和上下文窗口怎么算？](./ai-llm-basis.html) - 调用大模型的底座，Token 和上下文窗口算清才能控成本和边界。
- [Prompt 工程和结构化输出怎么落地？](./ai-prompt-structured-output.html) - 把结构化输出靠约束 + 校验落地，而不是祈祷模型听话。
- [RAG 从切分到召回怎么做才不翻车？](./ai-rag.html) - 切分、向量库、召回、重排、评测全链路。
- [Agent、工具调用、多轮编排怎么搭？](./ai-agent-tools.html) - Agent Loop、工具注册、MCP、多轮编排，搭一个能收敛的 Agent。
- [AI 应用工程化、网关和成本怎么控？](./ai-application-engineering.html) - 从 Prompt Demo 到生产，网关、评测、成本、可观测。

## AI 能力接入业务系统

这一组补的是"模型能力怎么落进 Java 业务系统"：框架选型、流式输出、工具调用写业务接口、长任务异步化、上线灰度与兜底。

- [Java 后端怎么接大模型？Spring AI、LangChain4j 和直连 HTTP 怎么选？](./ai-java-integration-stack.html) - 三条接入路线、LlmGateway 抽象层、超时重试成本密钥与审计。
- [大模型流式输出怎么落到后端？SSE 为什么会卡住不出字？](./ai-streaming-sse-backend.html) - TTFT 与 SSE 协议、两种 Spring 实现、六层缓冲的排障顺序。
- [Function Calling 调内部接口要注意什么？写操作怎么防止被模型乱调？](./ai-tool-calling-business-api.html) - 身份、参数校验、写操作确认、幂等限额与审计。
- [模型很慢，长任务怎么设计？状态机、回调和补偿怎么摆？](./ai-async-task-pipeline.html) - 任务状态机、租约与幂等、分段超时、结果获取与任务预算。
- [AI 功能怎么灰度、怎么评测、怎么兜底？](./ai-feature-rollout-guard.html) - 灰度维度、评测准入、兜底矩阵、成本与数据合规。
