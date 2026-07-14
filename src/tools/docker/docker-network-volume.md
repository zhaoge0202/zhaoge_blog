---
title: "容器网络和数据卷怎么选？"
description: "从桥接网络、端口映射和卷类型讲清本地与部署常见选项。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "高频"
  - "基础"
  - "项目实战"
prev:
  text: "Dockerfile 怎么写才利用分层缓存？"
  link: "/tools/docker/docker-dockerfile-cache.html"
next:
  text: "Docker Compose 本地联调怎么用？"
  link: "/tools/docker/docker-compose.html"
---

# 容器网络和数据卷怎么选？

> 网络决定谁能连谁，卷决定数据是否还在。本地联调和线上部署，大多数踩坑都落在这两块。

## 网络：默认 bridge 能解决什么？

Docker 常见网络模式：

| 模式          | 特点                                     | 典型用途                   |
| ------------- | ---------------------------------------- | -------------------------- |
| bridge        | 默认虚拟网桥，容器有独立 IP，经 NAT 出网 | 本地单机、多数业务容器     |
| host          | 共用宿主机网络命名空间                   | 要极致网络性能、少一层 NAT |
| none          | 无网卡                                   | 安全加固、纯离线任务       |
| 自定义 bridge | 自建网桥，可挂多个容器                   | Compose/本地多服务互通     |

默认 bridge 下，容器之间默认能互通（同一默认网桥），但**从宿主机访问容器端口**通常要做端口映射：

```bash
docker run -d --name web -p 8080:80 nginx:1.27
# 宿主机 8080 -> 容器 80
```

`-p 8080:80` 是「宿主机端口:容器端口」。只写 `-p 80` 会随机映射宿主机端口，适合临时调试，不适合写死在文档里。

### 服务发现别靠硬编码 IP

容器重建后 IP 常会变。本地多容器互通，更稳的方式是：

1. 建自定义网络；
2. 用容器名 / 服务名做 DNS 解析。

```bash
docker network create app-net
docker run -d --name redis --network app-net redis:7
docker run -d --name api --network app-net -e REDIS_HOST=redis my-api:1.0
```

应用里连 `redis:6379`，而不是去记 `172.17.0.x`。Compose 和 K8s 里这是默认思路：服务名即主机名。

### host 与 bridge 怎么取舍

- **bridge**：隔离清晰，端口映射明确，默认首选。
- **host**：少一层虚拟网桥，延迟和吞吐有时更好，但端口直接占用宿主机，隔离弱，端口冲突风险高。
- 生产里「容器网络」还要叠安全组、CNI、NetworkPolicy；单机 Docker 模式选对了，不等于集群网络策略写完了。

排查网络时常用：

```bash
docker network ls
docker network inspect app-net
docker port web          # 端口映射
docker exec web ping redis
```

容器里没有 `ping` 很正常，换 `curl`/`nc` 或从另一容器测即可。

## 数据卷：三种挂载别混

容器可写层随容器删除而消失。要持久化或共享文件，用挂载：

| 类型             | 写法直觉                   | 特点                      | 更适合                   |
| ---------------- | -------------------------- | ------------------------- | ------------------------ |
| volume（命名卷） | `-v mydata:/var/lib/mysql` | Docker 管理生命周期与路径 | 数据库、生产持久化       |
| bind mount       | `-v /opt/apps:/app`        | 直接绑宿主机目录          | 开发热更新、挂配置       |
| tmpfs            | `--tmpfs /tmp`             | 内存文件系统              | 临时敏感数据、高速临时盘 |

### 命名卷：持久化默认选项

```bash
docker volume create mysql-data
docker run -d --name mysql84 \
  -e MYSQL_ROOT_PASSWORD=secret \
  -v mysql-data:/var/lib/mysql \
  mysql:8.4
```

特点：

- 容器删了，卷默认还在；
- 可在多个容器间复用（注意并发写语义）；
- 实际路径由 Docker 管（Linux 上常见于 `/var/lib/docker/volumes/...`），不建议人手改底层目录。

```bash
docker volume ls
docker volume inspect mysql-data
```

### bind mount：开发顺手，生产要谨慎

```bash
docker run -d --name tomcat \
  -p 8080:8080 \
  -v /opt/apps:/usr/local/tomcat/webapps \
  tomcat:10-jre17
```

宿主机改文件，容器立刻看见，适合本地改代码/静态资源。坑也多：

1. **空目录覆盖**：把空的宿主机目录挂到容器里本来有内容的路径，容器侧会「变空」。常见于误挂 `webapps`、`data`。
2. **权限与 UID**：宿主机用户和容器内进程 UID 不一致会写不进。
3. **路径可移植性差**：同事机器路径不同，Compose 文件就得改。

生产配置可以用 bind 挂只读配置文件，但业务数据更推荐命名卷或云盘。

### tmpfs：用完就没

```bash
docker run --rm --tmpfs /run/secrets:ro,size=16m my-app
```

数据在内存里，容器停就没了。适合临时密钥、高速缓存目录，别当数据库盘。

## 一个完整的小例子

应用 + MySQL，自定义网络 + 命名卷：

```bash
docker network create demo-net
docker volume create demo-mysql

docker run -d --name demo-mysql --network demo-net \
  -e MYSQL_DATABASE=app \
  -e MYSQL_ROOT_PASSWORD=secret \
  -v demo-mysql:/var/lib/mysql \
  mysql:8.4

docker run -d --name demo-api --network demo-net \
  -p 8080:8080 \
  -e DB_HOST=demo-mysql \
  -e DB_PORT=3306 \
  my-api:1.0
```

这里刻意**没有**把 3306 映射到宿主机：数据库只给同网络的应用用。需要本机客户端连库时再临时 `-p 3306:3306`，减少暴露面。

## 清理时别误删数据

```bash
docker system df              # 看镜像/容器/卷占用
docker system prune           # 清无用容器、网络、悬空镜像等
docker system prune --volumes # 会连未使用的卷一起删
```

`--volumes` 很危险：本地 MySQL 数据、测试库都可能没。删卷前先 `docker volume ls` 和 `inspect` 确认没有还要的名字。

`docker rm -v` 删除容器时若带匿名卷，也可能把匿名卷清掉。命名卷相对安全，但仍不是备份系统——重要数据要有外部备份策略。

## 容易踩的坑

1. **以为容器文件系统永久**：重启还在 ≠ 删除后还在。
2. **bind 空目录盖掉镜像内数据**：挂载前确认宿主机侧内容。
3. **用容器 IP 写死连接串**：重建后 DNS/IP 变化导致偶发连不上。
4. **host 网络当银弹**：性能换隔离，端口冲突自己扛。
5. **生产只谈 Docker 网络模式**：集群还有 CNI、Service、安全组，层次不同。

多服务本地联调时，网络和卷通常直接写进 Compose 文件，见下一篇。

## 小结

1. 本地默认 bridge + 端口映射覆盖多数场景；多容器互通优先自定义网络 + 服务名 DNS。
2. 持久化优先命名卷；bind mount 适合开发热更新与挂配置。
3. tmpfs 只放临时数据；别当数据库存储。
4. 删容器不等于删卷，但 `prune --volumes` 会真删未使用卷。
5. 生产网络与存储还要单独设计安全边界和备份，不能只停在单机 Docker 参数。

## 参考

综合自容器网络与存储的常见工程实践整理；bridge/host/none 与 volume/bind/tmpfs 的取舍按 Docker 本地部署场景核对。
