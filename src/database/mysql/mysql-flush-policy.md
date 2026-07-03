---
title: "MySQL 刷盘策略怎么影响性能和丢数据风险？"
description: "从 redo、binlog、脏页和组提交讲清刷盘参数的安全与性能取舍。"
breadcrumb: true
article: true
editLink: false
category:
  - "MySQL"
tag:
  - "进阶"
  - "排障"
  - "项目实战"
prev:
  text: "redo log、undo log、binlog 怎么配合保证崩溃恢复？"
  link: "/database/mysql/mysql-crash-recovery-logs.html"
next:
  text: "表结构和字段设计怎么做？"
  link: "/database/mysql/mysql-schema-design.html"
---

# MySQL 刷盘策略怎么影响性能和丢数据风险？

> 刷盘策略是在“每次提交都 fsync”与“攒一攒再落盘”之间取舍：越安全，通常越费 I/O。

不要只背 `innodb_flush_log_at_trx_commit` 和 `sync_binlog`。线上判断写入抖动，要同时看三条线：redo 刷盘、binlog 刷盘、脏页刷盘。

## redo 刷盘：innodb_flush_log_at_trx_commit

| 取值 | 提交时动作                       | 进程崩溃       | 机器断电       | 性能 |
| ---- | -------------------------------- | -------------- | -------------- | ---- |
| 0    | 不主动 write/fsync，靠后台周期刷 | 可能丢约 1 秒  | 可能丢约 1 秒  | 最好 |
| 1    | write + fsync                    | 不丢已提交事务 | 不丢已提交事务 | 最差 |
| 2    | write 到 OS page cache，不 fsync | 通常不丢       | 可能丢约 1 秒  | 居中 |

这里的“每秒”是后台线程周期性保障，不是严格 SLA。系统调度、磁盘拥塞、文件系统和硬件缓存都会影响实际落盘时机。

## binlog 刷盘：sync_binlog

事务提交时，binlog 先从线程自己的 binlog cache 写入 binlog 文件。`write` 只到操作系统 page cache，`fsync` 才要求落盘。

| 取值 | 含义                                | 风险                                  |
| ---- | ----------------------------------- | ------------------------------------- |
| 0    | 每次提交只 write，不主动 fsync      | 主机崩溃可能丢 page cache 中的 binlog |
| 1    | 每次提交都 write + fsync            | 最安全，I/O 压力最大                  |
| N    | 每次提交 write，累计 N 个事务 fsync | 崩溃可能丢最近 N 个事务的 binlog      |

如果主库数据靠 redo 恢复了，但 binlog 丢了，复制和基于 binlog 的恢复链路就会缺事务。所以调大 `sync_binlog` 必须写清业务能承受的风险。

## 脏页刷盘：checkpoint 和 redo 容量

数据页被修改后先留在 Buffer Pool，变成脏页。脏页刷盘通常受这些因素影响：

- redo log 空间快写满，checkpoint 需要推进。
- Buffer Pool 脏页比例过高。
- 后台线程周期性刷新。
- 正常关闭或做 checkpoint。

redo log 太小，高写入下 write pos 很快追上 checkpoint，前台线程就可能被迫等刷脏页，表现为写入延迟突然升高。

MySQL 8.0.30 起更推荐用 `innodb_redo_log_capacity` 管 redo 容量；老版本常见是 `innodb_log_file_size` 与 `innodb_log_files_in_group`。

## 组提交解决什么？

双 1 配置最安全，但每个事务都 fsync，磁盘压力很大。组提交把多个事务攒成一组，合并刷盘：

```text
flush 阶段：多个事务按顺序写 binlog 文件，不 fsync
sync 阶段：一组事务合并做一次 fsync
commit 阶段：按顺序提交到 InnoDB
```

相关参数如 `binlog_group_commit_sync_delay`、`binlog_group_commit_sync_no_delay_count` 可以让 sync 阶段稍等更多事务，从而提高合并效果。但这是用额外等待换吞吐，可能增加单事务响应时间。

## 线上怎么取舍？

常见口径：

- 金融、订单、库存：优先双 1，宁可牺牲写性能。
- 可重放、可补偿的日志类数据：可评估 `sync_binlog=N` 或 redo 设置为 2。
- 磁盘 I/O 瓶颈：先确认是不是慢 SQL、大事务、刷脏页或 binlog 暴涨，再调刷盘参数。

不要把刷盘参数当作万能优化。它们能降 I/O，但本质是在扩大数据丢失窗口。

## 小结

- redo、binlog、脏页是三条不同的刷盘线，不能只背一个参数。
- `innodb_flush_log_at_trx_commit=1` 最安全，2 写到 OS cache，0 风险最大。
- `sync_binlog=1` 最安全，N 会扩大 binlog 丢失窗口。
- redo 容量太小或脏页太多，会触发前台等待刷脏页。
- 组提交用合并 fsync 提升吞吐，但可能增加提交等待。

## 参考

基于 MySQL 8.0 Reference Manual 中 InnoDB、Optimizer、Replication、EXPLAIN、Data Types、Online DDL 等相关官方章节整理。
