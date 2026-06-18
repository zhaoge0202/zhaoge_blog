# Java 面试进阶静态站

面向 3-5 年 Java 后端工程师的进阶面试准备站点。项目现在采用纯静态架构，VuePress Theme Hope 负责阅读体验。

## 项目结构

- `src`: VuePress Theme Hope 静态站点内容和配置。
- `package.json`: 本地开发、构建和清理脚本。

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

## R2 媒体同步

仓库提供了一个**手动触发**的本地脚本，用来把 Markdown 里的本地媒体上传到 R2，并把文中的相对路径改写成 CDN URL。

### 1. 准备本地配置

复制示例配置：

```bash
cp .media-sync.example.json .media-sync.json
```

然后把 `.media-sync.json` 里的占位值替换成你自己的 R2 信息。这个文件已经加入 `.gitignore`，不会进入 Git。

也可以只把非敏感字段放到 `.media-sync.json`，然后通过环境变量覆盖密钥：

```bash
export R2_MEDIA_SYNC_ACCESS_KEY_ID=...
export R2_MEDIA_SYNC_SECRET_ACCESS_KEY=...
```

### 2. 运行同步

同步整个 `src`：

```bash
npm run media:sync
```

同步单篇文章：

```bash
npm run media:sync -- src/journey/2026-06-16-note-1.md
```

只预览、不改写文件：

```bash
npm run media:sync -- src --dry-run
```

### 3. 行为说明

- 脚本会扫描 Markdown 图片语法、指向媒体文件的 Markdown 链接，以及 `<img> / <audio> / <video> / <source>` 的 `src`。
- 只处理本地相对路径，远程 URL 不会重复上传。
- 上传路径固定为 `blog/YYYY/MM/DD/`。
- 文件名前缀格式为 `YYYYMMDD-vNNN-`，例如：

```text
blog/2026/06/18/20260618-v001-system-design-diagram.png
```

- 同一天、同一个清洗后的文件名会自动递增版本号。
- 成功后会直接改写 Markdown 文件，把本地路径替换为 `https://media.zhaoge.top/...` 这样的公网 URL。

### 4. 自检

```bash
npm run test:media-sync
```
