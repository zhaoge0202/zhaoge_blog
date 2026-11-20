# 自建博客部署约定

公开仓库只保留 `blog.config.example.json`，其中全部使用示例值。
真实部署配置保存在同目录的 `blog.config.json`，已由 Git 忽略。
构建、上传和公开 Nginx 模板共用这份本地配置；GitHub Pages 和私有站保持独立入口。

## 先准备本地配置

首次使用时复制示例，已有真实配置则保留：

```bash
if [ ! -f deploy/blog.config.json ]; then
  cp deploy/blog.config.example.json deploy/blog.config.json
fi
```

只在本地文件填写实际域名、连接目标、站点目录和 SSH 密钥路径。
私钥正文、密码、API Token 不应写入示例、脚本、测试或文档，本地 JSON 也不需要这些字段。
发布命令缺少本地配置时直接报错，不会回退到示例配置执行；未替换的示例地址也不能发布。
普通构建和 CI 只读取示例中的资源目录默认值，无需访问本地部署配置。

## 一处配置，三个消费方

| 字段             | 构建使用                            | 同步使用          | Nginx 使用                        |
| ---------------- | ----------------------------------- | ----------------- | --------------------------------- |
| `siteUrl`        | 页面 canonical、RSS、站点地图的域名 | 显示目标站点      | server_name、HTTPS 跳转与证书目录 |
| `assetsDir`      | Vite 输出资源目录                   | 第一阶段上传目录  | 版本资源的缓存路径                |
| `remote.webRoot` | 不参与页面内容                      | 远端站点根目录    | root                              |
| `remote.target`  | 不参与页面内容                      | SSH 的 user@host  | 不参与                            |
| `remote.sshKey`  | 不参与页面内容                      | 本机 SSH 密钥路径 | 不参与                            |

真实连接信息只保存在 Git 忽略的本地配置中。需要另一份本地配置时，使用 `--config /绝对路径/自己的配置.json`。

当前约定是 HTTPS 根路径站点，不支持 URL 子路径。资源目录使用 `assets-v数字`。
远端根目录必须是 `/data/`、`/srv/` 或 `/var/www/` 下的独立站点目录，
不允许根目录、路径穿越、空白或命令语法。密钥路径支持绝对路径和 `~/`，允许空格，
不支持引号、控制字符和路径穿越。

## 先看离线计划

```bash
npm run deploy:blog:plan
```

该命令只读取本地配置并输出构建环境与命令参数数组，不构建、不执行 SSH/rsync，
也不读取密钥内容。它与会连接服务器的 `rsync --dry-run` 有不同的行为。
需要另一份配置时：

```bash
npm run deploy:blog:plan -- --config /tmp/blog.config.json
```

公开发布固定使用生产模式、`dist/`、根路径和配置中的域名、资源目录。
调用者环境里的 `VUEPRESS_PRIVATE=1`、`PRIVATE_DIST` 等不会把它切到私有构建。

## 生成 Nginx，单独验收后安装

```bash
npm run --silent deploy:blog:nginx > deploy/nginx.blog.local.conf
```

`nginx.conf.example` 含占位符，不能直接复制到服务器。上面的命令生成本机配置，`*.local.*` 文件已被 Git 忽略。
计划输出和生成配置仍包含真实部署信息，仅在本地核对，不应贴到公开日志或提交到仓库。
证书默认放在 `/etc/letsencrypt/live/<站点域名>/`；使用其他证书方案时，先调整模板中的证书规则。

管理员需核对 DNS、证书、Nginx 版本、站点目录和读权限，准备好远端根目录，
并完成 SSH 主机指纹验证。安装生成配置后，在服务器运行 `nginx -t`，
通过后再重载。公开发布器不会安装配置、申请证书或重启服务。

缓存约定如下：

- HTML、RSS、JSON 等默认发送 `Cache-Control: no-cache`，使用前重新验证。
- 当前版本中实际存在的资源使用一年缓存与 immutable。
- 当前版本资源缺失时，返回真实 404 和 `no-store`，避免给错误响应套长缓存。
- CDN 如配置了覆盖源站响应头的规则，仍需单独核对；更换源站文件不会自动清除已有边缘缓存。

## 明确执行发布

确认计划和目标无误后，执行：

```bash
npm run deploy:blog
```

本机需要 Node.js 22.18+、npm、SSH 和 rsync。服务器只接收静态产物，无需 Node。
脚本按顺序执行：

1. 按目标配置运行现有 `npm run build`，保留公开产物的私有内容泄漏检查。
2. 确认 `dist/index.html`、资源目录存在且类型正确，拒绝 `dist/private`、任意符号链接及非常规文件。
3. 上传当前版本资源，保留远端同版本的旧哈希文件。
4. 同步页面，清理本地已删除的普通页面，保护 `assets/` 和所有 `assets-v*/` 目录。

任一步失败即停止，不继续下一阶段。构建失败时，即使磁盘上还有旧 `dist`，也不会上传。
页面阶段包含删除远端过期页面的操作，不能把 `remote.webRoot` 指向混放其他服务的目录。
同一目标应串行发布，避免两个进程同时同步页面。

这套约定通过资源优先和旧文件保留减少部署期间的引用错配，并非整站原子切换或自动回滚。
旧资源需要按缓存窗口、回滚范围和磁盘情况单独清理，普通发布不会顺带删除它们。
需要升级资源路径时，只改配置中的 `assetsDir`，重新生成 Nginx，并协调服务器配置与新产物的发布。

## 私有站保持独立

现有 `npm run private:deploy` 继续发布私有构建到受保护的目标。
`nginx.private.conf.example` 仅包含虚构域名与路径，真实自建私有站配置保存为
`nginx.private.local.conf` 并由 Git 忽略。公开发布器不生成或上传私有站，
也不读取私有笔记来拼部署参数。

私有模板要求基础认证，并对所有响应设置 `private, no-store` 与 noindex。
如增加子 location 的响应头，需要一起检查缓存与 noindex 的继承。
密码文件、证书和访问控制都必须另外准备；robots/noindex 不能替代认证。

## 本地验收范围

```bash
node --test tests/blog-deploy.test.mjs
npm test
```

测试只使用示例和临时夹具，不读取本机真实配置，覆盖 Git 忽略规则、配置缺失阻断、
示例发布阻断、配置一致性、危险参数拒绝、离线模式、公开构建环境、失败停止与产物检查，
并用本机 rsync 对临时目录验证旧资源保留与旧页面清理。
本地测试不连接部署服务器，不能代替远端 `nginx -t`、证书、目录权限和线上页面验收。
