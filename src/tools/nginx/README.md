---
title: "Nginx"
description: "Nginx 专题，覆盖反向代理与 upstream、连接复用、超时重试语义、缓冲、gzip 与限流配置。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "Pod 起不来、被杀、上不了线，按什么顺序查？"
  link: "/tools/kubernetes/kubernetes-troubleshooting.html"
next:
  text: "Nginx 反向代理和 upstream 怎么配？为什么后端说超时了它还在等？"
  link: "/tools/nginx/nginx-reverse-proxy-upstream.html"
---

# Nginx

## 为什么重要

后端很少写 Nginx 配置，但线上大半"奇怪现象"都发生在这一层：

- 后端早就 504 了，Nginx 还在等——因为 `proxy_read_timeout` 量和后端不是一个语义；
- 压测上不去、`TIME_WAIT` 暴涨——到 upstream 的 keepalive 三件套只写了一半；
- 流式输出"憋一会儿再一次性吐出来"——`proxy_buffering` 默认开着；
- 偶发重复下单——`proxy_next_upstream` 默认会为**非幂等**请求也换一台重试；
- 限流把正常用户限了——`burst` 和 `nodelay` 的语义凭感觉配。

这一栏只讲 Java 后端真会踩的那部分：连接、超时、重试、缓冲、限流、缓存与日志字段。

## 题目列表

- [Nginx 反向代理和 upstream 怎么配？为什么后端说超时了它还在等？](./nginx-reverse-proxy-upstream.html) — location 匹配、keepalive 三件套、超时三兄弟、重试陷阱与 502/504 定位。
- [Nginx 缓冲、gzip 和限流怎么配？哪些默认值会把流式和大文件坑死？](./nginx-buffer-timeout-limit.html) — `proxy_buffering`、gzip 与 SSE 的冲突、`limit_req` 真实语义、缓存与鉴权泄漏、日志三字段。

## 和 Kubernetes、网关的分工

[Kubernetes](/tools/kubernetes/) 讲 Service/Ingress 层怎么把流量送进集群；[Spring Cloud Gateway](/system-design/spring-cloud/spring-cloud-gateway-filter-limit.html) 讲应用级网关的路由与过滤。Nginx 常在这两者之间或最前面，负责 TLS 终止、静态资源、粗粒度限流与缓存——三层各有各的超时与缓冲，出问题时要按"从外到内"逐跳对齐。

## 怎么用这一栏

1. 先记住三组数字的语义：连接复用三件套、超时三兄弟、三层上限（连接、队列、工作线程）。
2. 每个"默认就开着"的开关（`proxy_buffering`、`gzip`、`client_max_body_size`）都要能说出它会在什么场景下咬人。
3. 排查时先看 `$request_time` 与 `$upstream_response_time`，再决定往哪一层深挖。
