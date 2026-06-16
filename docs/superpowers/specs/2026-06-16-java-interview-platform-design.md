# Java 面试进阶平台设计文档

> 日期：2026-06-16
>
> 当前阶段：产品与系统设计
>
> 技术栈：公开站 Next.js，后台管理 Vue，服务端 Spring Boot，数据库 MySQL

## 1. 背景和定位

这个项目不是再做一个 Java 面试题搬运站，也不是单纯记录个人备战过程。它的定位是一个面向 3-5 年 Java 后端工程师的进阶面试准备平台：以专题知识库为主体，以独立题目页承载可检索内容，以作者的学习心路、资料纠偏、项目映射和回答取舍形成差异化。

核心判断：

- JavaGuide 和小林coding 都是重要参考资料，但不能原样拼接。
- 网站内容必须有自己的筛选标准、纠错机制和回答模板。
- 3-5 年用户关心的不是“会不会背”，而是“能不能讲深、能不能联系项目、能不能扛追问”。
- 作者心路历程不能变成独立碎碎念，而应该嵌入每个专题和题目，解释为什么这样组织、哪里容易错、自己如何修正理解。

## 2. 产品目标

V1 的目标是做出一个完整的内容生产和消费闭环：

- 管理后台可以维护专题、题目、追问、易错点、纠偏记录、项目映射和作者笔记。
- Spring Boot 服务端提供统一内容 API 和后台管理 API。
- Next.js 公开站可以展示首页、专题页、题目详情页和心路历程页。
- MySQL 保存结构化内容，支持发布状态、排序、标签和基础检索。
- 内容先聚焦并发、JVM、MySQL、Redis 四个进阶高频专题。

V1 不做这些内容：

- 不做用户注册、登录、收藏、评论、打卡社区。
- 不做 AI 问答。
- 不做复杂权限中心。
- 不做全文搜索引擎，先使用 MySQL 基础检索。
- 不做全量 Java 面试大而全题库。
- 不做在线刷题判题系统。

## 3. 用户画像

主用户是 3-5 年 Java 后端工程师，具备项目经验，准备跳槽或冲刺更高层级岗位。

用户典型问题：

- 知识点看过很多，但面试回答不够深。
- 会背结论，但解释不了底层设计原因。
- 项目和八股割裂，不能把 Redis、MySQL、并发、JVM 讲回自己的项目。
- 看 JavaGuide 和小林coding 时无法判断哪些是核心、哪些是辅助、哪些可能需要修正。
- 缺少追问链路，不知道面试官会从一个问题继续挖到哪里。

V1 需要优先满足这些用户诉求：

- 快速找到进阶高频专题。
- 对每道题看到标准回答、深度解释、追问链路、常见误区。
- 看到作者的判断和修正过程。
- 能把题目映射到真实项目表达。

## 4. 产品原则

### 4.1 内容原则

- 每个专题都必须回答“为什么这个专题重要”。
- 每道题都必须有独立 URL，方便搜索、分享和长期维护。
- 每道题不只给答案，还要给追问、误区、纠偏、项目映射。
- 引用外部资料时只记录来源和参考点，不复制原文。
- 当资料之间存在冲突或口径差异时，以“纠偏记录”明确说明采用哪种解释。
- 作者经历必须服务于知识理解，不能喧宾夺主。

### 4.2 产品原则

- 首页不做营销落地页，第一屏直接进入可用知识库。
- 专题是主入口，题目是最小可复用内容单元。
- 公开站优先服务阅读和检索，后台优先服务高效维护。
- 前后台共用一套 Spring Boot API，但接口按公开端和管理端分组。
- V1 宁可内容模型扎实，也不要功能摊太宽。

## 5. V1 范围

### 5.1 V1 专题

V1 只做四个专题：

- 并发
- JVM
- MySQL
- Redis

选择原因：

- 这是 3-5 年 Java 社招最核心的四个进阶模块。
- 这四个模块最容易体现深度、追问、误区和项目映射。
- 这四个模块能覆盖 JavaGuide 与小林coding 的主要优势区间。
- 这四个模块足够验证内容模型和前后台工作流是否成立。

### 5.2 V1 前台页面

- 首页：展示专题入口、精选题目、最新纠偏、作者进度。
- 专题列表页：展示所有专题和每个专题的进度、题目数、推荐学习顺序。
- 专题详情页：展示专题导言、学习路径、核心题目、追问地图、作者笔记。
- 题目详情页：展示问题、短回答、深度解释、追问、误区、纠偏、项目映射、参考资料。
- 心路历程页：按时间线展示作者准备过程、重要认知变化和内容修订记录。
- 搜索结果页：按关键词搜索专题和题目。

### 5.3 V1 后台页面

- 登录页：V1 可先用单管理员账号。
- 控制台：首页统计专题数、题目数、草稿数、最近更新。
- 专题管理：新增、编辑、排序、发布/下线专题。
- 题目管理：新增、编辑、筛选、发布/下线题目。
- 题目编辑页：维护回答、深度解释、追问、误区、纠偏、项目映射和参考资料。
- 标签管理：维护技术标签和难度标签。
- 心路历程管理：维护作者笔记和时间线条目。

## 6. 信息架构

### 6.1 公开站一级导航

- 首页
- 专题
- 题库
- 心路历程
- 关于

### 6.2 首页结构

首页第一屏应该直接暴露内容能力：

- 顶部导航
- 核心专题入口：并发、JVM、MySQL、Redis
- 精选进阶题：展示 6-8 道高价值题目
- 最新纠偏：展示最近更新的误区修正
- 作者备战进度：展示最近学习、修订、复盘记录
- 推荐学习路径：按 3-5 年社招准备顺序给出路径

首页不需要大段口号和空泛价值表达。

### 6.3 专题详情页结构

专题详情页是网站的核心组织页。

每个专题包含：

- 专题标题
- 专题定位：为什么 3-5 年必须掌握
- 学习前置：需要先懂哪些内容
- 知识主线：这个专题的核心脉络
- 追问地图：面试官可能如何逐层追问
- 核心题目列表：按推荐顺序排列
- 易错点集合：聚合该专题下高频误区
- 作者心路片段：作者在这个专题上的误判、修正、总结
- 参考资料：JavaGuide、小林coding、官方文档或源码入口

### 6.4 题目详情页结构

题目详情页是最小内容产品单元。

每道题包含：

- 问题标题
- 所属专题
- 难度
- 高频程度
- 推荐掌握程度
- 30 秒回答
- 2 分钟回答
- 深度解释
- 追问链路
- 常见错误答案
- 纠偏结论
- 项目映射
- 作者心路
- 参考资料
- 相关题目

题目详情页必须能独立被搜索引擎和用户访问。

## 7. 内容模型

### 7.1 核心实体

V1 使用以下核心实体：

- `Topic`：专题。
- `Question`：题目。
- `QuestionSection`：题目内容块。
- `FollowUpQuestion`：追问。
- `Misconception`：常见误区。
- `CorrectionNote`：纠偏记录。
- `ProjectMapping`：项目映射。
- `PersonalNote`：作者心路和学习记录。
- `ReferenceSource`：参考资料。
- `Tag`：标签。

### 7.2 Topic 字段

`Topic` 代表并发、JVM、MySQL、Redis 这类专题。

字段：

- `id`
- `slug`
- `title`
- `summary`
- `targetAudience`
- `whyImportant`
- `prerequisites`
- `knowledgeMap`
- `interviewFocus`
- `sortOrder`
- `status`
- `createdAt`
- `updatedAt`

状态：

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

### 7.3 Question 字段

`Question` 是最小可访问内容单元。

字段：

- `id`
- `topicId`
- `slug`
- `title`
- `summary`
- `difficulty`
- `frequency`
- `masteryLevel`
- `shortAnswer`
- `longAnswer`
- `deepDive`
- `answerStrategy`
- `sortOrder`
- `status`
- `publishedAt`
- `createdAt`
- `updatedAt`

难度：

- `BASIC`
- `INTERMEDIATE`
- `ADVANCED`
- `EXPERT`

频率：

- `LOW`
- `MEDIUM`
- `HIGH`
- `MUST_KNOW`

掌握要求：

- `READ`
- `EXPLAIN`
- `DEEP_EXPLAIN`
- `PROJECT_READY`

### 7.4 QuestionSection 字段

`QuestionSection` 用于扩展题目内容，避免题目表过大。

字段：

- `id`
- `questionId`
- `sectionType`
- `title`
- `content`
- `sortOrder`
- `createdAt`
- `updatedAt`

类型：

- `BACKGROUND`
- `PRINCIPLE`
- `SOURCE_CODE`
- `COMPARISON`
- `SCENARIO`
- `SUMMARY`

### 7.5 FollowUpQuestion 字段

字段：

- `id`
- `questionId`
- `questionText`
- `answerHint`
- `sortOrder`

### 7.6 Misconception 字段

字段：

- `id`
- `questionId`
- `wrongStatement`
- `whyWrong`
- `correctStatement`
- `sortOrder`

### 7.7 CorrectionNote 字段

纠偏记录用于记录来源冲突、资料错误、理解修正。

字段：

- `id`
- `questionId`
- `title`
- `problem`
- `correction`
- `evidence`
- `sourceType`
- `createdAt`
- `updatedAt`

来源类型：

- `JAVAGUIDE`
- `XIAOLIN`
- `OFFICIAL_DOC`
- `SOURCE_CODE`
- `PERSONAL_REVIEW`

### 7.8 ProjectMapping 字段

项目映射用于把八股题转成项目表达。

字段：

- `id`
- `questionId`
- `scenario`
- `projectTalkingPoint`
- `riskPoint`
- `interviewAnswer`
- `sortOrder`

### 7.9 PersonalNote 字段

作者心路可以挂在专题或题目上。

字段：

- `id`
- `topicId`
- `questionId`
- `noteType`
- `title`
- `content`
- `happenedOn`
- `sortOrder`
- `status`
- `createdAt`
- `updatedAt`

类型：

- `LEARNING_LOG`
- `MISUNDERSTANDING`
- `REVISION`
- `PROJECT_REFLECTION`
- `INTERVIEW_REFLECTION`

### 7.10 ReferenceSource 字段

字段：

- `id`
- `questionId`
- `topicId`
- `sourceName`
- `sourceUrl`
- `sourceType`
- `usageNote`
- `sortOrder`

### 7.11 Tag 字段

字段：

- `id`
- `name`
- `slug`
- `type`

类型：

- `TECH`
- `DIFFICULTY`
- `SCENARIO`

## 8. 后端设计

### 8.1 Spring Boot 模块划分

V1 采用单体应用，按业务包组织：

- `auth`：后台登录和管理员身份校验。
- `topic`：专题管理和公开查询。
- `question`：题目管理和公开查询。
- `tag`：标签管理。
- `note`：心路历程管理。
- `reference`：参考资料管理。
- `common`：统一响应、异常处理、分页、枚举。

### 8.2 API 分组

公开站 API：

- `GET /api/public/topics`
- `GET /api/public/topics/{slug}`
- `GET /api/public/questions`
- `GET /api/public/questions/{slug}`
- `GET /api/public/search`
- `GET /api/public/notes`

后台管理 API：

- `POST /api/admin/auth/login`
- `GET /api/admin/dashboard`
- `GET /api/admin/topics`
- `POST /api/admin/topics`
- `PUT /api/admin/topics/{id}`
- `PATCH /api/admin/topics/{id}/status`
- `GET /api/admin/questions`
- `POST /api/admin/questions`
- `PUT /api/admin/questions/{id}`
- `PATCH /api/admin/questions/{id}/status`
- `GET /api/admin/tags`
- `POST /api/admin/tags`
- `PUT /api/admin/tags/{id}`
- `GET /api/admin/notes`
- `POST /api/admin/notes`
- `PUT /api/admin/notes/{id}`

### 8.3 鉴权策略

V1 采用简单管理员登录：

- 后台登录成功后返回 JWT。
- 管理 API 需要 `Authorization: Bearer <token>`。
- 公开 API 不需要登录。
- 管理员账号先通过配置或初始化 SQL 创建。

### 8.4 数据访问

建议 V1 使用 Spring Data JPA 或 MyBatis Plus 二选一。

推荐 MyBatis Plus：

- 与国内 Spring Boot + MySQL 项目习惯更贴近。
- 后台 CRUD 更直接。
- SQL 可控，后续做复杂检索时更方便。

## 9. 前端设计

### 9.1 公开站 Next.js

公开站目标：

- 面向读者和搜索引擎。
- 优先静态渲染和 SEO。
- 题目页、专题页必须有清晰 URL。

推荐路由：

- `/`
- `/topics`
- `/topics/[slug]`
- `/questions`
- `/questions/[slug]`
- `/journey`
- `/search`
- `/about`

核心组件：

- `TopicNavigator`
- `QuestionList`
- `QuestionDetail`
- `FollowUpChain`
- `MisconceptionBlock`
- `CorrectionBlock`
- `ProjectMappingBlock`
- `PersonalNoteBlock`
- `ReferenceList`

### 9.2 后台管理 Vue

后台目标：

- 高效录入和修订内容。
- 清楚区分草稿、发布、归档。
- 题目编辑页要支持多内容块维护。

推荐路由：

- `/login`
- `/dashboard`
- `/topics`
- `/topics/new`
- `/topics/:id/edit`
- `/questions`
- `/questions/new`
- `/questions/:id/edit`
- `/tags`
- `/journey-notes`

核心组件：

- `AdminLayout`
- `TopicForm`
- `QuestionForm`
- `QuestionSectionEditor`
- `FollowUpEditor`
- `MisconceptionEditor`
- `CorrectionEditor`
- `ProjectMappingEditor`
- `ReferenceSourceEditor`
- `StatusBadge`

## 10. 数据库设计

V1 建议表：

- `topics`
- `questions`
- `question_sections`
- `follow_up_questions`
- `misconceptions`
- `correction_notes`
- `project_mappings`
- `personal_notes`
- `reference_sources`
- `tags`
- `question_tags`
- `admin_users`

### 10.1 关键索引

- `topics.slug` 唯一索引。
- `questions.slug` 唯一索引。
- `questions.topic_id` 普通索引。
- `questions.status` 普通索引。
- `questions.title` 普通索引。
- `tags.slug` 唯一索引。
- `personal_notes.happened_on` 普通索引。

### 10.2 slug 规则

slug 使用英文小写和短横线，例如：

- `java-concurrent-thread-pool`
- `jvm-g1-garbage-collector`
- `mysql-mvcc-read-view`
- `redis-cache-consistency`

slug 不使用中文，避免 URL 编码和 SEO 不稳定。

## 11. 内容生产工作流

每道题的生产流程：

1. 在后台创建草稿题目。
2. 选择所属专题。
3. 填写标题、slug、难度、频率、掌握要求。
4. 写 30 秒回答。
5. 写 2 分钟回答。
6. 写深度解释。
7. 添加追问链路。
8. 添加常见误区。
9. 添加纠偏记录。
10. 添加项目映射。
11. 添加参考资料。
12. 预览公开页。
13. 发布。

专题生产流程：

1. 创建专题草稿。
2. 写专题定位和重要性。
3. 写前置知识。
4. 写知识主线。
5. 关联核心题目。
6. 添加专题级作者心路。
7. 发布。

## 12. 首批内容建议

V1 每个专题先做 8-12 道题，合计 32-48 道题。

并发首批题：

- synchronized 底层原理是什么？
- volatile 能保证什么，不能保证什么？
- CAS 有什么问题？
- AQS 是什么？
- ReentrantLock 怎么实现公平锁和非公平锁？
- 线程池 7 个参数怎么理解？
- ThreadLocal 为什么会内存泄漏？
- CountDownLatch、CyclicBarrier、Semaphore 有什么区别？

JVM 首批题：

- JVM 运行时数据区怎么划分？
- 对象创建过程是什么？
- 如何判断对象是否可回收？
- GC Roots 有哪些？
- CMS 和 G1 有什么区别？
- Full GC 怎么排查？
- 类加载过程是什么？
- 双亲委派机制有什么意义？

MySQL 首批题：

- 为什么 MySQL 索引用 B+ 树？
- 聚簇索引和二级索引有什么区别？
- 最左前缀原则怎么理解？
- MVCC 是怎么实现的？
- ReadView 是什么？
- redo log、undo log、binlog 区别？
- 间隙锁和临键锁解决什么问题？
- 一条 update 语句如何执行？

Redis 首批题：

- Redis 为什么快？
- Redis 常见数据结构底层怎么实现？
- ZSet 为什么用跳表？
- RDB 和 AOF 怎么选？
- Redis 过期删除和内存淘汰怎么做？
- 缓存穿透、击穿、雪崩怎么解决？
- 缓存和数据库一致性怎么保证？
- Redis 分布式锁有哪些坑？

## 13. 非功能要求

### 13.1 性能

- 公开站题目详情页首屏应尽量静态化或服务端渲染。
- 后端公开 API 支持分页。
- 首页只返回必要摘要，不返回题目完整内容。

### 13.2 可维护性

- 内容模型避免把所有字段堆到一张题目表。
- 题目扩展内容用独立表维护。
- 枚举值统一在后端定义，前端使用 API 返回值渲染。

### 13.3 SEO

- 每个专题和题目有唯一 URL。
- 每个公开页提供标题、描述、canonical URL。
- 题目详情页使用结构化标题层级。

### 13.4 安全

- 管理 API 必须鉴权。
- 后台富文本或 Markdown 内容渲染时需要防 XSS。
- 管理员密码使用 BCrypt 存储。
- 公开 API 不暴露草稿内容。

## 14. 实施拆分

建议按以下顺序执行：

1. 后端基础工程和数据库迁移。
2. 内容模型、实体、Mapper、Service、公开 API。
3. 管理 API 和管理员登录。
4. Vue 后台管理基础布局和内容 CRUD。
5. Next.js 公开站基础页面和内容展示。
6. 首批四个专题内容录入。
7. SEO、预览、搜索和体验打磨。

每一步都应该形成可运行、可验证的结果。

## 15. 验收标准

V1 完成时应满足：

- 管理员可以登录后台。
- 管理员可以创建、编辑、发布、下线专题。
- 管理员可以创建、编辑、发布、下线题目。
- 题目可以维护追问、误区、纠偏、项目映射和参考资料。
- 公开站首页可以看到四个专题和精选题目。
- 专题详情页可以按顺序展示题目。
- 题目详情页可以完整展示所有内容块。
- 心路历程页可以展示作者笔记。
- 草稿内容不会出现在公开站。
- 至少录入每个专题 2 道样例题，验证完整链路。

## 16. 需要后续确认的问题

这些问题不阻塞 V1 设计，但会影响实现细节：

- Markdown 编辑器选型：纯 textarea、Milkdown、TipTap、bytemd 或其他方案。
- 后端数据访问选型：MyBatis Plus 还是 Spring Data JPA。
- 前端 UI 组件库：Next.js 和 Vue 是否分别使用组件库。
- 部署方式：本地 Docker Compose、单机部署还是云服务。
- 是否需要从第一版开始准备内容版本历史。

## 17. 当前结论

V1 的正确方向是：用一套结构化内容模型承载专题和独立题目页，用后台保证内容生产效率，用公开站体现深度、结构和真实作者判断。并发、JVM、MySQL、Redis 四个专题足够验证这个产品是否成立。
