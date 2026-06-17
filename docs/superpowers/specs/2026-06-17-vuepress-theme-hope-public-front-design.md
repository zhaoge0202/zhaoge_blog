# VuePress Theme Hope 公网前台迁移设计

> 日期：2026-06-17
>
> 当前阶段：前台框架迁移设计
>
> 范围：`apps/web` 从 Next.js 迁移为 `vuepress-theme-hope` 阅读站，`apps/admin` 和 `apps/api` 保留

## 1. 目标

本次改造只解决公网阅读前台：

- `apps/web` 改造成基于 VuePress 2 和 `vuepress-theme-hope` 的静态阅读站。
- 后台继续是唯一内容编辑入口。
- 服务端继续是唯一结构化内容源。
- 发布后的内容导出成 `Markdown + Frontmatter`，由 VuePress 构建和提供阅读体验。

不在本次范围内：

- 不重做后台编辑器交互。
- 不把后台改成直接编辑 Git 文件。
- 不做自动 Git commit。
- 不做用户系统、评论、搜索服务重构。

## 2. 系统边界

迁移后的职责边界如下：

- `apps/admin`：维护专题、题目、心路历程等结构化内容。
- `apps/api`：保存内容、处理发布状态、导出已发布内容到前台目录。
- `apps/web`：只读取导出的 Markdown 文件，负责导航、侧边栏、文档阅读体验。

前台不再直接请求数据库或运行时内容 API。内容一致性由导出流程保证，而不是由浏览器侧请求保证。

## 3. 迁移策略

采用直接替换策略：

- 现有 `apps/web` 不再作为 Next.js 应用运行。
- 保留原有源码到 legacy 目录，避免本次迁移期间丢失已有实现。
- 新的 `apps/web` 使用 VuePress 站点结构、主题配置和内容目录。

这样做的原因：

- 避免长期维护两套公网端。
- 让 `vuepress-theme-hope` 直接承担完整阅读体验，而不是只抄样式。
- 迁移期间仍保留旧代码做参考和回退。

## 4. 内容目录和 URL

新的前台内容目录固定为 `apps/web/src`，结构如下：

```text
apps/web/src/
  README.md
  topics/
    README.md
    <topic-slug>/
      README.md
  questions/
    README.md
    <topic-slug>/
      <question-slug>.md
  journey/
    README.md
    <note-slug>.md
  .vuepress/
    config.ts
    navbar.ts
    sidebar.ts
    styles/
```

URL 规则固定如下：

- `/`：首页
- `/topics/`：专题列表
- `/topics/<topic-slug>/`：专题详情
- `/questions/`：题目列表
- `/questions/<topic-slug>/<question-slug>.html`：题目详情
- `/journey/`：心路历程列表
- `/journey/<note-slug>.html`：单篇笔记

## 5. 导出策略

导出使用“全量重建”而不是“单文件增量更新”：

- 任意专题、题目、笔记发生创建、编辑、发布、下线时，重新导出全量已发布内容。
- 导出目录内的受管文件由服务端统一重建。
- 导出过程不自动提交 Git。

选择全量重建的原因：

- 当前内容规模小，重建成本低。
- 可以稳定处理“下线后删除文件”“专题 slug 变化”“题目换专题”等路径变化问题。
- 能明显降低后台发布逻辑的复杂度。

## 6. Markdown 映射

### 6.1 专题

每个专题导出为 `topics/<topic-slug>/README.md`。

Frontmatter 至少包含：

- `title`
- `description`
- `breadcrumb`
- `article`
- `timeline`
- `editLink`

正文使用数据库中的 `content` 为主，并补充专题元信息：

- 面向对象
- 为什么重要
- 前置知识
- 知识地图
- 面试重点
- 该专题下的已发布题目列表

### 6.2 题目

每道题导出为 `questions/<topic-slug>/<question-slug>.md`。

Frontmatter 至少包含：

- `title`
- `description`
- `breadcrumb`
- `category`
- `tag`
- `article`
- `editLink`

正文以题目 `content` 为主，并在文末拼接结构化块：

- 题目摘要
- 难度 / 高频程度 / 掌握层级
- 追问链路
- 常见误区
- 纠偏记录
- 项目映射
- 参考资料

### 6.3 心路历程

每条已发布笔记导出为 `journey/<date>-<slug>.md`。

Frontmatter 至少包含：

- `title`
- `description`
- `date`
- `category`
- `tag`
- `article`
- `timeline`

正文以笔记内容为主，补充关联专题和关联题目链接。

## 7. 发布行为

后台“发布 / 下线”的用户语义保持不变，但系统行为升级为：

1. 更新数据库内容或状态。
2. 触发导出服务。
3. 用最新已发布内容重建 `apps/web/src` 下的受管文件。

如果导出失败：

- 数据库更新回滚。
- 后台接口返回失败，避免“数据库已发布但前台文件未同步”的半成功状态。

## 8. 验证标准

本次迁移完成的最低验收标准：

- `apps/web` 能本地启动 VuePress 开发服务器。
- 主页、专题列表、专题详情、题目详情、心路历程列表可访问。
- 后台发布一个专题、题目或笔记后，导出目录会刷新对应 Markdown 文件。
- `npm run build` 能成功生成静态站。
- 后端测试覆盖导出路径和基本 Frontmatter/文件输出。
