---
title: "Kubernetes"
description: "Kubernetes 专题，覆盖核心对象与调度、Service 与 Ingress 流量、配置与资源限制、上不了线怎么查。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "Docker Compose 本地联调怎么用？"
  link: "/tools/docker/docker-compose.html"
next:
  text: "Pod、Deployment、StatefulSet 到底该用哪个？"
  link: "/tools/kubernetes/kubernetes-core-objects.html"
---

# Kubernetes

## 为什么重要

容器只用 Docker 的时候，问题还停留在"镜像怎么打、端口怎么映"。上了 Kubernetes，问题换了一批，而且更贵：

- **对象选错**：拿裸 Pod 当服务，节点重启就没人拉起；拿 Deployment 跑数据库，重启后数据卷对不上；
- **探针配错**：Java 应用启动 60 秒，liveness 却只给 10 秒——容器永远起不来，还查不出原因；
- **资源配错**：`-Xmx` 写 2G 而 limit 只有 1G，进程被 OOMKilled，堆 dump 还来不及写；
- **流量配错**：gRPC 长连接被 kube-proxy 钉在一台 Pod 上，扩容等于没扩；
- **配置配错**：改了 ConfigMap 以为热更新，其实 env 注入的那份永远不会变。

这一栏讲的是"业务服务跑在 K8s 上"这条线上真正会疼的点，不是对象清单背诵。

## 知识主线

```text
对象与调度（声明式调谐 → 控制器选型 → requests/探针/滚动）
  → 流量路径（Service 类型 → kube-proxy 连接级转发 → Ingress 七层路由）
  → 配置与资源（ConfigMap 注入差异 → Secret 不是加密 → limits 与 JVM）
  → 排障顺序（状态 → 事件 → 日志 → 资源 → 网络）
```

## 题目列表

### 对象与流量

- [Pod、Deployment、StatefulSet 到底该用哪个？](./kubernetes-core-objects.html) — 声明式调谐、控制器职责矩阵、调度依据与三探针的差别。
- [Service 和 Ingress 怎么把流量送进集群？为什么长连接总钉在一台？](./kubernetes-service-ingress.html) — Service 类型、kube-proxy 连接级转发、无 endpoint 的四个原因、Ingress 与 Gateway API。

### 配置、资源与排障

- [ConfigMap、Secret 和资源限制怎么配才不出事？](./kubernetes-config-secret-resource.html) — env 与 volume 注入的更新差异、Secret 的边界、requests/limits 与 Java 堆的配比、QoS 与驱逐。
- [Pod 起不来、被杀、上不了线，按什么顺序查？](./kubernetes-troubleshooting.html) — 状态矩阵、事件与 `--previous` 日志、OOMKilled 与探针误杀、Java 专属四条。

## 和 Docker 那一栏的分工

[Docker](/tools/docker/) 讲"镜像怎么打、容器怎么跑、compose 怎么联调"；这一栏讲"镜像交出去之后，谁保证它有副本、有流量、有资源、出了问题怎么查"。发布策略与流水线在 [工程与交付](/engineering/) 里，和这一栏配合看。

## 怎么用这一栏

1. 先能说清"期望状态 + 调谐循环"，再去记对象名，否则永远分不清 Deployment 和 ReplicaSet 的职责。
2. 探针、requests/limits、优雅停机这三件事必须能对应到自己的服务参数上——这三处配错，线上必然出事故。
3. 排障别背命令，背顺序：状态 → 事件 → 日志 → 资源 → 网络，每一步都能说清"我在验证什么"。
