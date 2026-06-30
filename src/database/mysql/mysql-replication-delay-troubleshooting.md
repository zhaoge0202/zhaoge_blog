---
title: "主从延迟怎么定位和治理？"
description: "从 IO 线程、SQL 回放、大事务和并行复制讲清主从延迟排查。"
breadcrumb: true
article: true
editLink: false
category:
  - "MySQL"
tag:
  - "排障"
  - "项目实战"
  - "进阶"
prev:
  text: "MySQL 线上死锁日志怎么看？"
  link: "/database/mysql/mysql-deadlock-log-analysis.html"
next:
  text: "Online DDL 会不会锁表？"
  link: "/database/mysql/mysql-online-ddl.html"
---

# 主从延迟怎么定位和治理？

> 主从延迟不是一句“从库慢”，要拆成日志有没有拉到、relay log 有没有写好、SQL 线程有没有回放完。

主从复制基础已经在复制篇讲过。这篇从排障角度看：发现读从库读到旧数据，应该怎么定位。

## 先判断卡在哪一段

复制链路有三段：

```text
主库 binlog -> 从库 IO 线程拉取 -> relay log -> SQL/worker 回放
```

排查时先看：

```sql
SHOW REPLICA STATUS\G; -- MySQL 8.0 推荐写法
SHOW SLAVE STATUS\G; -- 旧版本写法
```

重点字段：

- `Replica_IO_Running` / `Slave_IO_Running`：IO 线程是否正常。
- `Replica_SQL_Running` / `Slave_SQL_Running`：SQL 线程是否正常。
- `Seconds_Behind_Source` / `Seconds_Behind_Master`：粗略延迟。
- relay log 位点、错误号、最近错误信息。

如果 IO 线程不正常，优先看网络、账号权限、主库 binlog 是否还在。如果 SQL 线程不正常，优先看回放错误、锁等待、大事务。

## 常见原因怎么判断？

| 原因         | 现象                         | 治理                           |
| ------------ | ---------------------------- | ------------------------------ |
| 大事务       | 延迟突然升高，relay log 堆积 | 拆批写入，避免单事务改百万行   |
| 从库回放慢   | IO 正常，SQL/worker 追不上   | 开并行复制，提升从库 I/O/CPU   |
| 从库读压力大 | 从库 CPU/IO 高，慢查询多     | 读写隔离，重查询走专用库       |
| 网络慢       | IO 线程拉取慢                | 优化链路、带宽、跨机房复制策略 |
| 锁等待       | SQL 线程状态等待锁           | 查长事务和读查询，降低从库干扰 |

`Seconds_Behind` 只是参考值，不是强一致指标。真正关键链路要结合位点、GTID 集合、业务写入时间戳或心跳表判断。

## 并行复制能解决什么？

早期从库 SQL 线程串行回放，主库多线程并发写，从库自然容易追不上。

- MySQL 5.6：按库并行，粒度粗。
- MySQL 5.7：基于组提交的 logical clock 并行，效果明显更好。
- MySQL 8.0：WRITESET 等模式进一步提高并行度。

并行复制提升的是回放吞吐，不是消除所有延迟。一个巨大事务本身不能拆成多个事务并行回放，主库持续写入超过从库能力也仍然会延迟。

## 业务怎么避开读旧数据？

读写分离后，写完马上读从库可能读到旧值。常用策略：

- 写后短时间内读主库。
- 对关键读强制走主库。
- 根据延迟阈值决定是否摘除从库。
- 用 GTID/位点等待机制确保从库追到某个事务后再读。

不要把主从复制当作强一致。异步复制默认是最终一致，半同步也只是日志到达，不保证从库已经回放完成。

## 小结

- 主从延迟要拆成 IO 拉取、relay log 写入、SQL/worker 回放三段定位。
- `SHOW REPLICA STATUS` 能看线程状态、位点、错误和粗略延迟。
- 大事务、从库读压力、网络、锁等待、回放能力不足都是常见原因。
- 并行复制能提升回放吞吐，但不能消除大事务和持续超载带来的延迟。
- 读写分离要为关键链路设计读主、延迟摘除或位点等待策略。

## 参考

基于 MySQL 8.0 Reference Manual 中 InnoDB、Optimizer、Replication、EXPLAIN、Data Types、Online DDL 等相关官方章节整理。
