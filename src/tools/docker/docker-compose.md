---
title: "Docker Compose 本地联调怎么用？"
description: "用服务编排、依赖启动和环境变量讲清本地多容器联调。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "项目实战"
  - "高频"
  - "基础"
prev:
  text: "容器网络和数据卷怎么选？"
  link: "/tools/docker/docker-network-volume.html"
next:
  text: "Git"
  link: "/tools/git/"
---

# Docker Compose 本地联调怎么用？

> Compose 解决的是「应用 + 依赖一键起」，把多容器的网络、卷、环境变量收进一份 YAML。它很适合本地联调，但不是生产编排的终极形态。

## 它解决什么问题？

单机 `docker run` 起一个 MySQL 还行；再加 Redis、消息队列、网关、两个微服务，命令会散成一串脚本，端口、网络名、卷名也容易对不齐。

Compose 用一份声明文件描述整组服务，常见能力：

- 多服务定义与统一启停；
- 默认把服务放进同一网络，服务名可 DNS 解析；
- 声明卷、环境变量、端口映射；
- 表达启动依赖顺序（注意：顺序 ≠ 就绪）。

命令（Compose V2 插件形式）：

```bash
docker compose up -d        # 后台启动
docker compose ps           # 状态
docker compose logs -f api  # 跟日志
docker compose down         # 停并移除容器/网络（默认保留命名卷）
```

旧的独立二进制是 `docker-compose`；新环境优先 `docker compose`。

## 一份能跑的本地联调文件

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/app?useSSL=false
      SPRING_DATA_REDIS_HOST: redis
      SPRING_PROFILES_ACTIVE: local
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./logs:/app/logs

  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: app
      MYSQL_ROOT_PASSWORD: secret
    ports:
      - "3306:3306" # 仅本地需要客户端直连时再映射
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-psecret"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7
    ports:
      - "6379:6379"

volumes:
  mysql_data:
```

几个要点：

1. **服务名就是主机名**：`api` 连库写 `mysql`，连缓存写 `redis`，不要写 `127.0.0.1`（那是容器自己）。
2. **命名卷挂数据库目录**：删容器不丢本地库数据（`down -v` 除外）。
3. **`build` 与 `image` 可混用**：业务服务本地构建，中间件直接拉官方镜像。
4. **端口只映射需要的**：中间件若仅容器间访问，可去掉 `ports`，减少本机端口占用与暴露。

## depends_on ≠ 依赖已就绪

很多人以为：

```yaml
depends_on: [mysql]
```

就等于「MySQL 能接连接了再起应用」。实际上默认只保证**容器进程已启动**，不保证监听端口、完成初始化。

更稳的组合：

1. 给依赖服务写 `healthcheck`；
2. `depends_on` 使用 `condition: service_healthy`（如上例）；
3. **应用自身仍要有连接重试**——健康检查通过后仍可能出现短暂拒绝连接。

入口脚本或框架层的 retry / fail-fast 回退，比在 Compose 里死磕顺序更靠谱。

## 环境变量与配置分层

本地联调配置别写死进镜像。常见做法：

| 方式             | 场景                       |
| ---------------- | -------------------------- |
| `environment`    | 少量、可进仓库的键值       |
| `env_file: .env` | 本地私密或机器相关配置     |
| bind 挂配置文件  | 复杂配置、证书、nginx conf |

`.env` 放项目根时，Compose 会做变量插值，例如：

```yaml
services:
  api:
    image: my-api:${APP_TAG:-latest}
    env_file:
      - .env.local
```

注意：`.env` 与 `env_file` 作用域不同——前者偏 Compose 文件插值，后者偏注入容器环境。别假设「写进 `.env` 就一定在容器 `printenv` 里看得到」，按文档核对一次。

密钥不要提交进 Git；给 `.env.example` 说明键名即可。

## 网络、卷与日常命令

默认会为项目建一个网络，服务名互通。需要隔离时再拆 `frontend` / `backend` 等多个 network。卷上：数据库用命名卷，源码热更新用 bind。选型细节见[容器网络和数据卷怎么选？](./docker-network-volume.html)。

```bash
docker compose up -d --build api   # 重建并启动某服务
docker compose ps
docker compose exec api sh
docker compose down                # 停服务，默认保留命名卷
docker compose down -v             # 连命名卷一起清，库数据会丢
docker compose -p demo-a up -d     # 同机多套环境用项目名隔离
```

## 和生产的边界

Compose 适合本地联调、CI 起依赖、以及极简单机场景。它通常不等于生产编排：多机调度、滚动发布、集群级服务发现与密钥治理，是 K8s/Nomad 等的主场。

面试可答：Compose 把多容器拓扑声明化，降低本地成本；上生产要单独评估规模与发布模型，不要把开发用 `compose.yaml` 原样当生产拓扑。若坚持 Compose 作真相源，也要补健康检查、资源限制、密钥与备份，而不是「本地能 up 就算交付」。

## 容易踩的坑

1. 应用连 `localhost:3306`：容器里 localhost 是自己，应连服务名。
2. 只写 `depends_on` 不做健康检查与重试：偶发启动失败。
3. `down -v` 清掉本地库还以为只是停服务。
4. 中间件端口全映射到宿主机：冲突多、暴露面大。
5. 生产密钥写进仓库里的 compose 文件。

## 小结

1. Compose 擅长本地多服务依赖的一键启停与网络打通。
2. 服务名即主机名；连接串不要写容器 IP 或误用 localhost。
3. `depends_on` 管启动顺序，就绪要靠 healthcheck + 应用重试。
4. 数据服务挂命名卷；开发源码可用 bind mount。
5. Compose 不是默认的生产编排答案，边界要说清。

## 参考

综合自本地多容器联调与 Compose 声明式编排实践整理；健康检查与 depends_on 语义按常见 Compose V2 行为核对。
