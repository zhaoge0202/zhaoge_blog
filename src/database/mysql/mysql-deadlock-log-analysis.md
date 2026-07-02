---
title: "MySQL 线上死锁日志怎么看？"
description: "从 LATEST DETECTED DEADLOCK、data_locks 和业务重试讲清死锁日志分析。"
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
  text: "慢 SQL 应该按什么顺序排查？"
  link: "/database/mysql/mysql-slow-query-troubleshooting.html"
next:
  text: "主从延迟怎么定位和治理？"
  link: "/database/mysql/mysql-replication-delay-troubleshooting.html"
---

# MySQL 线上死锁日志怎么看？

> 看死锁日志的目标不是背字段，而是还原等待环：谁持有什么锁、谁在等什么锁、最后回滚了谁。

已有死锁篇讲了成因。这篇只讲线上拿到一段死锁信息后怎么读。

## 先把现场保留下来

`SHOW ENGINE INNODB STATUS\G` 里有 `LATEST DETECTED DEADLOCK`，但只保留最近一次。生产建议开启：

```sql
SET GLOBAL innodb_print_all_deadlocks = ON;
```

这样每次死锁都会写入 error log，避免被下一次死锁覆盖。长期是否开启要结合日志量评估。

如果死锁还在持续发生，MySQL 8.0 可以用 Performance Schema 看当前锁等待：

```sql
SELECT *
FROM performance_schema.data_lock_waits\G

SELECT ENGINE_TRANSACTION_ID, OBJECT_SCHEMA, OBJECT_NAME, INDEX_NAME,
       LOCK_TYPE, LOCK_MODE, LOCK_STATUS, LOCK_DATA
FROM performance_schema.data_locks\G
```

`SHOW ENGINE INNODB STATUS` 更像事后现场，`data_locks` / `data_lock_waits` 更适合观察还没结束的等待链。MySQL 5.7 侧主要依赖 `SHOW ENGINE INNODB STATUS\G`，部分环境还能用已经废弃的 `information_schema.INNODB_LOCKS` / `INNODB_LOCK_WAITS` 辅助。注意：锁等待视图只能看到当前仍存在的锁和等待，死锁被 InnoDB 处理掉以后，现场就会消失。

## 死锁日志看哪几块？

一段死锁日志通常包含：

1. 事务 1 的 SQL、持锁信息、等待锁信息。
2. 事务 2 的 SQL、持锁信息、等待锁信息。
3. InnoDB 选择回滚哪个事务。

读法按这个顺序：

- 看 `TRANSACTION`：事务活了多久、改了多少行、持有多少锁。
- 看 `WAITING FOR THIS LOCK TO BE GRANTED`：它正在等哪个索引、哪个锁模式。
- 看 `HOLDS THE LOCK(S)`：它已经持有哪些锁。
- 看 SQL：把锁映射回业务操作。
- 看 `WE ROLL BACK TRANSACTION`：确认被牺牲的是哪个事务。

可以用这个模板记录结论：

```text
事务 A：执行 SQL_A，已持有 <索引/范围/锁模式>，正在等待 <索引/范围/锁模式>
事务 B：执行 SQL_B，已持有 <索引/范围/锁模式>，正在等待 <索引/范围/锁模式>
等待环：A 等 B，B 等 A
回滚方：InnoDB 回滚了事务 <编号>
业务根因：资源访问顺序不一致 / 范围锁过大 / 插入意向锁冲突 / 长事务
```

这样写比贴一大段日志更有价值，开发同事能直接按业务操作去改。

## LOCK_MODE 怎么翻译？

如果用 `performance_schema.data_locks` 辅助观察，重点看：

| LOCK_MODE             | 含义               |
| --------------------- | ------------------ |
| `X`                   | X 型 next-key lock |
| `X, REC_NOT_GAP`      | X 型记录锁         |
| `X, GAP`              | X 型间隙锁         |
| `X, INSERT_INTENTION` | 插入意向锁         |

`LOCK_TYPE=RECORD` 只是说这是行级锁，不等于 Record Lock。这个误读很常见。

版本边界要记牢：`performance_schema.data_locks` / `data_lock_waits` 是 MySQL 8.0 侧常用视图；5.7 的旧锁等待视图已经废弃，字段也不如 8.0 的 Performance Schema 直观。老版本如果看不到 `REC_NOT_GAP`、`INSERT_INTENTION` 等细节，要结合 `SHOW ENGINE INNODB STATUS`、SQL 条件和索引结构自己还原。

## 怎么还原等待环？

可以用一句话描述：

```text
事务 A 持有 lock1，等待 lock2；
事务 B 持有 lock2，等待 lock1。
```

如果是间隙锁死锁，常见形态是：

- 两个事务都先 `SELECT ... FOR UPDATE`，各自持有同一段兼容的 gap/next-key。
- 随后都要 INSERT，插入意向锁和对方持有的间隙锁冲突。
- 双方互等，形成死锁。

如果是更新顺序不一致，常见形态是：

- A 先改订单再改库存。
- B 先改库存再改订单。
- 两个事务访问资源顺序相反。

## 死锁和锁等待超时有什么区别？

这两个错误经常被混着处理：

| 类型       | 常见错误     | 触发条件                              | 应用处理                           |
| ---------- | ------------ | ------------------------------------- | ---------------------------------- |
| 死锁       | `ERROR 1213` | InnoDB 检测到等待环，主动回滚一个事务 | 回滚并重试整个幂等事务             |
| 锁等待超时 | `ERROR 1205` | 等锁超过 `innodb_lock_wait_timeout`   | 先查慢事务和锁等待，再决定是否重试 |

死锁通常会很快返回，因为 InnoDB 默认开启主动死锁检测。锁等待超时不一定有等待环，可能只是某个事务长期不提交。它们都不能只重试最后一条 SQL，事务上下文已经不可信，必须从业务事务入口重新执行。

## 怎么把死锁映射回业务代码？

日志里的 SQL 往往只是最后一条语句，真正根因可能在事务前半段。排查时要补齐：

1. 事务入口：哪个接口、定时任务、消费逻辑开启了事务。
2. 访问顺序：同一个事务里先改哪些表、哪些行、哪些索引。
3. WHERE 条件：是否走了预期索引，是否把点查变成范围扫描。
4. 事务时长：是否夹了 RPC、文件处理、复杂计算或人工等待。
5. 重试幂等：死锁重试会不会重复扣库存、重复发消息。

最终修复通常不是“把超时时间调大”，而是统一资源访问顺序、缩短事务、补索引、拆批、把外部调用移出事务。

## 应用层应该怎么处理？

InnoDB 检测到死锁后会回滚其中一个事务，应用会看到 `ERROR 1213`。正确处理方式不是直接报系统异常，而是：

- 捕获死锁错误。
- 回滚当前事务。
- 按幂等规则重试整个事务。
- 控制重试次数和退避时间。

不要只重试失败 SQL 的后半段。事务上下文已经被回滚，必须从业务事务入口重新执行。

## 小结

- `SHOW ENGINE INNODB STATUS` 只保留最近一次死锁，生产可用 `innodb_print_all_deadlocks` 记录全部。
- 看死锁日志要还原“持有什么锁、等什么锁、谁被回滚”的等待环。
- `LOCK_TYPE=RECORD` 不等于记录锁，具体锁类型看 `LOCK_MODE`。
- 常见根因是资源访问顺序不一致、间隙锁 + 插入意向锁、长事务持锁。
- 死锁 `1213` 和锁等待超时 `1205` 不一样，但都要从业务事务入口处理。
- 应用层要捕获 1213，回滚并重试整个幂等事务，同时保证重试幂等。

## 参考

基于 MySQL 官方手册中 InnoDB 死锁检测、`SHOW ENGINE INNODB STATUS`、Performance Schema 锁视图和错误码相关章节整理，并按死锁日志、当前锁等待、业务事务入口三个层面复核排查路径。
