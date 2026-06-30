---
title: "各种 JOIN 到底有什么区别？"
description: "用具体数据讲清 INNER/LEFT/RIGHT/FULL/CROSS JOIN，以及 ON 和 WHERE 的差别。"
breadcrumb: true
article: true
editLink: false
category:
  - "SQL"
tag:
  - "必会"
  - "高频"
  - "基础"
prev:
  text: "GROUP BY、聚合和 HAVING 怎么配合？"
  link: "/database/sql/sql-groupby-aggregate.html"
next:
  text: "子查询怎么用？和 JOIN 怎么选？"
  link: "/database/sql/sql-subquery.html"
---

# 各种 JOIN 到底有什么区别？

> JOIN 的几种类型，光背"内连接取交集、左连接保留左表"容易记混；拿两张小表把每种 JOIN 的结果跑一遍，差别就刻在脑子里了，而 `ON` 和 `WHERE` 在外连接里的不同才是真正的分水岭。

## JOIN 在干什么

JOIN 的本质是**把两张表的行按某个条件拼成一张宽表**——满足连接条件的两行合成一行。最常见的是用相等条件关联外键：

```sql
SELECT c.cust_name, o.order_id, o.amount
FROM   customers c
JOIN   orders o ON c.cust_id = o.cust_id;
```

不加修饰词的 `JOIN` 默认就是 `INNER JOIN`。如果两张表的关联字段同名，可以用 `USING` 代替 `ON`：`JOIN orders USING(cust_id)`。

下面用两张极简表，把每种 JOIN 的结果看清楚。左表 `L`（顾客）、右表 `R`（订单）：

```
L (顾客)          R (订单)
id | name         id | cust_id | amt
1  | Alice        10 | 1       | 100
2  | Bob          11 | 1       | 200
3  | Carol        12 | 2       | 150
4  | Dave         13 | 9       | 300   -- cust_id=9 在 L 里不存在
```

## INNER JOIN：只要两边都有的

```sql
SELECT l.name, r.amt
FROM   L l INNER JOIN R r ON l.id = r.cust_id;
```

| name  | amt |
| ----- | --- |
| Alice | 100 |
| Alice | 200 |
| Bob   | 150 |

Carol（没订单）、Dave（没订单）、amt=300（cust_id=9 不存在）全部丢掉。**只保留两表能匹配上的行**。

## LEFT JOIN：左表全保留，右表匹配不上补 NULL

```sql
SELECT l.name, r.amt
FROM   L l LEFT JOIN R r ON l.id = r.cust_id;
```

| name  | amt  |
| ----- | ---- |
| Alice | 100  |
| Alice | 200  |
| Bob   | 150  |
| Carol | NULL |
| Dave  | NULL |

Carol、Dave 在 R 里没匹配项，但因为是**左连接**，它们仍保留，右表字段补 NULL。这是 LEFT JOIN 最常见的用法：**"查所有顾客及其订单，没下过单的也要列出来"**。

## RIGHT JOIN：右表全保留，左表匹配不上补 NULL

```sql
SELECT l.name, r.amt
FROM   L l RIGHT JOIN R r ON l.id = r.cust_id;
```

| name  | amt |
| ----- | --- |
| Alice | 100 |
| Alice | 200 |
| Bob   | 150 |
| NULL  | 300 |

这次 cust_id=9 那条订单保留了（右表全保留），但 L 里没有对应顾客，`name` 补 NULL。RIGHT JOIN 实际用得少——把左右表换一下写成 LEFT JOIN 更符合从左到右的阅读习惯。

## FULL JOIN：两边都全保留

```sql
SELECT l.name, r.amt
FROM   L l FULL JOIN R r ON l.id = r.cust_id;
```

| name  | amt  |
| ----- | ---- |
| Alice | 100  |
| Alice | 200  |
| Bob   | 150  |
| Carol | NULL |
| Dave  | NULL |
| NULL  | 300  |

两边匹配不上的都保留、补 NULL。

> ⚠️ **MySQL 不支持 `FULL JOIN`**。要用 `LEFT JOIN` 和 `RIGHT JOIN` 用 `UNION` 拼起来模拟：
>
> ```sql
> SELECT l.name, r.amt FROM L l LEFT JOIN R r ON l.id = r.cust_id
> UNION
> SELECT l.name, r.amt FROM L l RIGHT JOIN R r ON l.id = r.cust_id;
> ```
>
> 这是资料里经常漏掉的边界，面试问到全连接时点一句"MySQL 得用 UNION 模拟"是加分项。

## CROSS JOIN：笛卡尔积

```sql
SELECT l.name, r.amt FROM L l CROSS JOIN R r;
-- 等价于 SELECT l.name, r.amt FROM L, R;
```

不写连接条件，左表每行配右表每行，`4 × 4 = 16` 行。绝大多数时候是误写（忘了写 `ON`），慎用。

## SELF JOIN：自己连自己

一张表当两张表用，常用于"找上下级""找同类项"这类场景，靠给表起不同别名区分：

```sql
SELECT a.name AS 员工, b.name AS 上级
FROM   employee a
JOIN   employee b ON a.manager_id = b.id;
```

## 真正的分水岭：ON 和 WHERE 在外连接里不一样

资料里常说"`ON` 是连接条件、`WHERE` 是连接后的过滤"，这在内连接里没区别（两张表都行），**但在外连接里结果完全不同**。这是 JOIN 最容易踩的坑。

还是上面那张 `L LEFT JOIN R`，现在加一个条件：只要金额大于 120 的订单。两种写法：

**写法一：条件放 ON**

```sql
SELECT l.name, r.amt
FROM   L l LEFT JOIN R r
       ON l.id = r.cust_id AND r.amt > 120;
```

| name  | amt  |
| ----- | ---- |
| Alice | 200  |
| Bob   | 150  |
| Carol | NULL |
| Dave  | NULL |

Alice 的 amt=100 被 `ON` 挡掉了，但 Alice 这行**没被丢掉**——LEFT JOIN 保证左表全保留，只是她的订单字段补了 NULL（因为没匹配上 amt>120 的）。结果 Carol、Dave 仍是 NULL，Alice 也"看起来像没下过单"。

**写法二：条件放 WHERE**

```sql
SELECT l.name, r.amt
FROM   L l LEFT JOIN R r
       ON l.id = r.cust_id
WHERE  r.amt > 120;
```

| name  | amt |
| ----- | --- |
| Alice | 200 |
| Bob   | 150 |

这次 `WHERE` 是在连接**之后**过滤，amt=100 和所有 NULL 行（Carol、Dave）都被砍掉，LEFT JOIN 退化得像 INNER JOIN。

**结论**：

- 对**外连接**，`ON` 决定"怎么匹配、匹配不上补 NULL"；`WHERE` 决定"匹配完之后整行要不要"。放错地方，结果集会悄悄变样。
- 对**内连接**，`ON` 和 `WHERE` 效果一样，因为匹配不上的行本来就会被丢掉。

一条经验法则：**"用来定义关联关系"的条件放 `ON`，"用来筛掉不要的行"的条件放 `WHERE`**。尤其当你写 LEFT JOIN 是为了"保留左表全部行"时，对右表的过滤条件一定要想清楚放哪——放 WHERE 会把左表也一起过滤掉，破坏你用左连接的初衷。

## 容易踩的坑

- **LEFT JOIN 的右表过滤放 WHERE 会退化成内连接**：想保留左表全行，右表条件要放 `ON`。
- **MySQL 没有 FULL JOIN**：得用 LEFT JOIN `UNION` RIGHT JOIN 模拟。
- **忘了写 ON 会变笛卡尔积**：`JOIN` 不带 `ON`（CROSS JOIN）结果行数爆炸，多是笔误。
- **多表 JOIN 重复计数**：一对多关联再 GROUP BY 时，`COUNT(DISTINCT ...)` 去重别忘了，否则关联放大了行数会数多。

## 小结

- `INNER JOIN` 取交集，`LEFT/RIGHT JOIN` 保留一侧全行、另一侧补 NULL，`FULL JOIN` 两侧全保留，`CROSS JOIN` 笛卡尔积。
- `SELF JOIN` 是同一张表起两个别名自连，常用于层级关系。
- 内连接里 `ON` 和 `WHERE` 等价；外连接里完全不同——`ON` 管匹配、`WHERE` 管过滤，放错会让 LEFT JOIN 退化。
- MySQL 不支持 FULL JOIN，用 UNION 模拟。
- LEFT JOIN 产生的一对多放大效应，统计时记得 `COUNT(DISTINCT)`。

## 参考

基于 MySQL 8.0 Reference Manual 中 SQL Statements、Functions and Operators、JOIN、Subqueries、Window Functions 与 Optimization 等相关官方章节整理。
