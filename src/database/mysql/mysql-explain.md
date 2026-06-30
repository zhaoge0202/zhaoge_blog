---
title: "执行计划 EXPLAIN 怎么看？"
description: "看懂 type、key、rows、Extra 这几列，就能判断一条 SQL 好不好。"
breadcrumb: true
article: true
editLink: false
category:
  - "MySQL"
tag:
  - "高频"
  - "排障"
  - "项目实战"
prev:
  text: "索引为什么会失效？"
  link: "/database/mysql/mysql-index-invalidation.html"
next:
  text: "count(*)、count(1)、count(字段) 有什么区别？"
  link: "/database/mysql/mysql-count.html"
---

# 执行计划 EXPLAIN 怎么看？

> 优化一条慢 SQL，第一件事不是加索引，而是 `EXPLAIN` 它一下，看看 MySQL 打算怎么跑——看懂 type、key、rows、Extra 这四列，基本就能判断这条 SQL 行不行。

## EXPLAIN 到底是干嘛的

我们写的 SQL 交给 MySQL 之后，并不是按字面顺序去执行的。中间隔着一个**查询优化器**，它会根据表的统计信息、索引情况，自己琢磨出一套它认为最划算的执行方案——先扫哪张表、用不用索引、用哪个索引、要不要排序和回表。这套方案，就叫**执行计划**。

`EXPLAIN` 干的事，就是把这套方案摊开给你看。用法很简单，在 SQL 前面加上 `EXPLAIN` 就行：

```sql
EXPLAIN SELECT * FROM users WHERE age = 25;
```

这里要强调一个很多人会搞混的点：**普通的 `EXPLAIN` 并不会真正执行你的 SQL**，它只是让优化器分析一遍、把计划吐出来。所以哪怕你 `EXPLAIN` 一条会扫几千万行的查询，也不会真的把库跑挂——它只是估算。

如果你想要"真实"数据，MySQL 8.0.18 起提供了 `EXPLAIN ANALYZE`。它和普通 EXPLAIN 不一样，**会真正把查询跑一遍**，然后告诉你每一步的实际耗时和实际行数。这玩意儿排查疑难慢查询时很有用，但正因为它真跑，所以**别在生产环境对大查询用它**——该慢还是会慢，该锁还是会锁。

```sql
mysql> EXPLAIN ANALYZE SELECT * FROM users WHERE age = 25\G
-> Covering index lookup on users using idx_age_score_name (age=25)
   (cost=1.52 rows=12) (actual time=0.0272..0.0344 rows=12 loops=1)
```

`EXPLAIN` 不光能分析 `SELECT`，`UPDATE`、`DELETE`、`INSERT`、`REPLACE` 也都支持，只是日常我们 90% 的场景都是在分析 `SELECT`。

下面是一条最普通的单表查询的输出，先有个直观印象（结果一共 12 列）：

```sql
mysql> EXPLAIN SELECT * FROM users WHERE age = 25;
+----+-------------+-------+------+--------------------+--------------------+---------+-------+------+----------+-------------+
| id | select_type | table | type | possible_keys      | key                | key_len | ref   | rows | filtered | Extra       |
+----+-------------+-------+------+--------------------+--------------------+---------+-------+------+----------+-------------+
|  1 | SIMPLE      | users | ref  | idx_age_score_name | idx_age_score_name | 5       | const |   12 |   100.00 | Using index |
+----+-------------+-------+------+--------------------+--------------------+---------+-------+------+----------+-------------+
```

（为了排版我省掉了 `partitions` 列，未分区表它永远是 NULL，没什么信息量。）

## 每一列在说什么

先用一张表把 12 列过一遍，心里有个全局印象，后面再挑重点列细讲：

| 列名            | 它在告诉你什么                                          | 看它干嘛                       |
| --------------- | ------------------------------------------------------- | ------------------------------ |
| `id`            | 这一行属于第几个 SELECT，决定执行顺序                   | 多表/子查询时判断谁先跑        |
| `select_type`   | 这个 SELECT 是简单查询、子查询、UNION 还是派生表        | 看查询结构复不复杂             |
| `table`         | 这一行操作的是哪张表（也可能是临时派生表 `<derived2>`） | 定位是哪张表的问题             |
| `partitions`    | 命中了哪些分区，未分区表为 NULL                         | 分区表才用得上                 |
| `type`          | **访问类型**：全表扫、范围扫，还是走索引等值查          | **判断好坏的核心列之一**       |
| `possible_keys` | 这次查询**理论上**能用的索引                            | 为 NULL 说明根本没合适索引     |
| `key`           | 优化器**最终实际选用**的索引                            | **核心列**，为 NULL = 没走索引 |
| `key_len`       | 用到的索引占了多少字节                                  | 判断联合索引用到了第几列       |
| `ref`           | 索引等值比较时，跟索引列比的是常量还是某个字段          | 看 join 时谁跟谁比             |
| `rows`          | 优化器**估算**要扫多少行                                | **核心列**，越小越好           |
| `filtered`      | 扫出来的行，过滤后还剩百分之几                          | join 时估算扇出                |
| `Extra`         | 各种附加动作：覆盖索引、回表过滤、文件排序、临时表      | **信息量最大的一列**           |

下面挑真正影响判断的列展开。

### id：谁先执行

`id` 标识每个 SELECT 的执行顺序，记住三句话就够了：

- **id 相同**：从上往下顺序执行，常见于多表 JOIN。
- **id 不同**：**id 越大的越先执行**——子查询的 id 通常比外层大，所以子查询先跑。
- **id 为 NULL**：这一行是 UNION 的合并结果，或者派生表的结果集，它本身不是一次真正的"查询"。

### select_type：这个 SELECT 是什么角色

常见取值就这么几个，认得出来即可：

- **SIMPLE**：最普通的查询，没有 UNION、没有子查询。
- **PRIMARY**：含子查询/UNION 时，最外层那个 SELECT。
- **SUBQUERY**：子查询里的第一个 SELECT。
- **DERIVED**：`FROM` 后面跟的子查询（派生表）。
- **UNION**：UNION 后面的那个 SELECT。
- **UNION RESULT**：UNION 把多个结果合并的那一步。

### type：访问类型，最该盯的列之一

`type` 描述 MySQL 是**怎么找到数据**的，这是判断 SQL 好坏最直接的指标。常见取值按性能从好到差大致是：

```
system > const > eq_ref > ref > range > index > ALL
```

（完整链条中间还有 `fulltext`、`index_merge` 等，但日常排查盯住上面这几个最关键的就够了。）

一个个说重点的：

- **const**：通过**主键**或**唯一索引**做**等值**查询，结果最多一行。比如 `WHERE id = 1`。这是极快的，优化器甚至会把这一行的值当常量来处理。`system` 是 const 的特例（表里就一行），更少见。
- **eq_ref**：多表 JOIN 时，被驱动表用主键/唯一索引连接，**驱动表的每一行在被驱动表里都恰好对应一行**。这是 JOIN 里最理想的类型。
- **ref**：用**普通（非唯一）索引**做等值查询，结果**可能匹配多行**。比如 `age` 上有个普通索引、`WHERE age = 25`。这是日常最常见、也完全可以接受的好类型。
- **range**：对索引列做**范围**查询，比如 `WHERE age BETWEEN 20 AND 30`、`WHERE id > 100`、`IN (...)`。走的是索引，只扫一段区间，通常没问题。
- **index**：**全索引扫描**。它把整棵索引树从头扫到尾。注意——它和 ALL 一样是"全扫"，只是扫的是索引而不是数据行。因为索引体积小、又可能是覆盖索引（不用回表），所以一般比 ALL 快，但**它不是好类型**：大表上照样会扫出大量 I/O，看到它别因为"它排在 ALL 前面"就放心。
- **ALL**：**全表扫描**，一行行从头读到尾，没用上任何索引。这是排查时最需要警惕的信号，绝大多数慢 SQL 都卡在这。

> 一句话经验：**type 至少要到 `range`，理想是 `ref` 或更好；看到 `index` 要留个心眼，看到 `ALL` 基本就是要优化的对象。**

不过这里要补一句资料里提到、也确实成立的判断：**type 只反映单表访问效率，不等于整体快慢**。一个 `ref` 如果命中后要疯狂回表，可能还不如一个走覆盖索引的 `index`。所以 type 要结合 `rows` 和 `Extra` 一起看，不能孤立下结论。

### possible_keys 和 key：能用哪个 vs 真用了哪个

- **possible_keys**：优化器觉得**理论上**可以用的索引清单。如果这一列是 NULL，说明你 `WHERE` 里的列压根没有可用的索引——该考虑加索引了。
- **key**：优化器**最终拍板用的**那个索引。这一列**如果是 NULL，就是没走索引**，是个红灯。

有个值得注意的现象：`possible_keys` 有值、但 `key` 是 NULL。这通常意味着优化器算了一下，觉得"用这个索引还不如全表扫"，于是放弃了索引。小表上很常见（数据没几行，走索引反而绕路），大表上出现就要警惕统计信息是不是失真了。

### key_len：用了索引的几个字节

`key_len` 是这次实际用到的索引长度（字节数）。它单独看意义不大，但有个很实用的用途：**判断联合索引用到了第几列**。

举个例子，联合索引 `idx_age_score_name(age, score, name)`，其中 age、score 都是 `int`（4 字节，可空再 +1）。如果 `key_len` 显示 5，说明只用到了 age 这一列；如果显示 10，说明 age + score 两列都用上了。排查"联合索引为什么没完全生效"时，这一列是关键证据。原则上在满足需求的前提下，key_len 越短越好。

### rows：估算要扫多少行

`rows` 是优化器**估算**的需要读取的行数，**越小越好**。

务必记住"估算"二字。InnoDB 的统计信息靠对索引页**随机采样**得来（采样页数由 `innodb_stats_persistent_sample_pages` 控制，默认 20 页），所以这个值**不是精确值**。在大批量导入、数据频繁变动之后，它和真实行数差个百分之几十都很正常。

如果你怀疑优化器选错了索引、而根源是统计信息过期，可以 `ANALYZE TABLE 表名` 重新采样一下，再看计划有没有变化。

### filtered：过滤后还剩多少

`filtered` 是个百分比（0~100），表示存储引擎返回的行，经过 Server 层 WHERE 条件过滤后**还剩百分之几**。

- `filtered = 100`：扫出来的行全都满足条件，最理想。
- `filtered < 100`：有一部分行白扫了，要在 Server 层再过滤掉。

它在单表查询里参考价值一般，**在多表 JOIN 里才重要**：优化器用 `rows × filtered / 100` 来估算这张表往下一张表传多少行（也就是"扇出"）。如果 `rows` 很大、`filtered` 又很低，说明扫了一大堆没用的行，这是潜在瓶颈。

### Extra：信息量最大的一列

`Extra` 是个杂项列，但偏偏藏着最关键的信息。优化时我重点盯这几个值：

- **Using index**（好）：**覆盖索引**。查询要的字段索引里全有，不用回表，效率很高。看到它通常是好事。
- **Using where**：Server 层对存储引擎返回的行又做了一次 WHERE 过滤。它本身不一定是坏事——哪怕命中了索引，只要索引没覆盖全部条件，剩下的条件就得在这里过滤，也会出现它。但如果它和 `type=ALL` 一起出现，那就是全表扫 + 逐行过滤，性能很差。
- **Using index condition**（一般是好事）：**索引条件下推（ICP）**。本来要回表才能判断的条件，被下推到存储引擎层、在索引上就先过滤了，减少了回表次数。
- **Using filesort**（要优化）：MySQL 没法靠索引完成 `ORDER BY` / `GROUP BY` 的排序，只能把结果取出来**额外排一次序**。名字里有 "file" 但**不一定真落磁盘**——结果集小就在 `sort_buffer` 内存里排，超了才借磁盘临时文件。但无论如何，看到它就意味着排序没走上索引，是优化的重点信号。
- **Using temporary**（要优化）：MySQL 建了**临时表**来中转数据，常见于 `GROUP BY`、`DISTINCT`、复杂 `ORDER BY`。它通常比 filesort 更值得警惕，临时表（尤其落磁盘的）很容易拖慢查询。

> 排查口诀：**`Extra` 里只要出现 `Using filesort` 或 `Using temporary`，就基本可以确定有优化空间，优先盯它们。** 而 `Using index` 是你希望看到的。

## 怎么用 EXPLAIN 判断一条 SQL 好不好

不用每一列都死磕，按这个顺序扫一遍，大部分问题就暴露了：

1. **看 `type`**：是不是掉到了 `ALL` 或 `index`？掉到 ALL 基本就是全表扫，第一优先级处理。
2. **看 `key`**：是不是 NULL？NULL = 没走索引，配合 type=ALL 实锤。
3. **看 `rows`**：估算扫描行数是不是大得离谱？几行可以接受，动辄几十万就有问题。
4. **看 `Extra`**：有没有 `Using filesort` / `Using temporary`？有就说明排序或分组没走索引，需要优化。

这四步过完，一条 SQL 健不健康心里基本有数了。

## 优化前后对照

光说概念太虚，看两个真实的对照。

### 例一：从全表扫到走索引

假设 `users` 表有几百万行，`age` 列上**没有索引**：

```sql
mysql> EXPLAIN SELECT * FROM users WHERE age = 25;
+----+-------+------+------+---------+----------+-------------+
| id | table | type | key  | key_len | rows     | Extra       |
+----+-------+------+------+---------+----------+-------------+
|  1 | users | ALL  | NULL | NULL    | 2965102  | Using where |
+----+-------+------+------+---------+----------+-------------+
```

`type=ALL`、`key=NULL`、`rows≈300万`、`Extra=Using where`——四个红灯全亮了：没索引可用，只能全表扫近 300 万行再逐行过滤。

给 `age` 加上索引后：

```sql
mysql> ALTER TABLE users ADD INDEX idx_age (age);
mysql> EXPLAIN SELECT * FROM users WHERE age = 25;
+----+-------+------+---------+---------+------+-------+
| id | table | type | key     | key_len | rows | Extra |
+----+-------+------+---------+---------+------+-------+
|  1 | users | ref  | idx_age | 5       |   12 | NULL  |
+----+-------+------+---------+---------+------+-------+
```

`type` 从 `ALL` 升到 `ref`，`rows` 从 300 万降到 12，问题解决。

### 例二：干掉 Using filesort

查询某用户的订单，按时间倒序：

```sql
mysql> EXPLAIN SELECT * FROM orders WHERE user_id = 1001 ORDER BY created_at DESC;
+----+--------+------+--------------+------+----------------+
| id | table  | type | key          | rows | Extra          |
+----+--------+------+--------------+------+----------------+
|  1 | orders | ref  | idx_user_id  | 850  | Using filesort |
+----+--------+------+--------------+------+----------------+
```

`user_id` 走了索引（type=ref 还行），但 `ORDER BY created_at` 没法利用索引，于是出现了 `Using filesort`——850 行取出来后还得在内存里排一次。

把单列索引改成**覆盖排序列的联合索引** `(user_id, created_at)`：

```sql
mysql> ALTER TABLE orders ADD INDEX idx_user_created (user_id, created_at);
mysql> EXPLAIN SELECT * FROM orders WHERE user_id = 1001 ORDER BY created_at DESC;
+----+--------+------+------------------+------+-------+
| id | table  | type | key              | rows | Extra |
+----+--------+------+------------------+------+-------+
|  1 | orders | ref  | idx_user_created | 850  | NULL  |
+----+--------+------+------------------+------+-------+
```

`created_at` 已经在索引里按序排好，MySQL 直接顺着读就行，`Using filesort` 消失了。这就是"让排序列跟在过滤列后面进同一个联合索引"的经典套路。

## 容易踩的坑

- **以为 `EXPLAIN` 会执行 SQL**：普通 EXPLAIN 不执行、不锁表，放心用；真正会执行的是 `EXPLAIN ANALYZE`，别在生产对大查询用它。
- **看到 `type=index` 就放心**：`index` 是全索引扫描，不是"走对了索引"。它和 ALL 一样会扫一整棵树，大表上照样慢。
- **把 `Using where` 当坏事**：它很常见，命中索引但索引没覆盖全部条件时也会出现，本身不代表有问题——要结合 type 一起看。
- **`rows` 当成精确值**：它是采样估算出来的，误差几十个百分点很正常。计划反常时先 `ANALYZE TABLE` 刷一下统计信息。
- **`possible_keys` 有值就以为走了索引**：真正算数的是 `key`。优化器可能算完账觉得不划算，最终还是全表扫。
- **只看单列 `type` 下结论**：type 只反映单表访问效率，要和 `rows`、`Extra` 合在一起判断整体好坏。

## 小结

- `EXPLAIN SQL` 不真正执行，只让优化器把执行计划摊给你看；`EXPLAIN ANALYZE` 会真跑，慎用于生产。
- 判断一条 SQL 好不好，按 **type → key → rows → Extra** 四步扫：type 别掉到 ALL/index，key 别为 NULL，rows 别太大，Extra 别有 filesort/temporary。
- `type` 性能排序记住关键几档：`const > eq_ref > ref > range > index > ALL`，至少要到 range，看到 ALL 就要动手。
- `Extra` 里 `Using index`（覆盖索引）是好事；`Using filesort`、`Using temporary` 是优化重点信号。
- `key_len` 能帮你判断联合索引用到了第几列；`rows` 是估算值，`filtered` 在 JOIN 扇出估算里才关键。

## 参考

基于 MySQL 8.0 Reference Manual 中 InnoDB、Optimizer、Replication、EXPLAIN、Data Types、Online DDL 等相关官方章节整理。
