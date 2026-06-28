---
title: "MongoDB 索引怎么设计？查询为什么没走索引？"
description: "讲清单字段、复合、多键和 TTL 索引，以及查询优化的常见失效点。"
breadcrumb: true
article: true
editLink: false
category:
  - "MongoDB"
tag:
  - "高频"
  - "进阶"
  - "排障"
prev:
  text: "MongoDB 文档模型怎么设计？和 MySQL 怎么选？"
  link: "/database/mongodb/mongodb-data-model.html"
next:
  text: "MongoDB 聚合管道怎么用？和 SQL GROUP BY 有什么不同？"
  link: "/database/mongodb/mongodb-aggregation-pipeline.html"
---

# MongoDB 索引怎么设计？查询为什么没走索引？

> MongoDB 索引设计和 MySQL 一样，核心不是“建了索引就快”，而是让索引顺着查询条件、排序方式和返回字段一起工作。

MongoDB 没有合适索引时，会做集合扫描，也就是一条条文档扫过去找匹配结果。数据量一大，查询延迟、CPU、磁盘 IO 都会变得很难看。

但索引也不是越多越好。每个索引都要占空间，写入、更新、删除时也要维护索引。面试里比较稳的答法是：**先从访问模式出发，再决定建什么索引，而不是看到字段就建索引**。

## MongoDB 常见索引类型

| 索引类型     | 典型用途             | 注意点                                   |
| ------------ | -------------------- | ---------------------------------------- |
| 单字段索引   | 按一个字段过滤或排序 | 升序/降序对单字段查询影响不大            |
| 复合索引     | 多字段过滤、排序     | 字段顺序非常关键，遵循左前缀思路         |
| 多键索引     | 数组字段查询         | 数组每个元素都会进入索引，注意索引膨胀   |
| 唯一索引     | 保证字段不重复       | 已有重复数据时创建会失败                 |
| TTL 索引     | 自动清理过期数据     | 删除不是实时的，只适合过期清理           |
| 文本索引     | 文本搜索             | 能用，但复杂搜索通常更适合 Elasticsearch |
| 地理空间索引 | 经纬度、范围位置查询 | 适合附近的人、门店距离这类场景           |
| 哈希索引     | 哈希分片或等值分布   | 不适合范围查询                           |

这些名字不用死背，关键是能说出“它解决哪类访问模式”。

## 复合索引的顺序为什么重要？

假设有一个订单集合，常见查询是：

```javascript
db.orders
  .find({
    userId: 10086,
    status: "PAID",
  })
  .sort({ createdAt: -1 })
  .limit(20);
```

比较自然的索引是：

```javascript
db.orders.createIndex({ userId: 1, status: 1, createdAt: -1 });
```

这个索引的顺序表达了三件事：

1. 先按 `userId` 缩小到某个用户；
2. 再按 `status` 缩小到某个状态；
3. 最后按 `createdAt` 倒序直接拿最近记录。

如果你只建：

```javascript
db.orders.createIndex({ createdAt: -1, status: 1, userId: 1 });
```

那对“某个用户的已支付订单”就不顺手了。索引从 `createdAt` 开始，用户条件无法在索引入口处迅速缩小范围，优化器可能不会选它。

## 左前缀原则在 MongoDB 里也成立

对复合索引：

```javascript
{ userId: 1, status: 1, createdAt: -1 }
```

它可以比较好地支持这些查询前缀：

- `{ userId: 10086 }`
- `{ userId: 10086, status: "PAID" }`
- `{ userId: 10086, status: "PAID" } + sort({ createdAt: -1 })`

但它不能很好支持：

- `{ status: "PAID" }`
- `{ createdAt: { $gte: ... } }`
- `{ status: "PAID" } + sort({ createdAt: -1 })`

因为这些条件跳过了索引最左侧的 `userId`。

这个逻辑和 MySQL 联合索引很像，但 MongoDB 还有一个很常见的文档特性：数组字段。

## 多键索引：数组字段为什么要小心？

如果文档是这样：

```json
{
  "_id": "...",
  "title": "MongoDB 索引设计",
  "tags": ["database", "mongodb", "index"]
}
```

给 `tags` 建索引：

```javascript
db.articles.createIndex({ tags: 1 });
```

MongoDB 会把数组里的每个元素都放进索引。这样查询某个标签很方便：

```javascript
db.articles.find({ tags: "mongodb" });
```

但代价也很明显：数组越长，索引项越多，写入和更新成本越高。如果一个文档里数组持续增长，比如把所有评论、所有点赞用户都塞进去，再给数组建索引，就很容易让索引膨胀和文档更新变重。

所以多键索引要和建模一起看：数组适合数量可控的局部信息，不适合无限增长的明细流。

## 覆盖查询：只读索引就能返回结果

覆盖查询的意思是：查询条件和返回字段都在同一个索引里，数据库不需要再回到原始文档取数据。

比如索引是：

```javascript
db.users.createIndex({ gender: 1, userName: 1 });
```

查询只返回 `userName`：

```javascript
db.users.find({ gender: "M" }, { userName: 1, _id: 0 });
```

这里要注意 `_id`。MongoDB 默认会返回 `_id`，如果索引里没有 `_id`，又没显式排除，就可能需要回表取 `_id`。所以覆盖查询经常要写 `{ _id: 0 }`。

面试时可以这样说：

> 覆盖查询的价值不是语法本身，而是减少读取原文档的成本，尤其文档比较大时收益更明显。

## TTL 索引不是定时任务

TTL 索引用来自动清理过期文档，适合日志、会话、临时验证码、短期事件数据。

```javascript
db.sessions.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
```

当 `expireAt` 到期后，MongoDB 后台线程会扫描并删除过期文档。但它不承诺到点立刻删除，实际删除会有延迟。如果数据量很大，延迟可能更明显。

所以 TTL 适合“最终清理”，不适合做严格秒级业务调度。如果你要精确触发业务动作，应该用消息队列、调度系统或 Redis ZSet 这类更明确的机制。

TTL 常见限制也要记住：

- 通常是单字段索引，不是普通复合索引的附加属性；
- `_id` 不适合拿来做 TTL；
- 已有同字段非 TTL 索引时，不能简单再建一份同字段 TTL；
- 删除只在 Primary 执行，Secondary 通过复制删除操作保持一致。

## 查询为什么没走索引？

排查 MongoDB 查询时，先看 `explain()`。

```javascript
db.orders
  .find({
    userId: 10086,
    status: "PAID",
  })
  .sort({ createdAt: -1 })
  .explain("executionStats");
```

重点看这些信息：

- 有没有 `COLLSCAN`，出现它通常说明在扫集合；
- 有没有 `IXSCAN`，说明使用了索引扫描；
- `totalDocsExamined` 和 `nReturned` 差距大不大；
- `totalKeysExamined` 是否远大于返回数量；
- 排序是不是用了内存排序。

常见没走索引原因：

1. 查询条件没有命中复合索引左前缀；
2. 排序方向和复合索引顺序不匹配；
3. 条件选择性太差，优化器认为扫索引不划算；
4. 返回字段过大，需要大量回表读取文档；
5. 对字段做了不利于索引的表达式转换；
6. 字段类型不一致，比如索引里是数字，查询传了字符串；
7. 索引太多，优化器选择成本变复杂，写入也被拖慢。

## 怎么设计索引更稳？

一个比较实用的顺序是：

```text
访问模式 -> 等值过滤 -> 范围过滤 -> 排序 -> 投影字段
```

比如“查某用户某状态的最近订单”，索引可以是：

```javascript
{ userId: 1, status: 1, createdAt: -1 }
```

比如“后台按状态筛选并按创建时间分页”，索引可以是：

```javascript
{ status: 1, createdAt: -1, _id: 1 }
```

如果分页深度较大，尽量避免大 `skip`，用上一页最后一条的排序字段做游标：

```javascript
db.orders
  .find({
    status: "PAID",
    createdAt: { $lt: lastCreatedAt },
  })
  .sort({ createdAt: -1 })
  .limit(20);
```

这和 ES 的 `search_after` 思路很像：不要让数据库跳过大量结果，只让它从索引位置继续往后走。

## 容易踩的坑

### “索引越多越好”

不对。索引能加速读，但会拖慢写、占用内存和磁盘。高写入集合尤其要克制，保留真正服务核心查询的索引。

### “MongoDB 支持文本索引，所以全文搜索不用 ES”

不严谨。MongoDB 文本索引可以覆盖简单文本匹配，但复杂中文分词、相关性打分、召回调优、搜索分析，一般还是 Elasticsearch 更合适。

### “TTL 到期就会马上删除”

不对。TTL 是后台清理机制，不保证精确到秒。它适合数据保留期治理，不适合业务定时触发。

### “复合索引字段顺序无所谓”

不对。复合索引字段顺序决定了过滤、排序和覆盖能力。先把高频等值条件放在前面，再考虑范围和排序，是常见起点。

## 小结

1. MongoDB 索引设计要从访问模式出发，不是字段多就多建索引。
2. 复合索引遵循左前缀思路，字段顺序会影响过滤和排序能不能用上索引。
3. 多键索引适合数组查询，但数组过长会造成索引膨胀和写入成本上升。
4. 覆盖查询能减少读取原文档，尤其适合文档较大、返回字段较少的场景。
5. 排查慢查询先看 `explain()`，重点关注 `COLLSCAN`、扫描数量和排序方式。

## 参考

- 综合自 `docs/JavaGuide/docs/database/mongodb/mongodb-questions-02.md` 中索引类型、复合索引、TTL、覆盖查询相关内容，并按访问模式重新组织。
- 对照 MongoDB 官方文档 Indexes、TTL Indexes、Compound Indexes 与 Query Plans，校准了索引类型、TTL 删除延迟和覆盖查询边界。
- 对资料中“文本索引”“TTL 到期删除”等容易答得过满的表述补充了工程使用边界。
