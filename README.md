# Java 面试进阶静态站

面向 3-5 年 Java 后端工程师的进阶面试准备站点。项目现在采用 JavaGuide 类似的纯静态架构，VuePress Theme Hope 负责阅读体验。

## 项目结构

- `src`: VuePress Theme Hope 静态站点内容和配置。
- `package.json`: 本地开发、构建和清理脚本。
- `docs/JavaGuide`: 本地参考仓库，已被 `.gitignore` 忽略，不进入提交。

## 本地开发

只需要 Node.js 20+ 和 npm。

```bash
npm ci
npm run dev
```

默认本地地址：

```text
http://localhost:3000
```

## 构建

```bash
npm run build
```

构建产物输出到：

```text
dist
```

## GitHub Pages 发布

推送到 `main` 后，GitHub Actions 会自动：

1. 安装根目录依赖。
2. 执行 `npm run build`。
3. 上传 `dist`。
4. 发布到 GitHub Pages。

仓库需要在 GitHub 中开启：

```text
Settings -> Pages -> Build and deployment -> Source: GitHub Actions
```

默认 workflow 会按 GitHub Pages 项目地址构建：

```text
https://zhaoge0202.github.io/zhaoge_blog/
```

也就是默认：

```text
VUEPRESS_BASE=/zhaoge_blog/
VUEPRESS_HOSTNAME=https://zhaoge0202.github.io/
```

如果使用自定义域名，继续在：

```text
Settings -> Pages -> Custom domain
```

填写域名，并在 Cloudflare 配置对应 DNS。自定义域名部署时，把 GitHub 仓库变量设置为：

```text
Settings -> Secrets and variables -> Actions -> Variables
VUEPRESS_BASE=/
VUEPRESS_HOSTNAME=https://你的域名
```

这样静态资源会从域名根路径加载。
