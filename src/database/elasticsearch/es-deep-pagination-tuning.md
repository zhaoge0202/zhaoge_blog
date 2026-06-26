---
title: "深分页怎么优化？ES 还有哪些性能调优手段？"
description: "对比 from+size/scroll/search_after 三种分页，并汇总写入、查询、JVM 等调优要点。"
breadcrumb: true
article: true
editLink: false
category:
  - "Elasticsearch"
tag:
  - "高频"
  - "进阶"
  - "排障"
prev:
  text: "写入和查询在集群里是怎么流转的？"
  link: "/database/elasticsearch/es-read-write-flow.html"
next:
  text: "MongoDB"
  link: "/database/mongodb/"
---

# 深分页怎么优化？ES 还有哪些性能调优手段？

> 一句话点题：ES 默认的 `from + size` 分页翻到深处会拖垮协调节点，所以有 `scroll` 和 `search_after` 两种替代方案。搞清它们各自的适用场景，再配上写入、查询、JVM 几个调优要点，基本能覆盖 ES 性能问题的大头。

这是 ES 专题的收官篇。深分页是面试高频、也是生产高频的坑，这篇先把它讲透，再把分散在前面各篇的调优要点收口成一个清单。

## 先说为什么 from + size 翻深了不行

上一篇讲读流程时埋了线：query 阶段每个分片返回的是 `from + size` 条候选，协调节点要归并 `分片数 × (from + size)` 条再排序。`from` 越大，协调节点要处理的候选越多，内存和 CPU 飙升。

举个数：10 个分片，`from=10000, size=10`，协调节点要归并 `10 × 10010 ≈ 10 万` 条候选，就为了返回 10 条。翻得越深越离谱。

所以 ES 给 `from + size` 设了硬上限 **`max_result_window`，默认 10000**。`from + size` 超过 10000 直接报错。这个限制不是 ES 跟你过不去，是保护协调节点不被深翻页打爆。真要翻到 10000 以后，得换方案。

## 三种分页方案对比

| 方案           | 原理                           | 适合场景           | 缺点                            |
| -------------- | ------------------------------ | ------------------ | ------------------------------- |
| `from + size`  | 跳过 from 条取 size 条         | 浅分页、随机跳页   | 深翻页爆内存，上限 10000        |
| `scroll`       | 第一次查询建快照，用游标续查   | 数据导出、reindex  | 占内存、有状态、不适合实时/高频 |
| `search_after` | 用上一页最后一条的排序值当游标 | 实时深分页（推荐） | 不能跳页、需唯一排序字段        |

## scroll：快照游标，适合导出不适合实时

`scroll` 的思路是：第一次查询时，ES 给当前结果集建一个**快照**，返回一个 `scroll_id`；后续每次带着 `scroll_id` 续查下一批，直到取完。它像数据库里的游标。

```json
// 第一次：建快照，拿 scroll_id
POST /articles/_search?scroll=1m
{ "size": 100, "query": { "match_all": {} } }

// 后续：带 scroll_id 续查
POST /_search/scroll
{ "scroll": "1m", "scroll_id": "DXF1ZXJ5..." }
```

`scroll=1m` 是快照保留时间，每次续查会续期；超时未续期，快照自动清理。

scroll 的关键特性是**快照一致性**：它基于第一次查询时刻的数据建快照，之后新写入的文档**不会出现在结果里**。这适合"把整个索引导出来"这种一次性扫描（reindex、数据迁移、报表全量计算），但不适合实时分页——用户翻页期间有新数据，scroll 看不到，体验很差。

scroll 还有几个代价：维护快照要占资源（每个 scroll 上下文占内存和文件句柄）、超时前不会自动释放（忘了关就泄漏）、大量并发 scroll 会拖垮集群。所以**scroll 是为批量导生设计的，不是给用户分页用的**。官方现在也建议实时深分页优先用 search_after。

## search_after：无状态游标，实时深分页的首选

`search_after` 的思路更巧妙：不要快照，而是**用上一页最后一条文档的排序值作为下一页的查询起点**。

```json
// 第一页
GET /articles/_search
{
  "size": 10,
  "sort": [ { "publish_at": "desc" }, { "_id": "asc" } ]
}

// 第二页：把第一页最后一条的 sort 值填进 search_after
GET /articles/_search
{
  "size": 10,
  "sort": [ { "publish_at": "desc" }, { "_id": "asc" } ],
  "search_after": [ "2026-06-20T10:00:00Z", "abc123" ]
}
```

它靠排序字段的值定位"下一页从哪开始"，协调节点不再需要归并海量候选，深翻页也不会爆。而且它**无状态**——每次都是实时查询，新写入的文档能看到，适合用户实时翻页。

但 search_after 有两个限制：

1. **必须有排序字段，且排序值要唯一**。所以通常加 `_id` 作为兜底排序，保证排序值不重复（否则翻页可能漏数据或重复）。
2. **不能跳页**。它只能"下一页""下一页"地往后翻，不能直接跳到第 50 页——因为跳页需要知道第 50 页起点的排序值，而你不知道。所以 search_after 适合"无限滚动加载"这类场景，不适合"跳到指定页"。

总结一句：**实时深分页用 search_after，批量导出用 scroll，浅分页才用 from + size。**

## 性能调优清单

把前面各篇散落的调优点和工程经验收口成一份清单。

**写入优化：**

- **批量写用 bulk**：单条写每次都有网络和 refresh 开销，`bulk` API 一次提交一批，吞吐高一个数量级。批量大小建议 5~15MB。
- **调大 `refresh_interval`**：写入密集场景把默认 1s 调到 30s 甚至临时设 `-1`，减少小 segment 产生，写完再调回。
- **副本数临时设 0**：海量初次导入时先把副本设 0（省掉同步副本开销），导完再调回 1+。

**查询优化：**

- **能用 filter 别用 must**：纯过滤不打分、可缓存，上一节讲过。
- **避免深分页**：按上面三方案选，别用 from + size 硬翻。
- **只取需要的字段**：用 `_source` 过滤只取用到的字段，别整篇捞，省网络和反序列化。
- **聚合用 keyword 子字段**：别在 text 上开 fielddata 聚合。

**索引设计：**

- **单分片 30~50GB**，按数据量定主分片数，别 over-shard。
- **时序数据按时间切索引**（如按天/月建 index），老索引可以 shrink/删除，比单一大索引好维护。
- **用别名访问 index**，方便 reindex 和无感切换。

**JVM 与集群：**

- **JVM 堆建议不超过物理内存 50%**：剩下留给 Lucene 的文件系统缓存（off-heap，靠操作系统页缓存加速磁盘读），堆给太多反而让缓存缩水。
- **堆不超过 32GB**：超过 32GB 会失去指针压缩（Compressed Oops），性能反而下降。
- **堆外缓存很重要**：ES 的查询性能很大程度靠操作系统的文件缓存命中，所以 data 节点内存别被堆占满。
- **避免大结果集聚合**：在高基数字段上做 terms/cardinality 聚合很吃内存，必要时用采样或限制。

## 容易踩的坑

- **深翻页用 from + size 硬扛**：超过 10000 报错，且 from 越大协调节点越爆；实时深分页换 search_after。
- **拿 scroll 给用户实时分页**：scroll 是快照、看不到新数据、占资源，适合导出不适合实时。
- **search_after 漏加 \_id 兜底排序**：排序值不唯一会翻页漏数据或重复，务必加唯一字段兜底。
- **JVM 堆给到 50% 以上**：挤占 Lucene 文件缓存，磁盘读命中率下降反而变慢；堆也别超 32GB 丢指针压缩。
- **海量写入还开 1s refresh**：小 segment 爆炸拖慢查询，批量导入时调大 refresh_interval 或设 -1。

## 小结

- `from + size` 翻深了会爆协调节点（归并 `分片数×(from+size)` 候选），默认上限 `max_result_window=10000`。
- **scroll 建快照、适合批量导出/reindex，不适合实时分页**；**search_after 用排序值当游标、无状态、可实时，是深分页首选**，但需唯一排序字段、不能跳页。
- 写入优化：bulk 批量写、调大 refresh_interval、初次导入副本设 0。
- 查询优化：filter 替代 must、避免深分页、`_source` 只取需要的字段、聚合用 keyword 子字段。
- JVM 堆 ≤ 物理内存 50% 且 ≤ 32GB，留内存给 Lucene 文件缓存；时序数据按时间切索引，用别名访问。

## 参考

本篇以 Elasticsearch 官方文档（Search - from/size、scroll、search_after、Tune for search/indexing speed、Heap size sizing）为权威源重写，三种分页方案的限制与调优经验值均依据官方文档核对。过时或不严谨的说法已在正文中点明。
