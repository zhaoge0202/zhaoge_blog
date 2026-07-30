---
title: "百万级数据导出和全表扫描怎么不撑爆内存？"
description: "从游标分页、流式查询到分批提交讲清大数据量拉取不 OOM 的方案。"
breadcrumb: true
article: true
editLink: false
category:
  - "高性能"
tag:
  - "高频"
  - "项目实战"
  - "排障"
prev:
  text: "Disruptor 为什么比 BlockingQueue 快？无锁环形队列怎么做到的？"
  link: "/high-performance/high-performance-disruptor.html"
next:
  text: "高可用"
  link: "/high-availability/"
---

# 百万级数据导出和全表扫描怎么不撑爆内存？

"后台导出五十万行 Excel，点了一下内存涨到 8G 然后 OOM 了"——这是典型的深分页 / 大结果集场景。和 `LIMIT offset` 的展示型深分页不同（那是给用户翻页看），导出、对账、迁移、全量扫描是**要把数据全过一遍**，最容易踩的不是慢，是内存爆。这篇讲怎么把百万级拉取做得又稳又不撑爆。

## 先分清两类"深分页"

| 场景         | 目标                           | 痛点                           | 主战场                        |
| ------------ | ------------------------------ | ------------------------------ | ----------------------------- |
| 展示型深分页 | 用户翻到第 10 万页，每页 20 条 | LIMIT offset 扫描 + 丢弃大量行 | 索引、游标分页（见 SQL 专题） |
| 全量拉取型   | 导出 / 对账 / 迁移全表         | 一次 load 进内存 OOM           | 流式查询、分批提交            |

这篇讲全量拉取型。展示型深分页见 [分页查询怎么写？深度分页怎么优化？](/database/sql/sql-pagination.html)。

## 为什么会 OOM

最常见错误写法：

```java
List<Order> all = orderMapper.selectAll(); // 全表塞进 List
// 写 Excel / 发对账 / 推下游
```

ORM 默认一次性把结果集物化成对象列表。五十万行 × 每行几 KB，轻松上 GB。JDBC 层其实 ResultSet 是流式的，但 ORM 层把它攒成了 List，内存就爆了。

## 方案一：游标分页（keyset pagination）

按主键或有序列增量拉，每批 N 条：

```sql
SELECT * FROM orders
WHERE id > :last_id
ORDER BY id ASC
LIMIT 1000;
```

- 用上主键索引，每批都是索引范围扫描，稳定快。
- 不用 `LIMIT offset`（offset 越大扫得越多）。
- 每批处理完记录 `last_id`，循环到没有新数据为止。
- 适合能按主键 / 有序列切分的表，主键最好是自增或时间递增。

> 注意：如果用非唯一列做游标（比如 `create_time`），要加上主键做 tiebreaker，否则同值数据会漏：`WHERE (create_time, id) > (:last_time, :last_id)`。

## 方案二：流式查询（Streaming ResultSet）

让 JDBC 不一次性物化结果集，而是一行一行 fetch：

- MyBatis：用 `Cursor<T>`（`@Select` + `@Options(fetchSize = Integer.MIN_VALUE)`），配合 `ResultHandler` 逐行回调。
- JDBC：`stmt.setFetchSize()` 配合 `ResultSet` 的 `next()` 逐行读；MySQL 需要设置 `useCursorFetch=true` 或 `fetchSize=Integer.MIN_VALUE` 启用流式。

```java
try (Cursor<Order> cursor = orderMapper.scanOrders()) {
    for (Order o : cursor) {
        handle(o); // 一次只持有一个对象，处理完即丢
    }
}
```

关键点：流式查询期间 **ResultSet 必须保持打开**，所以处理逻辑不能跨方法把连接关了；而且流式查询会**长时间占用连接**，要单独管理连接或用独立线程池，避免拖垮连接池。

## 方案三：分批 + 批量提交

拉取和下游写要匹配节奏，否则拉得快写得慢，中间堆内存还是会爆：

- 拉一批（1000~10000），写一批，写完清掉引用，再拉下一批。
- 下游写用批量（JDBC `addBatch` / `executeBatch`，或批量 RPC），别一条一条提交。
- 控制批大小：太大撑内存，太小网络 / 事务开销高，一般 1000~5000 行 / 批。

## 工程注意

- **导出别用 Excel 一次性全量**：五十万行 Excel 用 POI 的 `SXSSFWorkbook`（流式写盘）而不是 `XSSFWorkbook`（全内存）；或者直接写 CSV，更省。
- **对账 / 迁移用任务化**：拆成多任务，每个任务负责一段主键范围，可并行、可断点续跑、可重试。
- **流式查询的连接占用**：长事务 / 长连接会拖垮池子，要么用独立连接、要么限制并发数。
- **背压**：生产者（拉数据）比消费者（写下游）快时，中间用有界队列阻塞，而不是无界队列堆积导致 OOM。

## 小结

- 全量拉取型深分页的痛点是 OOM，不是慢；和展示型 LIMIT offset 深分页是两类问题。
- 游标分页按主键增量拉，每批走索引范围，稳定快。
- 流式查询让 ORM / JDBC 不物化整表，逐行 fetch，注意连接占用。
- 拉和写要匹配节奏，用有界队列背压、批量提交，避免中间堆积。
- 导出大表用 SXSSF / CSV，对账迁移拆任务分段，可续跑可重试。

## 参考

本文综合公开高性能与数据库工程教材，核对了游标分页、JDBC 流式查询、ORM Cursor 机制与批量提交的实践，并对照了导出和对账场景的常见 OOM 原因。
