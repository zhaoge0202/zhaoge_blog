---
title: "Session、Cookie、Token、JWT 怎么选？"
description: "从浏览器会话、服务端状态和无状态令牌讲清登录态选型。"
breadcrumb: true
article: true
editLink: false
category:
  - "安全"
tag:
  - "高频"
  - "基础"
  - "体系化"
prev:
  text: "认证和授权有什么区别？"
  link: "/system-design/security/security-authentication-authorization.html"
next:
  text: "JWT 为什么不能无脑替代 Session？"
  link: "/system-design/security/security-jwt-vs-session.html"
---

# Session、Cookie、Token、JWT 怎么选？

> Cookie 是浏览器存储和自动携带机制，Session 是服务端会话状态，Token 是令牌思想，JWT 是一种自包含 Token 格式。

## 先把四个词摆正

| 名词    | 核心作用                           | 常见位置               |
| ------- | ---------------------------------- | ---------------------- |
| Cookie  | 浏览器保存少量数据并按域名自动携带 | 客户端                 |
| Session | 服务端保存用户登录态               | 服务端内存/Redis       |
| Token   | 客户端携带的访问凭证               | Header/Cookie          |
| JWT     | 有标准结构和签名的 Token           | 客户端保存，服务端验签 |

Cookie 和 Session 不是同一层概念。典型 Session 登录里，Cookie 只保存 `sessionId`，真正的用户状态在服务端。

## Session 适合什么场景？

Session 的优势是可控。用户退出、改密码、封禁账号时，服务端可以删除或标记 Session，立刻让登录态失效。

适合：

- 管理后台。
- 对主动踢下线要求高的系统。
- 权限变化要马上生效的系统。

代价是服务端要存状态，多实例部署时通常要放 Redis，并处理过期、续期和容量。

## Token 和 JWT 适合什么场景？

Token 的优势是跨端、跨服务传递方便。JWT 进一步把用户标识、签发时间、过期时间等声明放进令牌，并通过签名防篡改。

适合：

- 移动端、开放 API。
- 网关统一鉴权。
- 对水平扩容要求高、能接受短期令牌有效的系统。

但 JWT 一旦签发，在过期前天然不容易主动失效。要解决这个问题，需要黑名单、版本号、短期 Access Token + Refresh Token 等配套方案。

## 怎么选？

可以按这几个问题判断：

1. 是否必须随时踢下线？是的话优先 Session 或 Token 黑名单。
2. 是否主要是浏览器站点？是的话 Cookie + Session 仍然简单可靠。
3. 是否有移动端和开放 API？Token 更自然。
4. 是否需要网关自校验？JWT 可以减少中心鉴权调用。
5. 是否能接受令牌泄露窗口？不能就缩短有效期并做刷新令牌轮换。

## 小结

1. Cookie 是传输和存储机制，不等于登录态本身。
2. Session 有状态但可控，适合后台和强管控系统。
3. Token/JWT 易扩展，但要处理吊销、续期和泄露风险。
4. 选型要看主动失效、跨端接入和服务端状态成本。

## 参考

基于 IETF RFC 6265、RFC 7519、RFC 6749、RFC 8018、OWASP Cheat Sheet Series 与 NIST SP 800-63B 中认证、授权、会话、JWT、密码存储、加密和数据保护相关内容整理。
