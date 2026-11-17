---
title: "工程与交付"
description: "工程与交付专题，讲需求调研、设计文档、接口契约、测试实操、CI/CD 发布、协作与技术债治理。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "采集数据怎么变成报表和结算单？指标链路怎么对齐？"
  link: "/energy/energy-data-pipeline.html"
next:
  text: "需求调研和可行性分析怎么做到位？"
  link: "/engineering/engineering-requirements-feasibility.html"
---

# 工程与交付

这一栏讲的是"写代码之外、但决定项目能不能验收、能不能持续交付"的那部分能力：把客户口述的诉求变成可验证的需求、把设计写成别人能接手改的文档、让前后端联调少返工、把测试写在真会出错的地方、把制品稳稳地发上线又能在出事时退回来、把技术债和线上缺陷当成工程问题而不是态度问题。

定制项目里，技术方案的差距通常不大，**差距在过程和交付**——需求没对齐、文档没落地、验收没证据，最后都在现场返工。

## 知识主线

```text
需求与设计（调研、可行性、设计文档、用户故事与验收、接口体验）
  → 骨架与联调（工程骨架、接口契约、测试策略、单测、集成测试）
  → 交付与发布（交付文档、CI/CD 流水线、发布策略与回滚）
  → 协作与治理（跨团队推动、技术债与重构、缺陷 RCA 复盘）
```

## 题目列表

### 需求与设计

- [需求调研和可行性分析怎么做到位？](./engineering-requirements-feasibility.html) - 调研清单、可行性六维度、范围与变更控制。
- [概要设计、详细设计要写到什么程度？](./engineering-design-docs.html) - 模块划分、接口清单、状态机、字段字典与变更记录。
- [需求怎么细化成可验收的条目？用户故事和验收标准怎么写？](./engineering-user-story-ac.html) - 用户故事的局限、Given/When/Then 验收标准、把形容词换成数字。
- [后端也要懂体验：接口怎么设计才不折腾前端？](./engineering-backend-api-experience.html) - 延迟与分页、金额与时区、错误码与幂等提交、降级与反馈闭环。

### 骨架与联调

- [从 0 搭一个可交付的 Spring Boot 多模块工程，骨架里该有哪些东西？](./engineering-project-scaffold.html) - 模块划分、统一出口、横切能力、可观测与交付物清单。
- [前后端联调怎么少返工？](./engineering-api-contract-testing.html) - 接口契约、字段口径、错误码、跨域与排障顺序。
- [Java 项目的测试怎么写才不白写？](./engineering-testing-strategy.html) - 分层测试、Mock 边界、H2 的坑与回归冒烟。
- [单元测试怎么写才不是自嗨？JUnit 5 和 Mockito 的边界在哪？](./engineering-unit-test-junit5.html) - 测试结构、参数化与断言、Mock 的边界与严格桩、反模式。
- [集成测试怎么跑得像线上？Testcontainers 和契约测试怎么摆？](./engineering-integration-test-testcontainers.html) - 真库测试、容器复用与耗时治理、消费者驱动契约。

### 交付与发布

- [交付文档到底要交哪些？](./engineering-delivery-docs.html) - 部署手册、运维手册、验收证据、培训与交接清单。
- [CI/CD 流水线怎么设计？制品怎么晋级、怎么回滚？](./engineering-cicd-pipeline.html) - 不可变制品、分层流水线与反馈速度、数据库变更、回滚演练。
- [滚动、蓝绿、金丝雀怎么选？回滚要准备什么？](./engineering-container-release.html) - 发布方式取舍、优雅停机与探针配合、回滚三件套、发布检查清单。

### 协作与治理

- [跨团队怎么对齐、怎么推动？](./engineering-cross-team-collaboration.html) - 把口头约定变成可验证物、风险前置、把问题变成选择题、会议与决策记录。
- [技术债怎么量化、怎么还？遗留系统从哪里下刀？](./engineering-tech-debt-refactor.html) - 债务分类与量化、偿还节奏、绞杀者与防腐层、安全重构步骤。
- [线上缺陷怎么复盘？RCA 写到什么程度才有用？](./engineering-defect-rca.html) - 定级与止血、5 Whys 与时间线、复盘文档结构与可验收的改进项。
