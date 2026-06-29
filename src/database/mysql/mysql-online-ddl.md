---
title: "Online DDL 会不会锁表？"
description: "从 MDL、ALGORITHM、LOCK 和 gh-ost/pt-osc 讲清在线改表边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "MySQL"
tag:
  - "项目实战"
  - "排障"
  - "进阶"
prev:
  text: "主从延迟怎么定位和治理？"
  link: "/database/mysql/mysql-replication-delay-troubleshooting.html"
next:
  text: "Redis"
  link: "/database/redis/"
---

# Online DDL 会不会锁表？

> Online DDL 不是“不加锁”，而是尽量降低 DML 阻塞；真正危险的是 MDL 等待链和大表变更的复制/回滚成本。

线上改表最怕一句“支持 Online DDL，直接 ALTER”。它可能没长期锁住 DML，也可能被长事务卡住 MDL，连普通查询都排队。

## DDL 为什么会堵住业务？

MySQL 执行 DDL 会申请 MDL 写锁。普通 SELECT/UPDATE 会持有 MDL 读锁，事务不结束，读锁就不释放。

危险链路是：

1. 长事务先访问了表，持有 MDL 读锁。
2. DDL 来了，申请 MDL 写锁，被长事务挡住。
3. 后续新的查询也要拿 MDL 读锁，但它们排在 DDL 后面。
4. 于是看起来“只是改表”，结果把后续查询全堵住。

改表前一定先查长事务：

```sql
SELECT * FROM information_schema.innodb_trx\G
SHOW PROCESSLIST;
```

## Online DDL 的几个口径

MySQL DDL 常见算法：

- `COPY`：复制临时表，代价大，阻塞风险高。
- `INPLACE`：尽量在原表上完成，减少拷贝。
- `INSTANT`：MySQL 8.0 引入的一些元数据级变更，速度非常快。

可以显式写：

```sql
ALTER TABLE t ADD COLUMN c INT, ALGORITHM=INPLACE, LOCK=NONE;
```

但不是所有变更都支持 `LOCK=NONE` 或 `INSTANT`。不同 MySQL 版本、字段位置、索引类型、列类型变更都会影响实际算法。执行前要在同版本测试环境验证。

## 大表改结构怎么做更稳？

常见方案：

- 低峰期执行原生 Online DDL。
- 使用 `pt-online-schema-change`：建影子表、触发器同步增量、分批拷贝、最后 rename。
- 使用 `gh-ost`：基于 binlog 同步增量，减少触发器影响。

这些工具也不是银弹。它们会增加主库写压力、产生大量 binlog，可能造成主从延迟。执行前要评估表大小、写入量、磁盘空间、复制延迟、回滚方案。

`pt-online-schema-change` 依赖触发器捕获增量，对写入频繁的表会增加主库写成本；`gh-ost` 依赖 binlog 读取增量，对复制链路和权限有要求。两者都需要额外磁盘空间和切换窗口，不能当作“无风险在线改表”。

## 上线前检查清单

- 有没有长事务持有 MDL。
- 变更是否能走 `INSTANT`/`INPLACE`。
- 是否有足够磁盘空间。
- 主从延迟阈值和暂停策略是否准备好。
- 应用是否依赖 `SELECT *` 或字段顺序。
- 是否准备回滚脚本和灰度步骤。
- 如果使用外部工具，是否验证触发器/binlog 权限、磁盘空间、限速和暂停条件。

尤其要避免在一个事务里先查表再长时间不提交，然后另一个窗口 ALTER 这张表。这是 MDL 事故的经典触发方式。

## 小结

- Online DDL 不等于完全不加锁，MDL 写锁仍然是关键风险。
- 长事务持有 MDL 读锁，会让 DDL 排队，并阻塞后续查询。
- `COPY`、`INPLACE`、`INSTANT` 的能力受 MySQL 版本和变更类型影响。
- 大表变更可用 pt-osc 或 gh-ost，但要评估写压力、binlog 和主从延迟。
- 改表前必须查长事务、验证算法、准备回滚和延迟监控。

## 参考

综合自本站 `mysql-locks.md`、社区 MySQL 资料，并结合 MySQL Online DDL、MDL 与 pt-online-schema-change 的工程边界做了整理。
