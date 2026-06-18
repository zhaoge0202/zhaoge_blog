---
title: "把本地 Markdown 媒体同步接到 R2 的一次实战"
description: "这次把 VuePress 站点里的本地媒体同步脚本接到 Cloudflare R2，真正卡住本地使用的不是桶设置，而是缺少 R2 的 S3 凭据。"
date: 2026-06-18
article: true
timeline: true
editLink: false
category:
  - "心路历程"
tag:
  - "R2"
  - "VUEPRESS"
  - "TOOLING"
---

# 把本地 Markdown 媒体同步接到 R2 的一次实战

这次做的事情其实很具体：我希望在本地写 Markdown 的时候，文章里引用的图片、音频或者其他媒体能通过一个命令自动上传到 Cloudflare R2，然后把文中的相对路径改写成公网 CDN 地址。

脚本本身并不复杂，真正把它跑通时卡住我的，反而不是代码，而是**凭据链路**。

## 起因：桶和自定义域都好了，本地还是完全用不了

我先把 R2 桶和自定义域都配好了：

- 桶：`zhaogepersonal`
- 自定义域：`media.zhaoge.top`
- 自定义域缓存链路：正常

看上去一切都准备好了，但真正回到本地跑脚本的时候，还是会卡住。原因很简单：

> 本地脚本不是靠桶页面上的“公开访问”就能写入对象，它需要 R2 的 **S3 凭据**。

也就是说，桶能公开访问，只解决了“读”的问题；本地脚本想上传文件，还需要“写”的身份。

![R2 本地配置要点](https://media.zhaoge.top/blog/2026/06/18/20260618-v001-r2-media-sync-config-card.png)

## 真正缺的是什么

我一开始以为只要在 R2 桶设置页里把自定义域、缓存规则这些配好，本地脚本就能直接用了。后来才发现，脚本真正要用的是：

- `Access Key ID`
- `Secret Access Key`
- R2 的 S3 endpoint

而不是 Cloudflare 控制台给出的那个 API token。

这两个东西的路径在 Cloudflare 控制台里不在桶设置页，而是在 R2 总览里的 API token 管理入口。创建方式我最后选的是：

- `Create User API token`
- 权限：只给 `zhaogepersonal`
- 能力：`read / write / list`

这一步走完，脚本需要的本地配置才算真正完整。

## 本地配置最后长什么样

我本地最终放的是 `.media-sync.json`，真实密钥必须忽略进 Git。文章里只保留打码后的形态：

```json
{
  "bucket": "zhaogepersonal",
  "endpoint": "https://<account-id>.r2.cloudflarestorage.com",
  "accessKeyId": "fc80************************1d4f",
  "secretAccessKey": "2d01****************************************6057",
  "publicBaseUrl": "https://media.zhaoge.top",
  "keyPrefix": "blog",
  "region": "auto"
}
```

这里有两个很容易踩的坑：

1. `endpoint` 不要带桶名后缀
   正确的是：

   ```text
   https://<account-id>.r2.cloudflarestorage.com
   ```

   不是：

   ```text
   https://<account-id>.r2.cloudflarestorage.com/zhaogepersonal
   ```

2. Cloudflare API token 不是脚本上传时要用的 S3 凭据
   真正给 S3 客户端用的是 `Access Key ID` 和 `Secret Access Key`。

## 这次实战的完整链路

这次跑通之后，整个流程其实很顺：

![R2 媒体同步链路](https://media.zhaoge.top/blog/2026/06/18/20260618-v001-r2-media-sync-workflow-card.png)

核心命令只有一个：

```bash
npm run media:sync -- src/journey/2026-06-18-r2-media-sync-tutorial.md
```

它做的事情是：

1. 扫描文章里的本地媒体引用
2. 上传到 R2 的 `blog/YYYY/MM/DD/`
3. 生成版本化对象名
4. 把 Markdown 里的相对路径改写成公网 URL

对象命名规则我定成了：

```text
blog/2026/06/18/20260618-v001-logo.png
```

这种格式有两个好处：

- 时间维度清晰，后面排查方便
- 同一天重复上传同名文件时可以递增版本号，不会一上来就混乱

## 我实际上传了什么

为了确认链路真的通了，我直接拿仓库里现成的一张图做了实测：

```text
assets/pictures/logo.png
```

我把它传进了：

```text
https://media.zhaoge.top/blog/2026/06/18/logo.png
```

这里我故意先走了一次最直观的上传验证，确认桶、权限和公网访问都没问题，再回头继续优化脚本的版本化命名。

## 上传之后怎么确认真的走到了 CDN

对象上传成功还不够，我还想确认两件事：

1. `media.zhaoge.top` 这个自定义域是不是能直接访问到对象
2. Cloudflare 缓存是不是真的生效了

最直接的验证方式就是连续请求两次同一个 URL：

```bash
curl -I https://media.zhaoge.top/blog/2026/06/18/logo.png
curl -I https://media.zhaoge.top/blog/2026/06/18/logo.png
```

我这次实际看到的是：

- 第一次：`CF-Cache-Status: MISS`
- 第二次：`CF-Cache-Status: HIT`

![CDN 缓存验证](https://media.zhaoge.top/blog/2026/06/18/20260618-v001-r2-media-sync-cache-check-card.png)

这就说明自定义域缓存链路已经打通了。

## 这个流程最后为什么可用

回头看，这次真正把流程跑通，靠的是把问题拆成了三层：

1. **桶和自定义域**
   先确认 `media.zhaoge.top` 能稳定作为公网访问入口。

2. **本地上传身份**
   再补上 R2 的 S3 凭据，而不是一直盯着桶设置页转。

3. **结果验证**
   最后用一个真实对象和两次 `curl -I`，把“能上传”和“能缓存”都确认掉。

真正麻烦的地方，其实不是上传脚本本身，而是如果一开始把“公开访问”“API token”“S3 凭据”这几个概念混在一起，本地就会一直处于“看起来都配好了，但就是不能用”的状态。

## 最后留一份最短操作清单

如果以后再做一遍，我会按这个顺序来：

1. 在 Cloudflare R2 里建好桶和自定义域
2. 创建只给目标桶的 `User API token`
3. 拿到 `Access Key ID` 和 `Secret Access Key`
4. 本地填 `.media-sync.json`
5. 先跑：

   ```bash
   npm run media:sync -- src/你的文章.md --dry-run
   ```

6. 再正式跑：

   ```bash
   npm run media:sync -- src/你的文章.md
   ```

7. 最后用：

   ```bash
   curl -I https://media.zhaoge.top/你的对象路径
   ```

   验证 `MISS -> HIT`

这套流程一旦通了，后面写文章的时候，媒体管理就不会再是一个反复打断写作节奏的问题。
