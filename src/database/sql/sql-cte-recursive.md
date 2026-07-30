---
title: "CTE 和递归查询怎么用？解决哪些问题？"
description: "从 WITH 语法、递归 CTE 锚点到层级查询讲清 CTE 的用法与边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "SQL"
tag:
  - "进阶"
  - "高频"
  - "项目实战"
prev:
  text: "分页查询怎么写？深度分页怎么优化？"
  link: "/database/sql/sql-pagination.html"
next:
  text: "写 SQL 有哪些常见的写法坑？"
  link: "/database/sql/sql-writing-best-practices.html"
---

# CTE 和递归查询怎么用？解决哪些问题？

写多层嵌套子查询，越嵌越深、读到后面已经忘了前面是谁——CTE（Common Table Expression，通用表表达式）就是治这个的。用 `WITH` 把子查询起个名字提到前面，后面像查表一样用，还能递归，是处理层级数据和复杂分析的利器。

## CTE 是什么

```sql
WITH active_users AS (
  SELECT id, name FROM users WHERE status = 'active'
)
SELECT o.* FROM orders o
JOIN active_users u ON o.user_id = u.id;
```

`WITH 名称 AS (子查询)` 定义一个临时的"命名结果集"，作用域是当前语句。本质是**可读性更好的子查询**，不产生物理表，执行时还是展开成子查询。

## CTE 比子查询好在哪

- 可读性：把复杂子查询提到前面命名，主查询清爽。
- 复用：同一 CTE 可在主查询里多次引用，不用重复写。
- 多 CTE 串联：`WITH a AS (...), b AS (SELECT ... FROM a)` 后一个 CTE 能引用前一个，像流水线一样层层加工。

## 递归 CTE：处理层级数据

这是 CTE 最强的能力。递归 CTE 由两部分组成：

```sql
WITH RECURSIVE org AS (
  -- 锚点：起点
  SELECT id, name, parent_id, 1 AS lvl
  FROM departments WHERE parent_id IS NULL
  UNION ALL
  -- 递归成员：基于上一轮结果往下扩
  SELECT d.id, d.name, d.parent_id, o.lvl + 1
  FROM departments d
  JOIN org o ON d.parent_id = o.id
)
SELECT * FROM org ORDER BY lvl;
```

- **锚点（anchor）**：递归的起点，不引用自己。
- **递归成员**：`JOIN` 上一轮的 CTE 自己，往下一层扩。
- **UNION ALL**：把每轮结果拼起来。
- **终止**：递归成员查不出新行时自然停止。

典型场景：组织树、菜单树、物料 BOM、评论楼层、好友关系传递闭包。

## 递归的几个边界

- **必须 UNION ALL**：用 UNION（去重）语义不对，递归 CTE 标准要 ALL。有环数据（A 的 parent 是 B，B 的 parent 是 A）会死循环，要在数据或查询里防环（比如限制 `lvl < 10` 或用已访问集合）。
- **MySQL 版本**：递归 CTE 是 MySQL 8.0 起支持，5.7 没有，老版本只能靠自连接或程序里递归。
- **深度限制**：默认有递归深度上限（cte_max_recursion_depth，MySQL 默认 1000），超了报错。深树要调参数或在程序里处理。
- **性能**：递归 CTE 比程序里循环查库好（少网络往返），但层级很深或数据大时仍可能慢，必要时加索引（parent_id 上建索引）。

## CTE vs 临时表 vs 派生表

|        | CTE                        | 临时表     | 派生表（子查询） |
| ------ | -------------------------- | ---------- | ---------------- |
| 作用域 | 当前语句                   | 当前会话   | 当前语句内嵌     |
| 物化   | 通常不物化（展开成子查询） | 物化写临时 | 不物化           |
| 复用   | 可多次引用                 | 可多次     | 只一次           |
| 递归   | 支持                       | 不直接支持 | 不支持           |

复杂多步骤加工且要复用中间结果，CTE 最合适；跨多条语句复用大结果，临时表更合适。

## 小结

- CTE 用 WITH 把子查询命名前置，提升可读性、可复用，能多 CTE 串联加工。
- 递归 CTE = 锚点 + 递归成员 + UNION ALL，处理组织树、菜单、BOM、评论楼层等层级数据。
- 递归必须 UNION ALL，防环用深度限制或已访问集合；MySQL 8.0 起支持。
- 递归 CTE 比程序循环少网络往返，但深树大数据注意索引和深度上限。
- CTE 不物化、单语句复用；跨语句复用大结果用临时表。

## 参考

本文综合公开 SQL 教材与 MySQL 官方文档，核对了 CTE 语法、递归 CTE 的锚点与递归成员结构、UNION ALL 与防环、版本与深度边界，并对照了 CTE 与临时表、派生表的差异。
