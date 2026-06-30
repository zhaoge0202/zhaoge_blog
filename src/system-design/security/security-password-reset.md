---
title: "密码为什么只能重置不能找回？"
description: "从哈希、加盐和重置令牌讲清密码存储与找回边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "安全"
tag:
  - "必会"
  - "细节题"
  - "项目实战"
prev:
  text: "RBAC 权限模型怎么设计？"
  link: "/system-design/security/security-rbac-design.html"
next:
  text: "常见加密算法在后端系统里怎么用？"
  link: "/system-design/security/security-crypto-algorithms.html"
---

# 密码为什么只能重置不能找回？

> 合格系统不应该知道用户明文密码。服务端只能验证密码是否匹配，不能把原密码“找回来”。

## 密码应该怎么存？

密码入库前应做单向哈希，并为每个用户使用独立 salt。

```text
password + salt -> 慢哈希算法 -> password_hash
```

登录时重新计算哈希并比较结果。数据库泄露时，攻击者拿到的也只是哈希和 salt，不能直接得到明文。

更推荐使用专门的密码哈希算法，如 bcrypt、scrypt、Argon2，而不是普通 MD5/SHA-256。普通摘要太快，容易被离线爆破。

## 为什么是重置不是找回？

找回意味着系统能取回明文密码，这说明密码要么明文存储，要么可逆加密存储。两者都不应该出现在合格系统里。

正确流程是：

1. 用户发起重置。
2. 系统验证邮箱、手机、MFA 或人工流程。
3. 生成短期一次性重置令牌。
4. 用户设置新密码。
5. 清理旧登录态和重置令牌。

## 小结

1. 密码应使用单向慢哈希存储，而不是明文或可逆加密。
2. salt 用来防彩虹表和相同密码哈希相同的问题。
3. 重置令牌要短期、一次性、可吊销。
4. 重置成功后应失效旧 Session/Token。

## 参考

基于 IETF RFC 6265、RFC 7519、RFC 6749、RFC 8018、OWASP Cheat Sheet Series 与 NIST SP 800-63B 中认证、授权、会话、JWT、密码存储、加密和数据保护相关内容整理。
