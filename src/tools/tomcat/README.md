---
title: "Tomcat"
description: "Tomcat 专题，讲连接器与线程模型、maxThreads/acceptCount/maxConnections 三层上限，以及和连接池的匹配。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "Nginx 缓冲、gzip 和限流怎么配？哪些默认值会把流式和大文件坑死？"
  link: "/tools/nginx/nginx-buffer-timeout-limit.html"
next:
  text: "Tomcat 的连接器和线程模型是怎么跑的？线程数该调多少？"
  link: "/tools/tomcat/tomcat-connector-thread-model.html"
---

# Tomcat

## 为什么重要

Spring Boot 内嵌 Tomcat 让人误以为"容器不用管"，但线上这层的问题很集中：

- 线程数满了、请求排队，表现为 RT 全线拉长，CPU 却不高；
- `acceptCount` 满了，客户端拿到连接被拒，日志里什么都看不到；
- 只把 `maxThreads` 调到 1000，结果是 1000 个线程一起去抢 20 个数据库连接；
- `connectionTimeout` 被当成"接口处理超时"来配，排查方向直接跑偏。

这一栏讲的是"请求在容器这一层怎么被接住、排队、执行、释放"，以及这些数字怎么和连接池、下游超时对齐。

## 题目列表

- [Tomcat 的连接器和线程模型是怎么跑的？线程数该调多少？](./tomcat-connector-thread-model.html) — Acceptor/Poller/Worker 三层、四个关键数字、吞吐算术、与连接池的匹配、异步与虚拟线程。

## 和线程池那一栏的分工

[Java 并发](/java/concurrent/) 讲线程池本身的原理与参数语义；这一栏讲**容器为什么需要线程池**、请求在哪一层排队、三层上限满了各是什么现象。两篇连起来看，才能回答"线程数到底该调多少"。

## 怎么用这一栏

1. 背下三层的区别：连接上限（`maxConnections`）→ 等待队列（`acceptCount`）→ 工作线程（`maxThreads`）。
2. 能用"线程数 ÷ 平均耗时 = 吞吐上限"现场算一遍，比背参数值有用。
3. 调任何线程数之前，先确认数据库连接池和下游超时撑不撑得住。
