---
title: "Dockerfile 怎么写才利用分层缓存？"
description: "从指令顺序和构建上下文讲清镜像构建加速与变瘦。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "高频"
  - "项目实战"
  - "基础"
prev:
  text: "镜像、容器、仓库是什么关系？"
  link: "/tools/docker/docker-image-container.html"
next:
  text: "容器网络和数据卷怎么选？"
  link: "/tools/docker/docker-network-volume.html"
---

# Dockerfile 怎么写才利用分层缓存？

> Dockerfile 写得差，每次改一行业务代码都重装依赖；写得好，本地和 CI 都能把构建时间压下来，镜像还更瘦。

## 缓存命中到底看什么？

`docker build` 按指令顺序一层层构建。某一层的「输入」变了，这一层和后面所有层都会失效，必须重跑。

所谓输入，主要包括：

- 指令本身（`RUN apt-get install ...` 文本变了就算变）
- `COPY` / `ADD` 拷进去的文件内容
- 构建参数、基础镜像 digest 等会影响层内容的因素

所以优化的核心不是背「缓存黑魔法」，而是：**把很少变的步骤放前面，把经常变的步骤放后面**。

## 依赖与源码分层：最常见的提速手法

反例：一上来就把整个项目拷进去，再装依赖。

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "dist/main.js"]
```

任意源码改动都会让 `COPY . .` 这一层失效，`npm ci` 跟着全量重来。

正例：先只拷依赖描述文件，装完依赖再拷源码。

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

Java / Maven 同理：

```dockerfile
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package
```

原则就一句：**描述文件变才重装依赖，源码变只重编译**。

## 多阶段构建：把「构建工具」留在门外

编译期需要 JDK、Maven、Node、Go 编译器；运行期往往只要 JRE 或一个二进制。多阶段构建把两者拆开：

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/app.jar ./app.jar
EXPOSE 8080
USER 1000
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

收益：

- 运行镜像没有源码、没有构建工具链；
- 攻击面更小，体积更可控；
- CI 里仍然可以复用前面阶段的依赖缓存层。

选基础镜像时，优先官方、版本钉死的精简变体（如 `*-slim`、`*-alpine`、`distroless`），并确认 glibc/musl、时区、证书等运行时依赖是否齐。

## 上下文与 `.dockerignore` 经常被忽略

构建命令里的 `.` 是**构建上下文**：客户端会把这个目录打包发给 daemon。上下文里塞了 `node_modules`、`.git`、测试报告、本地日志，会同时拖慢上传和污染 `COPY`。

项目根放一份 `.dockerignore`：

```text
.git
node_modules
target
dist
*.log
.env
.idea
.vscode
```

注意：忽略了 `.env` 并不等于密钥安全——密钥本来就不该写进 Dockerfile 或层里。需要密钥时用构建时 secret 挂载、运行时环境变量或编排系统注入，别 `COPY` 进镜像。

## RUN 合并与层膨胀

有人习惯：

```dockerfile
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*
```

每一条 `RUN` 一层。中间层已经把包索引和安装文件固化进去了，后面的 `rm` 删不掉前面层的体积。更稳妥：

```dockerfile
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

同一层装完就清理。是否合并无关 `RUN` 要权衡可读性：和「同一事务」的步骤合并；跨职责的步骤可以分开，便于缓存局部命中。

`ADD` 有自动解压远程 URL 等额外行为，日常拷贝优先 `COPY`，意图更清晰。

## 安全与可复现别拖到最后

1. **不要用 root 跑业务进程**：`USER` 切到非特权用户。
2. **基础镜像钉 digest 或明确小版本**：`node:20` 会漂，`node:20.11.1-alpine` 或 `@sha256:...` 更稳。
3. **ARG 默认值别塞密钥**：构建参数会进历史，敏感信息会泄漏。
4. **健康检查与入口明确**：`HEALTHCHECK`、`ENTRYPOINT`/`CMD` 写清楚，编排层才好探活。
5. **一次构建多环境**：用 `target` 选阶段，而不是维护三份 Dockerfile。

```bash
docker build -t my-app:1.2.0 --target runtime .
docker history my-app:1.2.0   # 看层是否虚胖
```

## 构建慢时怎么排查

1. 看哪一层开始重跑：日志里 `CACHED` 之后第一层未缓存的指令，就是失效点。
2. 失效是否因为 `COPY . .` 太早、上下文里无关文件在抖。
3. 是否每次基础镜像被重新 pull（镜像源、digest 变化）。
4. CI 有没有复用 BuildKit 缓存 / registry cache；没有的话本地快、流水线永远冷启动。
5. 多阶段里是否误把巨型中间产物拷进最终阶段。

BuildKit 是现在默认推荐的构建引擎，支持更好的缓存导出和 secret 挂载。老环境若还在关 BuildKit，先确认构建时间差是不是引擎差异。

## 和「镜像对象模型」的关系

缓存利用的是[分层镜像](./docker-image-container.html)的复用能力：稳定层共享，变动层后置。Dockerfile 只是把这层策略写成可复现的脚本。镜像瘦了、层稳了，仓库拉取和发布回滚都会轻松一截。

## 小结

1. 某层输入变了，本层及后续全部失效；稳定步骤靠前。
2. 依赖描述与源码分开 `COPY`，避免改代码重装依赖。
3. 多阶段构建把编译工具挡在运行镜像外。
4. `.dockerignore` 缩小上下文；密钥不要进层。
5. 构建慢先定位第一层未命中缓存的指令，再改顺序或上下文。

## 参考

综合自 Docker 构建缓存机制与 Java/Node 多阶段构建常见工程实践整理；层失效规则与 UnionFS 层语义按构建行为核对。
