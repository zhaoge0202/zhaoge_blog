---
title: "RBAC 权限模型怎么设计？"
description: "从用户、角色、权限和资源粒度讲清 RBAC 权限系统设计。"
breadcrumb: true
article: true
editLink: false
category:
  - "安全"
tag:
  - "高频"
  - "项目实战"
  - "体系化"
prev:
  text: "单点登录 SSO 是怎么工作的？"
  link: "/system-design/security/security-sso-flow.html"
next:
  text: "密码为什么只能重置不能找回？"
  link: "/system-design/security/security-password-reset.html"
---

# RBAC 权限模型怎么设计？

> RBAC 的关键是不要把权限直接塞给用户，而是用“用户 -> 角色 -> 权限 -> 资源动作”把授权关系解耦。

## 最小模型是什么？

最小 RBAC 通常需要 5 类表：

| 表              | 作用           |
| --------------- | -------------- |
| user            | 用户           |
| role            | 角色           |
| permission      | 权限点         |
| user_role       | 用户与角色关系 |
| role_permission | 角色与权限关系 |

权限点最好表达为“资源 + 动作”，例如：

```text
order:read
order:update
user:disable
report:export
```

这样接口鉴权时可以把请求映射到明确权限点。

## 只靠角色够吗？

不够。角色解决“能做什么”，还要结合数据范围解决“能对哪些数据做”。

比如销售主管有 `order:read` 权限，但只能看自己团队的订单；租户管理员能管理用户，但只能管理本租户用户。

常见数据范围：

- 本人数据。
- 本部门数据。
- 本租户数据。
- 指定项目/门店/区域数据。

## 工程落地怎么做？

推荐分三层：

1. 网关或拦截器解析用户身份。
2. 权限组件判断接口所需权限点。
3. 业务查询追加数据范围条件。

不要把权限逻辑散落在各个 Controller 里，否则后期很难审计。

## 小结

1. RBAC 用角色承接用户和权限，降低授权维护成本。
2. 权限点建议设计成资源 + 动作。
3. 角色权限之外还要处理数据范围，否则容易越权。
4. 权限校验要组件化，关键操作要有审计日志。

## 参考

基于 IETF RFC 6265、RFC 7519、RFC 6749、RFC 8018、OWASP Cheat Sheet Series 与 NIST SP 800-63B 中认证、授权、会话、JWT、密码存储、加密和数据保护相关内容整理。
