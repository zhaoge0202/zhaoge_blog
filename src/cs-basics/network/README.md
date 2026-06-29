---
title: "计算机网络"
description: "围绕 TCP/IP、TCP 连接、可靠传输和 HTTP/HTTPS 的网络专题。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "操作系统"
  link: "/cs-basics/operating-system/"
next:
  text: "TCP/IP 四层模型怎么理解？和 OSI 七层有什么关系？"
  link: "/cs-basics/network/network-tcp-ip-model.html"
---

# 计算机网络

## 为什么重要

接口、RPC、网关、长连接这些工程问题，最终都要回到 TCP/IP 和 HTTP 的基本原理。

## 知识主线

网络分层模型 -> URL 请求链路 -> TCP 连接生命周期 -> TCP 可靠传输与队列 -> HTTP/HTTPS -> 抓包排障

## 怎么读这个专题

先读网络模型和 URL 全流程，建立“数据从应用到网卡”的路径感；再读 TCP 三次握手、四次挥手、可靠传输、窗口控制和队列，把连接状态、重传、流量控制、拥塞控制讲清楚；最后进入 HTTP/HTTPS 和抓包排障。

## 面试焦点

不是背“七层模型”和“三次握手流程图”，而是能解释每一层解决什么问题、TCP 为什么要维护状态、线上 `TIME_WAIT` / `CLOSE_WAIT` / 重传升高时应该看哪些证据。

## 前置知识

Java Socket、HTTP 基础、Linux 常用命令、操作系统用户态/内核态基础。

## 目标人群

3-5 年 Java 后端工程师。

## 题目列表

### 网络基础

- [TCP/IP 四层模型怎么理解？和 OSI 七层有什么关系？](./network-tcp-ip-model.html) — 分层职责、封装/解封装、OSI 与 TCP/IP 的关系。
- [输入 URL 到页面展示，中间发生了什么？](./network-url-process.html) — URL、DNS、TCP/TLS、HTTP、服务端处理和浏览器渲染全链路。

### TCP 连接生命周期

- [TCP 三次握手到底解决什么问题？](./network-tcp-three-way-handshake.html) — ISN 同步、旧 SYN 误建连接、半连接队列和全连接队列。
- [TCP 四次挥手为什么需要 TIME_WAIT？](./network-tcp-four-way-wave-time-wait.html) — 全双工关闭、`TIME_WAIT`、`CLOSE_WAIT` 和 2MSL。

### TCP 可靠传输与控制

- [TCP 如何保证可靠传输？](./network-tcp-reliability.html) — 序列号、ACK、RTO、快速重传、SACK/D-SACK。
- [滑动窗口、拥塞控制、流量控制分别解决什么问题？](./network-tcp-flow-congestion-control.html) — `rwnd`、`cwnd`、零窗口、Nagle 和拥塞算法。
- [半连接队列和全连接队列满了会发生什么？](./network-tcp-queue-overflow.html) — SYN 队列、Accept 队列、队列溢出和 Linux 参数。
- [服务端没有 accept，客户端连接会怎样？](./network-server-no-accept.html) — `listen()`、`accept()`、全连接队列和客户端超时现象。

### HTTP/HTTPS

- [HTTP/1.1、HTTP/2、HTTP/3 有什么核心区别？](./network-http-versions.html) — 长连接、头部压缩、多路复用、QUIC 和连接迁移。
- [HTTPS RSA 握手和 ECDHE 握手有什么区别？](./network-https-rsa-ecdhe.html) — 身份认证、密钥协商、前向安全和对称加密。
- [HTTP Keep-Alive 和 TCP Keepalive 是一回事吗？](./network-http-keepalive-tcp-keepalive.html) — 应用层连接复用、TCP 保活和长连接回收。

### 抓包排障

- [tcpdump 抓包应该怎么看三次握手和重传？](./network-tcpdump-handshake-retransmission.html) — `tcpdump`、Wireshark、握手异常、重传和零窗口。

## 后续计划

- TCP 与 UDP 的区别与选型。
- DNS、CDN、负载均衡和跨域。
- HTTP 缓存、状态码、断点续传和 Range。
- 网络故障复盘：RST、连接超时、MTU 黑洞和 NAT 端口耗尽。
