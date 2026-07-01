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

MySQL 8.0.22 之后推荐使用 `SHOW REPLICA STATUS`，`SHOW SLAVE STATUS` 仍能用但属于旧术语。团队脚本最好同时兼容新旧字段名，避免升级后监控误报。

## Seconds_Behind 为什么只能当参考？

`Seconds_Behind_Source` 看起来直观，但它不是强一致指标。

几个常见误区：

- 它依赖复制事件里的时间戳和从库当前时间，机器时钟漂移会影响判断。
- IO 线程拉取慢时，它可能不能准确表达“主库已经产生但从库还没拉到”的全部差距。
- 多线程复制时，不同 worker 的进度不同，一个总数不一定能反映业务关键表是否追上。
- 它为 0 只说明复制线程视角暂时追上，不代表你刚写入的那笔业务一定已经被目标查询读到。

更稳的做法是加业务心跳表：主库定期写当前时间或递增位点，从库读这张表计算真实延迟。关键链路则用 GTID/位点等待，确认目标事务已回放后再读。

## 常见原因怎么判断？

| 原因         | 现象                         | 治理                           |
| ------------ | ---------------------------- | ------------------------------ |
| 大事务       | 延迟突然升高，relay log 堆积 | 拆批写入，避免单事务改百万行   |
| 从库回放慢   | IO 正常，SQL/worker 追不上   | 开并行复制，提升从库 I/O/CPU   |
| 从库读压力大 | 从库 CPU/IO 高，慢查询多     | 读写隔离，重查询走专用库       |
| 网络慢       | IO 线程拉取慢                | 优化链路、带宽、跨机房复制策略 |
| 锁等待       | SQL 线程状态等待锁           | 查长事务和读查询，降低从库干扰 |

`Seconds_Behind` 只是参考值，不是强一致指标。真正关键链路要结合位点、GTID 集合、业务写入时间戳或心跳表判断。

可以把排查命令分成三组：

```sql
SHOW REPLICA STATUS\G;
SHOW PROCESSLIST;

SELECT *
FROM performance_schema.replication_connection_status\G;

SELECT *
FROM performance_schema.replication_applier_status_by_worker\G;
```

第一组看复制线程总状态，第二组看 SQL/worker 是否卡在锁、I/O 或某条 SQL，第三组看连接和各 worker 的细粒度进度。MySQL 8.0 的 Performance Schema 复制表比单个 `Seconds_Behind` 更适合做监控。

## 并行复制能解决什么？

早期从库 SQL 线程串行回放，主库多线程并发写，从库自然容易追不上。

- MySQL 5.6：按库并行，粒度粗。
- MySQL 5.7：基于组提交的 logical clock 并行，效果明显更好。
- MySQL 8.0：WRITESET 等模式进一步提高并行度。

并行复制提升的是回放吞吐，不是消除所有延迟。一个巨大事务本身不能拆成多个事务并行回放，主库持续写入超过从库能力也仍然会延迟。

调并行复制时，常见关注点是：

- `replica_parallel_workers` / `slave_parallel_workers`：worker 数量。
- `replica_parallel_type` / `slave_parallel_type`：并行策略，MySQL 5.7 常见 `LOGICAL_CLOCK`。
- `binlog_transaction_dependency_tracking`：MySQL 8.0 可用 writeset 相关策略提高可并行度。

不要只把 worker 数调大。worker 多了以后，如果瓶颈在磁盘 fsync、单表热点锁、单个大事务或从库读压力，延迟仍然会存在。

## 业务怎么避开读旧数据？

读写分离后，写完马上读从库可能读到旧值。常用策略：

- 写后短时间内读主库。
- 对关键读强制走主库。
- 根据延迟阈值决定是否摘除从库。
- 用 GTID/位点等待机制确保从库追到某个事务后再读。

不要把主从复制当作强一致。异步复制默认是最终一致，半同步也只是日志到达，不保证从库已经回放完成。

## 治理主从延迟要避免哪些副作用？

常见治理动作也有代价：

| 动作             | 能解决什么                   | 副作用                             |
| ---------------- | ---------------------------- | ---------------------------------- |
| 拆大事务         | 降低单次回放时间和锁持有时间 | 业务要处理分批幂等和中间态         |
| 开并行复制       | 提升从库回放吞吐             | 可能增加资源争用，仍受热点事务限制 |
| 摘除延迟从库     | 避免读旧数据                 | 读流量压到剩余节点或主库           |
| 关键读走主库     | 保证读到最新数据             | 主库读压力上升                     |
| 加心跳和位点等待 | 提高一致性判断准确度         | 增加代码和监控复杂度               |

如果业务是下单后立刻查订单、支付后立刻查状态，这类链路不要依赖“从库大概率已经追上”。要么读主库，要么把写入事务的 GTID/位点传到读侧等待。

## 小结

- 主从延迟要拆成 IO 拉取、relay log 写入、SQL/worker 回放三段定位。
- `SHOW REPLICA STATUS` 能看线程状态、位点、错误和粗略延迟。
- `Seconds_Behind` 只能粗略参考，关键链路要结合心跳表、GTID 或位点等待判断。
- 大事务、从库读压力、网络、锁等待、回放能力不足都是常见原因。
- 并行复制能提升回放吞吐，但不能消除大事务和持续超载带来的延迟。
- 读写分离要为关键链路设计读主、延迟摘除或位点等待策略。

## 参考

基于 MySQL 8.0 Reference Manual 中 InnoDB、Optimizer、Replication、EXPLAIN、Data Types、Online DDL 等相关官方章节整理。
