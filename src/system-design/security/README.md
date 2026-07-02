---
title: "安全"
description: "认证授权、密码存储与常见漏洞防护专题，覆盖对外系统的安全设计要点。"
article: false
breadcrumb: true
editLink: false
next:
  text: "认证和授权有什么区别？"
  link: "/system-design/security/security-authentication-authorization.html"
---

# 安全

## 为什么重要

认证授权、密码存储、常见漏洞是任何对外系统都要处理的问题，也是设计题里容易被追问的细节。

## 知识主线

认证与授权 -> 会话与令牌 -> 密码与加密 -> 常见漏洞防护

## 题目列表

- [认证和授权有什么区别？](./security-authentication-authorization.html) — 先分清身份校验和权限校验。
- [Session、Cookie、Token、JWT 怎么选？](./security-session-cookie-token-jwt.html) — 从有状态会话到无状态令牌讲清取舍。
- [JWT 为什么不能无脑替代 Session？](./security-jwt-vs-session.html) — 重点看主动失效、续期和泄露风险。
- [单点登录 SSO 是怎么工作的？](./security-sso-flow.html) — 统一认证中心、票据和跨系统登录态。
- [RBAC 权限模型怎么设计？](./security-rbac-design.html) — 用户、角色、权限和资源粒度设计。
- [密码为什么只能重置不能找回？](./security-password-reset.html) — 密码哈希、加盐和重置链路安全。
- [常见加密算法在后端系统里怎么用？](./security-crypto-algorithms.html) — 摘要、对称、非对称和签名的分工。
- [数据脱敏和字段加密怎么落地？](./security-data-masking-encryption.html) — 展示脱敏、存储加密和密钥管理。
