---
title: "窗口函数解决什么问题？"
description: "讲清 RANK/DENSE_RANK/ROW_NUMBER 的区别，以及 Top-N、累计、偏移等经典场景。"
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
  text: "UNION 和 UNION ALL 有什么区别？"
  link: "/database/sql/sql-set-operations.html"
next:
  text: "NULL 和 CASE WHEN 有哪些坑？"
  link: "/database/sql/sql-null-and-case.html"
---

# 窗口函数解决什么问题？

> 窗口函数是 SQL 进阶的分水岭。它解决的痛点很具体：既想做聚合统计，又不想像 `GROUP BY` 那样把多行压成一行——想在保留每一行的同时，给每行附上一个"按组算出来的值"。排名、累计、同组 Top-N，没它之前得写很丑的自连接。

## 它和 GROUP BY 的根本区别

`GROUP BY` 做聚合时，每个组**只剩一行**（见 [聚合分组那篇](./sql-groupby-aggregate.html)）。但很多需求不是这样——你想保留明细，又想给每行带个统计值，比如"每个顾客的每笔订单，配上他本人的历史平均消费"。`GROUP BY` 一压行就丢了明细，窗口函数就是干这个的：

```sql
-- GROUP BY：每个顾客压成一行
SELECT cust_id, AVG(amount) FROM orders GROUP BY cust_id;

-- 窗口函数：每行都保留，旁边多一列该顾客的平均消费
SELECT order_id, cust_id, amount,
       AVG(amount) OVER (PARTITION BY cust_id) AS cust_avg
FROM   orders;
```

`OVER (...)` 就是定义"窗口"：在哪个范围内、按什么排，算这个函数。**窗口函数算完不改变行数**，只是给每行加一列。

## OVER 子句三件套

```sql
函数名() OVER (
  PARTITION BY 分组列   -- 按什么分组（窗口边界）
  ORDER BY     排序列   -- 组内按什么排
  ROWS/RANGE   ...      -- 窗口帧范围（可选）
)
```

- `PARTITION BY`：相当于"分组"，但不像 GROUP BY 那样压行，只是划定每组边界。
- `ORDER BY`：组内排序，对排名类函数是必须的。
- 窗口帧：进一步限定"当前行参与计算的行范围"，比如"从组首到当前行"做累计。不写时默认看整组。

## 三个排名函数：ROW_NUMBER / RANK / DENSE_RANK

这是窗口函数里最高频的考点。假设按分数降序排名：

```sql
SELECT name, score,
       ROW_NUMBER() OVER (ORDER BY score DESC) AS rn,
       RANK()       OVER (ORDER BY score DESC) AS rk,
       DENSE_RANK() OVER (ORDER BY score DESC) AS dk
FROM   exam;
```

数据 `90, 90, 80, 70`，三个函数的结果：

| name | score | rn (ROW_NUMBER) | rk (RANK) | dk (DENSE_RANK) |
| ---- | ----- | --------------- | --------- | --------------- |
| A    | 90    | 1               | 1         | 1               |
| B    | 90    | 2               | 1         | 1               |
| C    | 80    | 3               | 3         | 2               |
| D    | 70    | 4               | 4         | 3               |

区别就在并列时怎么处理：

- **`ROW_NUMBER()`**：强制每行一个不同的号，并列也给不同名次（1、2、3、4）。要"严格取前 N 名、不允许并列"用它。
- **`RANK()`**：并列同名次，但**下一名会跳号**（1、1、3、4）。两个并列第一后，第三名直接是 3。
- **`DENSE_RANK()`**：并列同名次，**下一名不跳号**（1、1、2、3）。两个并列第一后，下一个是 2。

一句话记：**`ROW_NUMBER` 不并列、`RANK` 跳号、`DENSE_RANK` 不跳号。** "每类前三名"这种允许并列的需求，通常用 `DENSE_RANK`。

## 经典场景一：分组 Top-N

"每个部门薪水前三的员工"——这是窗口函数最经典的用途。思路：按部门分组、按薪水降序排名，再在外层过滤排名 ≤ 3。

```sql
SELECT dept, name, salary FROM (
  SELECT dept, name, salary,
         DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rk
  FROM   employee
) t
WHERE  rk <= 3;
```

注意窗口函数不能直接写在 `WHERE` 里（它得在 `SELECT` 阶段算），所以套一层子查询，先算出排名再过滤。这正好印证了 [执行顺序](./sql-execution-order.html)：窗口函数在 SELECT 阶段执行，WHERE 在它之前，拿不到排名。

## 经典场景二：累计求和

加个 `ORDER BY` 后，聚合窗口函数的默认行为变成"从组首累加到当前行"，正好做累计：

```sql
SELECT month, revenue,
       SUM(revenue) OVER (ORDER BY month) AS running_total
FROM   monthly_sales;
```

| month | revenue | running_total |
| ----- | ------- | ------------- |
| 1     | 100     | 100           |
| 2     | 200     | 300           |
| 3     | 150     | 450           |

配合 `PARTITION BY` 还能做"每组各自累计"，比如每个顾客按时间累计消费。要精确控制范围可以写窗口帧：`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`（默认）或 `ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING`（前后各一行）。

## 经典场景三：偏移访问 LEAD / LAG

`LAG()` 取前一行、`LEAD()` 取后一行，常做环比、同比、连续行比较：

```sql
SELECT day, sales,
       LAG(sales, 1) OVER (ORDER BY day) AS prev_day,
       sales - LAG(sales, 1) OVER (ORDER BY day) AS diff
FROM   daily_sales;
```

"和昨天比涨跌多少""连续 N 天满足条件"这类需求，没 `LAG`/`LEAD` 得靠自连接，有了它一行搞定。

## 其他常用窗口函数

- **`NTILE(n)`**：把组内按顺序均分成 n 个桶，返回桶号，做"四分位""十分位"分段。
- **`FIRST_VALUE()` / `LAST_VALUE()`**：取窗口内第一/最后一个值。注意 `LAST_VALUE` 默认窗口帧到当前行，要取"组内最后"得显式写 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`。
- **`SUM/AVG/COUNT/MIN/MAX` OVER**：聚合函数加 `OVER` 就是窗口版，算组级统计不压行。

## 容易踩的坑

- **窗口函数不能进 WHERE**：它在 SELECT 阶段才算，要过滤排名得套子查询。
- **`LAST_VALUE` 默认不到组尾**：默认窗口帧止于当前行，取整组最后值要显式扩大帧范围。
- **版本要求**：窗口函数是 MySQL **8.0** 才支持的，5.7 及更早写不了，老项目升级时要注意。
- **排名函数选错**：允许并列用 `DENSE_RANK`，要严格不并列用 `ROW_NUMBER`，`RANK` 会跳号。

## 小结

- 窗口函数 = 聚合 + 不压行，`OVER(PARTITION BY ... ORDER BY ...)` 定义窗口，行数不变。
- `ROW_NUMBER` 不并列、`RANK` 并列且跳号、`DENSE_RANK` 并列不跳号。
- 分组 Top-N：窗口函数排名后套子查询过滤 `rk <= N`。
- `SUM/AVG OVER (ORDER BY ...)` 做累计，`LAG/LEAD` 做偏移比较。
- 窗口函数在 SELECT 阶段执行，不能直接进 WHERE；MySQL 8.0 起支持。

## 参考

综合社区 SQL 题目中窗口函数章节的函数说明与真题（每类试卷前三名、累计作答数等）重写；其中"窗口函数与 GROUP BY 的本质区别""LAST_VALUE 默认帧范围""不能进 WHERE 的执行顺序原因"是资料未点透、结合 [执行顺序](./sql-execution-order.html) 与 MySQL 8.0 官方文档展开讲清的部分。
