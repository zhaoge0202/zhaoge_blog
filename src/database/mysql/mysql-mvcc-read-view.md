---
title: "MVCC 和 ReadView 是怎么工作的？"
description: "MVCC 是 MySQL 事务面试最核心的原理题。"
breadcrumb: true
article: true
editLink: false
category:
  - "MySQL"
tag:
  - "ADVANCED"
  - "MUST_KNOW"
  - "DEEP_EXPLAIN"
prev:
  text: "G1 相比 CMS 改进了什么？"
  link: "/java/jvm/jvm-g1-vs-cms.html"
next:
  text: "如何保证缓存和数据库一致性？"
  link: "/database/redis/redis-cache-consistency.html"
---

# MVCC 和 ReadView 是怎么工作的？

> MVCC 是 MySQL 事务面试最核心的原理题。

## 30 秒回答

MVCC 通过 undo log 版本链和 ReadView 判断版本可见性，让普通快照读在不加锁的情况下看到一致性视图。

## 2 分钟回答

回答时先说明版本链，再说明 ReadView 中活跃事务集合、最小事务 ID、下一个事务 ID 如何判断某个版本是否可见。RC 和 RR 的差异主要在 ReadView 创建时机。

## 深度解释

不要把 MVCC 说成单纯“不加锁”。它解决的是快照读一致性，当前读仍然需要锁。幻读问题还要结合间隙锁和临键锁讨论。

## 回答策略

先讲解决的问题，再讲数据结构，最后讲 RC/RR 差异和幻读边界。

## 题目信息

- 专题：[MySQL](./)
- 难度：ADVANCED
- 高频程度：MUST_KNOW
- 掌握层级：DEEP_EXPLAIN

## 追问链路

- **RC 和 RR 的 ReadView 创建时机有什么不同？**：RC 每次快照读创建，RR 通常事务内第一次快照读创建后复用。

## 常见误区

### MVCC 可以解决所有幻读问题。

- 为什么错：MVCC 主要服务快照读，当前读下仍需要锁机制。
- 正确说法：需要区分快照读和当前读，再讨论 RR 下 MVCC 与临键锁的配合。

## 纠偏记录

### MVCC 不能脱离锁讨论幻读

- 问题：只讲版本链会让回答缺少边界。
- 修正：补充当前读、间隙锁和临键锁。
- 证据：InnoDB 事务隔离实现和锁行为。
- 来源：PERSONAL_REVIEW

## 项目映射

### 订单、库存、账户等事务读写。

- 项目表达：说明隔离级别选择、快照读和当前读差异。
- 风险点：误把普通查询和加锁查询混为一谈会导致一致性判断错误。
- 面试回答：我会根据读写语义区分快照读和当前读，对关键写路径使用合适锁策略。

## 参考资料

- InnoDB 事务模型、隔离级别实验和执行过程推演更适合交叉验证 ReadView 可见性判断。
