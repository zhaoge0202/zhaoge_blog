---
title: "MongoDB 聚合管道怎么用？和 SQL GROUP BY 有什么不同？"
description: "用订单统计例子讲清聚合管道阶段、执行顺序和性能边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "MongoDB"
tag:
  - "高频"
  - "进阶"
  - "项目实战"
prev:
  text: "MongoDB 索引怎么设计？查询为什么没走索引？"
  link: "/database/mongodb/mongodb-index-query.html"
next:
  text: "MongoDB 副本集和分片集群怎么理解？"
  link: "/database/mongodb/mongodb-replica-sharding.html"
---

# MongoDB 聚合管道怎么用？和 SQL GROUP BY 有什么不同？

> MongoDB 聚合管道不是一个 `$group` 就完事，它更像“文档流处理”：每个阶段接收上一阶段的文档，过滤、拆分、分组、改形，再把结果交给下一阶段。

如果 SQL 的聚合是：

```sql
SELECT user_id, SUM(amount)
FROM orders
WHERE status = 'PAID'
GROUP BY user_id;
```

MongoDB 的聚合管道大概会写成：

```javascript
db.orders.aggregate([
  { $match: { status: "PAID" } },
  { $group: { _id: "$userId", totalAmount: { $sum: "$amount" } } },
]);
```

看起来只是语法不同，但底层思路不完全一样。SQL 是声明式查询，优化器负责把逻辑执行计划拆开；MongoDB 聚合管道则更强调阶段顺序，你写出来的管道顺序会直接影响可读性和性能。

## 聚合管道的基本模型

可以把聚合管道想成流水线：

```mermaid
flowchart LR
 A[原始文档] --> B[$match 过滤]
 B --> C[$project 改字段]
 C --> D[$group 分组统计]
 D --> E[$sort 排序]
 E --> F[$limit 输出]
```

每个阶段只做一类事：

| 阶段       | 作用                 | 类比 SQL             |
| ---------- | -------------------- | -------------------- |
| `$match`   | 过滤文档             | `WHERE`              |
| `$project` | 选择、改名、计算字段 | `SELECT` 字段表达式  |
| `$group`   | 分组聚合             | `GROUP BY`           |
| `$sort`    | 排序                 | `ORDER BY`           |
| `$limit`   | 限制数量             | `LIMIT`              |
| `$skip`    | 跳过数量             | `OFFSET`             |
| `$unwind`  | 拆开数组             | 类似把数组展开成多行 |
| `$lookup`  | 关联另一个集合       | 类似 `JOIN`          |
| `$count`   | 计数                 | `COUNT(*)`           |

关键点是：每个阶段输出的文档形态可能已经变了，后面的阶段只能看到前面输出的结果。

## 用一个订单统计例子走一遍

假设订单文档是：

```json
{
 "_id": ObjectId("..."),
 "userId": 10086,
 "status": "PAID",
 "amount": 23900,
 "items": [
 { "skuId": 1, "category": "keyboard", "quantity": 1 },
 { "skuId": 2, "category": "switch", "quantity": 1 }
 ],
 "createdAt": ISODate("2026-06-28T10:00:00Z")
}
```

现在要统计最近 30 天各品类销量 Top 10。

```javascript
db.orders.aggregate([
  {
    $match: {
      status: "PAID",
      createdAt: { $gte: ISODate("2026-05-29T00:00:00Z") },
    },
  },
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.category",
      totalQuantity: { $sum: "$items.quantity" },
      orderCount: { $sum: 1 },
    },
  },
  { $sort: { totalQuantity: -1 } },
  { $limit: 10 },
]);
```

这条管道可以拆成五步：

1. `$match` 先过滤已支付、最近 30 天的订单；
2. `$unwind` 把 `items` 数组拆开，一条订单里多个商品会变成多条中间文档；
3. `$group` 按品类聚合销量；
4. `$sort` 按销量倒序；
5. `$limit` 只取前 10。

如果把 `$match` 放到 `$unwind` 后面，结果可能一样，但性能通常更差，因为你先把数组放大了，再过滤。聚合管道优化的第一原则就是：**越早缩小数据集越好**。

## `$project` 不只是少返回几个字段

`$project` 可以控制字段，也可以改字段形态。

```javascript
db.orders.aggregate([
  { $match: { status: "PAID" } },
  {
    $project: {
      userId: 1,
      amount: 1,
      month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
      _id: 0,
    },
  },
  {
    $group: {
      _id: { userId: "$userId", month: "$month" },
      totalAmount: { $sum: "$amount" },
    },
  },
]);
```

这里 `$project` 新增了 `month` 字段，后面的 `$group` 可以直接按月份聚合。

但别滥用 `$project`。如果你在 `$match` 前把索引字段改形，可能让后续过滤无法使用索引。通常更稳的顺序是：先用 `$match` 命中索引，再按需要 reshape。

## `$lookup` 可以关联，但别把它当关系库 JOIN

MongoDB 有 `$lookup`，可以把另一个集合的数据关联进来：

```javascript
db.orders.aggregate([
  { $match: { status: "PAID" } },
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user",
    },
  },
]);
```

这能解决一些关联查询，但要谨慎：

- MongoDB 的建模优先考虑访问模式，常见详情数据更适合嵌入或冗余快照；
- `$lookup` 会增加执行成本，尤其关联集合大、过滤条件弱时；
- 关联字段要有索引，否则很容易变成放大版慢查询；
- 分片集群下还要考虑关联集合分布、路由和网络代价。

所以 `$lookup` 适合补充关联，不适合把 MongoDB 用成“换语法写 SQL join”的关系库。

## 聚合性能怎么优化？

### 1. `$match` 尽量靠前

如果 `$match` 能命中索引，就尽量放在管道前面。先过滤再分组、排序、拆数组，通常能减少后续阶段处理的数据量。

```javascript
[{ $match: { userId: 10086, status: "PAID" } }, { $sort: { createdAt: -1 } }, { $limit: 20 }];
```

配合索引：

```javascript
db.orders.createIndex({ userId: 1, status: 1, createdAt: -1 });
```

### 2. `$sort` 尽量借索引

如果先 `$match` 再 `$sort`，并且索引顺序匹配，MongoDB 可以直接按索引顺序返回，避免内存排序。

如果排序字段不在合适索引里，大量排序会消耗内存，甚至需要临时写磁盘。

### 3. 先 `$limit` 再做重操作

如果业务语义允许，先限制数据量再做复杂计算。

比如“最近 1000 条订单里统计品类”可以先 `$sort + $limit`，再 `$unwind + $group`。但如果需求是“全量订单的 Top 10”，就不能提前 limit，否则结果错。

### 4. 小心 `$unwind` 放大数据

`$unwind` 会把数组拆成多条文档。一个订单 100 个 items，就会变成 100 条中间文档。数组越长，后续 `$group`、`$sort` 成本越高。

这也是建模阶段要避免无限大数组的原因之一。

### 5. 大任务考虑离线化

如果聚合跨大量历史数据，又不要求实时，别把每次请求都打到在线库上。更稳的方式是：

- 定时聚合写入结果集合；
- 用消息流维护增量统计；
- 把分析任务放到数仓或专门分析系统；
- 对外接口只查预聚合结果。

## map-reduce 还要不要讲？

资料里经常会列“聚合管道、单目的聚合、map-reduce”三种方式。这里要补一个版本边界：**MongoDB 5.0 起 map-reduce 已不推荐使用，官方建议用聚合管道替代**。

面试答法可以是：

> 早期 MongoDB 有 map-reduce，但现在主流和官方推荐都是聚合管道。除非维护老系统，否则新逻辑不建议继续用 map-reduce。

这就是典型的资料纠偏点。背“MongoDB 聚合有 map-reduce”并不算错，但如果不补“已经不推荐”，就会显得版本感不足。

## 容易踩的坑

### “聚合管道就是 SQL GROUP BY”

不准确。`$group` 像 `GROUP BY`，但聚合管道整体更像文档流处理，包含过滤、投影、拆数组、关联、输出等多个阶段。

### “能用 `$lookup` 就可以随便拆集合”

不对。MongoDB 的优势来自文档模型，常见访问路径应该在建模阶段处理好。大量 `$lookup` 可能说明模型没有贴合访问模式。

### “先 `$unwind` 再过滤也一样”

结果可能一样，性能常常不一样。数组展开会放大中间数据，能先过滤就先过滤。

### “map-reduce 是 MongoDB 聚合的主流方案”

已经不是。MongoDB 5.0 起 map-reduce 不再推荐，新逻辑应优先使用聚合管道。

## 小结

1. 聚合管道是阶段式文档流处理，每个阶段接收上一阶段输出。
2. `$match`、`$sort` 尽量配合索引并尽量靠前，减少后续阶段数据量。
3. `$unwind` 会放大中间结果，数组长度和建模方式会直接影响聚合成本。
4. `$lookup` 能做关联，但不应替代合理的文档建模。
5. map-reduce 已不是新项目首选，聚合管道才是主流方案。

## 参考

- 综合社区资料中聚合管道、常用阶段操作符、map-reduce 相关内容，并用订单统计例子重写。
- 对照 MongoDB 官方文档 Aggregation Pipeline，校准了阶段模型、`$match`/`$group`/`$lookup` 的定位，以及 MongoDB 5.0 起 map-reduce 不推荐使用的版本边界。
- 对资料中“聚合方式并列罗列”的说法补充了新项目优先级和工程优化顺序。
