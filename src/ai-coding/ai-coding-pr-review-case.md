---
title: "怎样用 AI 审查一个真实 PR，并用测试核对结论？"
description: "复审一个公开改动，用差异、假设和本地验证呈现工程判断。"
breadcrumb: true
article: true
editLink: false
category:
  - "AI 编程"
tag:
  - "项目实战"
  - "进阶"
prev:
  { text: "Vibe Coding 实战里那些少踩坑的技巧", link: "/ai-coding/ai-coding-vibe-coding-tips.html" }
next: { text: "开源项目", link: "/open-source-project/" }
---

# 怎样用 AI 审查一个真实 PR，并用测试核对结论？

> 先把 AI 提出的风险变成一条能失败的检查，再用同一份检查验证修正后的行为。

## 构建已经通过，首页按钮为什么还可能点错？

拾级的一个早期 PR 把应用改成 VuePress 静态站，并配置 GitHub Pages 发布。它还给首页加了几个阅读入口。
本次用 AI 辅助复审这份历史改动，核对用户在 `/zhaoge_blog/` 首页点「浏览高频题」后会访问哪个地址。以下观察来自复审时的本地构建。[原始 PR #1](https://github.com/zhaoge0202/zhaoge_blog/pull/1)

工作流给构建 job 配了部署前缀，VuePress 配置也确实读取它。下面两行来自不同文件。

```yaml
# .github/workflows/pages.yml
VUEPRESS_BASE: ${{ vars.VUEPRESS_BASE || '/zhaoge_blog/' }}
```

```typescript
// src/.vuepress/config.ts
base: process.env.VUEPRESS_BASE || "/",
```

首页新增的卡片使用原生 HTML，而同页的复习清单使用 Markdown。两种写法的目标页面相同。

```diff
+      <a href="/questions/">浏览高频题</a>
...
+- **复习顺序**：[专题总览](./topics/) -> [高频题库](./questions/) -> [复盘记录](./journey/)。先建立知识地图，再刷题，最后补表达和纠偏。
```

GitHub Pages 项目站点的默认地址带仓库名。浏览器看到 `/questions/` 会从当前域名根路径解析，站点目录前缀因此丢失。VuePress 会转换 Markdown 内部链接，但原生 HTML 同样会被它改写只是一个待核对的假设。两个入口留在同一页，恰好可以在同一次构建中对照。[GitHub Pages 站点地址](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [VuePress 链接转换](https://vuepress.vuejs.org/guide/markdown.html#links) · [MDN URL 解析规则](https://developer.mozilla.org/en-US/docs/Web/API/URL_API/Resolving_relative_references)

## 怎样让 AI 提出可以被推翻的结论？

用 PR 的 base 和 head 固定输入。在合入后重新审查时，当前 `main` 上相关文件可能早已重写。给 AI 看当前文件很容易把修过的问题判成不存在，或把后来引入的问题算到旧 PR 头上。
这次还明确给出业务目标，即两个首页入口都应打开同一个题库页面。然后要求每条候选风险写出定位、预期、可运行的检查和它能证明的范围。

```bash
git diff \
  5e3e60088acfaf7d8b04eed8a70bd8bbda93feeb...4559a3eb314aa0e036d0dcf24d16af3d7ffff87f \
  -- .github/workflows/pages.yml src/.vuepress/config.ts src/README.md
```

对于这段改动，下面三个解释会导向完全不同的修改。

| 待验证的解释           | 如果为真，会看到什么             | 复核结果                                |
| ---------------------- | -------------------------------- | --------------------------------------- |
| 部署前缀没进入构建     | 同一份产物中的题库链接都不带前缀 | 排除。Markdown 入口带了 `/zhaoge_blog/` |
| 构建没生成题库页       | `dist/questions/index.html` 缺失 | 排除。题库页存在                        |
| 首页卡片使用域名根路径 | 原生锚点的目标脱离站点前缀       | 复现。生成结果仍然是 `/questions/`      |

如果只把「卡片指错地址」交给 AI，它可能建议改通用配置、把所有链接手动加上仓库名，或者修改部署流程。三项检查把修改范围缩到了输入里那一个原生锚点。手写仓库名前缀也会把页面绑定到某一种部署路径，换到独立域名根路径时就得再改一次。

## 怎样从历史提交复现，并让检查先失败？

以下命令在仓库根目录开始运行。用提交里的锁文件在临时目录安装依赖，只取构建所需的公开源码。这里使用 Node.js 24.8.0，历史流水线配置的运行环境为 Node.js 20。

```bash
pr_head=4559a3eb314aa0e036d0dcf24d16af3d7ffff87f
repro_dir="$(mktemp -d)"
git archive "$pr_head" src package.json package-lock.json | tar -x -C "$repro_dir"
cd "$repro_dir"
npm ci --ignore-scripts --no-audit --no-fund
VUEPRESS_BASE=/zhaoge_blog/ npm run build
```

构建成功后，在临时目录将下面的脚本保存为 `check-links.mjs`，运行 `node check-links.mjs`。脚本里的匹配表达式专门读取该版本首页的两个可见入口。它按用户访问首页时的 URL 解析 `href`，并单独检查目标题库页确实存在。若只检查 `dist/questions/index.html`，这个故障会漏过去。

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const home = new URL(process.argv[2] ?? "/zhaoge_blog/", "https://example.test");
const expected = new URL("questions/", home).href;
const html = readFileSync("dist/index.html", "utf8");
assert.ok(existsSync("dist/questions/index.html"), "题库页必须存在于产物中");

const markdownHref = html.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*>高频题库<\/a>/)?.[1];
const cardHref = html.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*>浏览高频题<\/a>/)?.[1];
assert.ok(markdownHref && cardHref, "首页须有两个可见的题库入口");

const markdownTarget = new URL(markdownHref, home).href;
const cardTarget = new URL(cardHref, home).href;
console.log("复习清单", markdownTarget);
console.log("首页卡片", cardTarget);
assert.equal(markdownTarget, expected, "复习清单应打开题库");
assert.equal(cardTarget, expected, "首页卡片应打开题库");
```

原版构建渲染成功。检查定位到两条不同的 URL，并在第二条断言处退出。

```text
复习清单 https://example.test/zhaoge_blog/questions/
首页卡片 https://example.test/questions/
AssertionError [ERR_ASSERTION]: 首页卡片应打开题库
```

## 怎样确认一行修正够用？

这个按钮只出现在首页。首页通过以斜杠结尾的目录地址访问时，`./questions/` 会相对于该目录解析。把这一行改在临时副本里，保留原有卡片结构。

```diff
-      <a href="/questions/">浏览高频题</a>
+      <a href="./questions/">浏览高频题</a>
```

再次以 `/zhaoge_blog/` 为前缀构建并运行同一脚本，两个入口都解析到 `https://example.test/zhaoge_blog/questions/`，检查通过。再以 `/` 为前缀构建，运行 `node check-links.mjs /`。这次两个入口都指向 `https://example.test/questions/`。
同样的相对地址如果被搬到多层目录，解析结果就会改变。复用到其他页面或组件时，应由站点路由生成链接，并在真实挂载路径检查产物。

一条可复核的评审意见可以直接指出 `src/README.md` 的首页卡片在项目站点下会把用户带到域名根路径，并附上目标 URL 和断言结果。维护者可以用同一条命令重跑，再决定是否接受这行修改。这里验证了本地构建产物和两种部署前缀下的 URL 解析。若改动还涉及 CDN 或重定向，再按实际挂载路径对预览环境做点击验证。

## 小结

1. 复审历史 PR 时固定 base、head、锁文件和目标运行条件。
2. 让每项候选风险对应具体的观察。对同一次构建分别核对目标文件、链接和解析后的 URL。
3. 改动前后运行同一份断言，先复现失败，再确认修正。
4. 在审查记录里给出触发条件、用户影响、验证结果和证据覆盖范围。

## 参考

- 基于 [拾级 PR #1 的原始差异](https://github.com/zhaoge0202/zhaoge_blog/pull/1/files) 和 [PR head 源码](https://github.com/zhaoge0202/zhaoge_blog/tree/4559a3eb314aa0e036d0dcf24d16af3d7ffff87f) 复审，使用历史锁文件构建，分别验证原版和临时修正版。
- 对照 [VuePress `base` 配置](https://vuepress.vuejs.org/reference/config.html#base)、[VuePress Markdown 链接](https://vuepress.vuejs.org/guide/markdown.html#links)、[GitHub Pages 默认地址](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) 和 [MDN URL 相对引用](https://developer.mozilla.org/en-US/docs/Web/API/URL_API/Resolving_relative_references)。
- 综合仓库内关于规范驱动、证据验收的参考资料。通用方法见本站 [AI 代码审查](./ai-coding-code-review.html) 和 [AI 代码验收](./ai-coding-acceptance.html)。
