---
title: "慢 SQL 应该按什么顺序排查？"
description: "从确认慢、看执行计划、查索引到改 SQL，给出慢查询排查闭环。"
breadcrumb: true
article: true
editLink: false
category:
  - "MySQL"
tag:
  - "排障"
  - "项目实战"
  - "高频"
prev:
  text: "next-key lock 到底锁了什么范围？"
  link: "/database/mysql/mysql-next-key-lock-range.html"
next:
  text: "MySQL 线上死锁日志怎么看？"
  link: "/database/mysql/mysql-deadlock-log-analysis.html"
---

# 慢 SQL 应该按什么顺序排查？

> 慢 SQL 排查不要上来就“加索引”，先确认慢在哪里，再用执行计划和实际数据证明瓶颈。

一条 SQL 慢，可能是没走索引，也可能是走了索引但回表太多、排序落盘、锁等待、网络返回太大。排查顺序错了，很容易改错方向。

## 第一步：确认它真的慢在哪里

先拿证据：

```sql
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
```

生产常用慢查询日志、数据库监控、应用链路追踪一起看：

- SQL 执行耗时是否稳定变慢，还是偶发尖刺。
- 慢在数据库执行，还是应用拿连接、网络传输、反序列化。
- 是否伴随锁等待、CPU 高、I/O 高、主从延迟。

如果应用日志显示 3 秒，MySQL 慢日志显示 20ms，问题可能在连接池、网络或应用处理，不在 SQL 本身。

## 第二步：看执行计划

先用普通 EXPLAIN：

```sql
EXPLAIN SELECT ...;
EXPLAIN FORMAT=JSON SELECT ...;
```

重点不是把每列背完，而是看这几个问题：

| 字段       | 关注点                                               |
| ---------- | ---------------------------------------------------- |
| `type`     | 是否是 `ALL`、`index` 这类大范围扫描                 |
| `key`      | 实际用了哪个索引，是否和预期一致                     |
| `rows`     | 估算扫描行数是否过大                                 |
| `filtered` | 存储引擎返回后还要过滤多少                           |
| `Extra`    | 是否有 `Using temporary`、`Using filesort`、大量回表 |

MySQL 8.0.18 起有 `EXPLAIN ANALYZE`，能看到实际执行耗时和行数，但它会真正执行 SQL。不要在生产对大查询随手跑。

如果执行计划估算和实际差很多，可以在低峰或测试环境刷新统计信息：

```sql
ANALYZE TABLE table_name;
```

这能让优化器重新采样，但它不是性能优化本身。刷新后仍要重新看计划和执行耗时。

## 第三步：检查索引和过滤条件

常见问题：

- WHERE 列没有索引。
- 联合索引不符合最左前缀。
- 范围条件放在联合索引中间，后续列用不上。
- 对列做函数、计算或隐式类型转换。
- `LIKE '%xxx'` 前缀通配导致 B+ 树无法定位。
- 选择了低区分度索引，扫描行数仍然很大。

索引不是越多越好。每多一个索引，写入都要维护，优化器选择计划也更复杂。要围绕高频查询建立联合索引，并尽量让 WHERE、ORDER BY、SELECT 字段形成覆盖索引。

还有一个常见误判：`type=index` 不是“索引用得很好”，它往往表示全索引扫描，只是扫的是索引树而不是整行数据。数据量大时一样可能慢。

## 第四步：看排序、分组和临时表

`Using filesort` 不一定真的写磁盘，但说明不能直接用索引顺序满足排序。`Using temporary` 通常更危险，复杂 GROUP BY、DISTINCT、ORDER BY 混用时容易出现。

优化方向：

- 让 ORDER BY 和 WHERE 使用同一个联合索引顺序。
- 避免 `SELECT *`，减少回表和临时表宽度。
- 大分页改成基于游标/主键的延续查询。
- 能拆的小 SQL 不要硬塞成一个超复杂 SQL。

另外，`Using filesort` 不等于一定落磁盘，它只是说明 MySQL 需要额外排序；是否落磁盘取决于排序数据量和内存参数。真正排障时不要只看到这个词就下结论，要结合 rows、实际耗时和临时表指标。

## 第五步：排除锁和资源问题

SQL 本身计划没问题，也可能慢在等待：

```sql
SHOW PROCESSLIST;
SELECT * FROM performance_schema.data_lock_waits\G
SHOW ENGINE INNODB STATUS\G
```

这里也要看版本边界：`performance_schema.data_lock_waits` 是 MySQL 8.0 常用的锁等待视图；MySQL 5.7 排查锁等待时，优先结合 `SHOW PROCESSLIST`、`SHOW ENGINE INNODB STATUS\G` 和业务事务日志。部分 5.7 环境还能看到旧的 `information_schema.INNODB_LOCKS` / `INNODB_LOCK_WAITS`，但这些视图已经废弃，不建议新脚本继续依赖。

如果状态是等待锁，加索引未必解决，可能要缩短事务、拆批更新、调整访问顺序。如果磁盘 I/O 高，要看是不是刷脏页、binlog 暴涨或临时表落盘。

## 小结

- 慢 SQL 先确认慢在数据库内部还是应用链路，不要直接加索引。
- EXPLAIN 重点看 `type/key/rows/filtered/Extra`，必要时用 `FORMAT=JSON` 和测试环境的 `EXPLAIN ANALYZE` 验证。
- 索引排查要看最左前缀、隐式转换、函数计算、范围条件和覆盖索引。
- `Using temporary`、大排序、大分页、`SELECT *` 都是高频慢点。
- 执行计划正常时，要继续查锁等待、I/O、连接池和下游资源。

## 参考

基于 MySQL 官方手册中 Optimizer、EXPLAIN、EXPLAIN ANALYZE、InnoDB 状态输出和 Performance Schema 锁等待视图相关章节整理，并按慢日志、执行计划、索引条件、锁等待、资源瓶颈这条排查链路复核。
