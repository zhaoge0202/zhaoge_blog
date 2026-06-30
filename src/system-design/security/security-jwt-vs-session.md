---
title: "JWT 为什么不能无脑替代 Session？"
description: "从主动失效、权限变更和令牌泄露讲清 JWT 的使用边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "安全"
tag:
  - "高频"
  - "细节题"
  - "项目实战"
prev:
  text: "Session、Cookie、Token、JWT 怎么选？"
  link: "/system-design/security/security-session-cookie-token-jwt.html"
next:
  text: "单点登录 SSO 是怎么工作的？"
  link: "/system-design/security/security-sso-flow.html"
---

# JWT 为什么不能无脑替代 Session？

> JWT 的优势是无状态和易扩展，弱点也来自无状态：签出去以后，服务端很难在过期前自然收回。

## JWT 好在哪里？

JWT 通常由三段组成：

```text
header.payload.signature
```

服务端只要用密钥验签，就能知道 Token 有没有被篡改。网关也可以直接读取过期时间、用户 ID、租户 ID 等声明。

这带来两个收益：

- 多实例服务不用集中查 Session。
- 网关可以先做一层统一鉴权。

## 真正的问题是什么？

JWT 最大的问题是主动控制弱。

假设用户改了密码、管理员收回权限、账号被封禁，但之前签发的 JWT 还有 30 分钟才过期。如果服务端只验签和过期时间，这个 Token 在 30 分钟内仍然有效。

常见补救方案：

| 方案                     | 做法                         | 代价             |
| ------------------------ | ---------------------------- | ---------------- |
| 缩短 Access Token 有效期 | 例如 5-15 分钟               | 刷新更频繁       |
| Refresh Token            | 用长期令牌换短期令牌         | 要保护刷新链路   |
| 黑名单                   | 吊销 Token 后记录 jti        | 又引入服务端状态 |
| 用户版本号               | Token 带版本，权限变更时递增 | 每次要查用户版本 |

所以 JWT 不是不能用，而是不能只用“无状态”这一个优点做选型。

## 放在哪里也有取舍

放 `localStorage`，前端取用方便，但 XSS 一旦发生容易被脚本读走。

放 `HttpOnly Cookie`，脚本读不到，但浏览器会自动携带，需要配合 SameSite、CSRF Token 等防护。

安全设计里没有免费午餐，关键是知道自己在防什么攻击。

## 小结

1. JWT 适合跨服务、网关自校验和无状态扩展场景。
2. JWT 不擅长主动失效，权限变化和封禁要有额外机制。
3. 短期 Access Token + Refresh Token 是常见折中。
4. Token 存储位置要同时考虑 XSS 和 CSRF。

## 参考

基于 IETF RFC 6265、RFC 7519、RFC 6749、RFC 8018、OWASP Cheat Sheet Series 与 NIST SP 800-63B 中认证、授权、会话、JWT、密码存储、加密和数据保护相关内容整理。
