---
title: "聚合查询怎么用？和 SQL GROUP BY 有什么不同？"
description: "讲清 bucket/metric/pipeline 三类聚合、嵌套用法，以及基于分片近似的边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "Elasticsearch"
tag:
  - "高频"
  - "进阶"
  - "项目实战"
prev:
  text: "相关性打分是怎么回事？TF-IDF 和 BM25 有什么区别？"
  link: "/database/elasticsearch/es-scoring.html"
next:
  text: "分片和副本是怎么回事？分片数怎么定？"
  link: "/database/elasticsearch/es-shard-replica.html"
---

# 聚合查询怎么用？和 SQL GROUP BY 有什么不同？

> 一句话点题：ES 不只会搜索，还能做统计分析——按标签分组、算平均浏览量、统计独立访客数，这些都靠聚合。它和 SQL 的 `GROUP BY + 聚合函数` 思路很像，但有个本质区别：ES 的很多聚合是"分片近似"，不是精确值。

前面几篇都在讲"怎么把文档查出来"，这篇讲"怎么从文档里算统计值"。聚合是 ES 在搜索之外另一个高频用途（日志分析、报表、数据看板），也是面试里区分"会用 ES"和"懂 ES"的分水岭。

## 聚合分三类

ES 的聚合按作用分成三类，记住这个分类，遇到需求就能对号入座：

| 类型         | 干什么                                         | SQL 类比          |
| ------------ | ---------------------------------------------- | ----------------- |
| **bucket**   | 把文档按某种规则分到不同的"桶"里，每桶统计数量 | `GROUP BY`        |
| **metric**   | 对一组文档算数值指标（平均、求和、最大最小）   | `AVG/SUM/MAX/MIN` |
| **pipeline** | 基于其他聚合的结果再算（如桶间求导、累计）     | 嵌套聚合的后处理  |

一条聚合查询可以同时跑 bucket 和 metric：先按标签分桶（bucket），再对每桶算平均浏览量（metric）。这和 SQL `SELECT tag, AVG(views) FROM ... GROUP BY tag` 是同一个思路。

## bucket 聚合：按什么分组

最常用的 bucket 是 `terms`，按字段值分桶：

```json
GET /articles/_search
{
  "size": 0,
  "aggs": {
    "by_tag": {
      "terms": { "field": "tags", "size": 10 }
    }
  }
}
```

这条查询按 `tags` 字段分桶，返回出现最多的 10 个标签及各自文档数。`size: 0` 表示不要返回文档原文，只要聚合结果——这是纯统计查询的标配，省掉取文档的开销。

除了 `terms`，bucket 还能按范围、时间区间分：`range`（数值范围桶）、`date_histogram`（按天/小时分桶，做时间序列）、`histogram`（数值等宽桶）。日志里"每天的访问量""每小时错误数"就是 `date_histogram` 的典型场景。

## metric 聚合：算什么指标

metric 聚合对一组文档算数值，常用的：

| 聚合          | 算什么                         |
| ------------- | ------------------------------ |
| `avg`/`sum`   | 平均值 / 求和                  |
| `max`/`min`   | 最大 / 最小                    |
| `stats`       | 一次返回 count/min/max/avg/sum |
| `cardinality` | 去重计数（独立值数量，如 UV）  |
| `percentiles` | 百分位数（P50/P95/P99 延迟）   |

`cardinality` 和 `percentiles` 特别说明一下，它们不是精确值，下面单独讲。

## 嵌套聚合：桶里套桶

聚合能嵌套：bucket 里再套 bucket 或 metric。比如"按标签分组，每组再算平均浏览量，且按浏览量倒序"：

```json
{
  "size": 0,
  "aggs": {
    "by_tag": {
      "terms": { "field": "tags", "size": 10, "order": { "avg_views": "desc" } },
      "aggs": {
        "avg_views": { "avg": { "field": "views" } }
      }
    }
  }
}
```

`by_tag` 是外层桶，`avg_views` 是嵌在每桶里的 metric。返回结构就是"每个标签 → 文档数 + 平均浏览量"。嵌套可以多层，比如"按天 → 按标签 → 平均浏览量"，做时间维度的下钻分析。

## 和 SQL GROUP BY 的类比与边界

聚合的思路和 SQL 高度对应：`terms` ≈ `GROUP BY`，`avg/sum` ≈ `AVG()/SUM()`。但有一个**本质区别必须知道**：ES 的部分聚合是**分片近似**，不是精确值。

原因在 ES 的分布式架构。一个 index 的数据分散在多个分片上，聚合时**每个分片先各自算自己的局部结果，再由协调节点归并**。这对 `sum`、`max`、`min` 这类可加/可比的聚合没问题——各分片 sum 加起来就是总和。但对 `terms`（按出现次数排序取前 N）和 `cardinality`（去重计数）就有坑：

**terms 的 `doc_count_error_upper_bound`。** 假设有 5 个分片，你要"出现次数前 10 的标签"。每个分片只返回自己本地的前 10，协调节点归并时，可能漏掉某些"全局排第 8、但在某个分片排第 11"的标签。ES 会在结果里给一个 `doc_count_error_upper_bound`，表示这个桶的文档数**最多可能差多少**。要更准可以调大 `size`（每个分片多返回些候选）或开 `show_term_doc_count_error: true`。

**cardinality 基于 HyperLogLog++。** `cardinality` 算去重数量（如独立访客 UV），但精确去重在分布式下代价极高，ES 用 HyperLogLog++ 算法做**近似计数**，默认精度 `precision_threshold=3000`（低于此值近乎精确，高于则误差增大，最大约 1%）。所以 `cardinality` 的结果是个估计值，不是精确数。

## 什么时候聚合会不准、怎么应对

把上面的近似性总结成一张表：

| 聚合              | 是否精确 | 说明                                        |
| ----------------- | -------- | ------------------------------------------- |
| `sum`/`max`/`min` | 精确     | 可加/可比，分片归并无损                     |
| `avg`             | 精确     | 由 sum/count 归并得出                       |
| `terms`           | **近似** | 分片取前 N 再归并，有 `doc_count_error`     |
| `cardinality`     | **近似** | HyperLogLog++，`precision_threshold` 控精度 |
| `percentiles`     | **近似** | TDigest 算法，尤其尾部百分位有误差          |

应对思路：

- 对 `terms`：要求精确时调大 `size`，或在单分片索引上跑（无归并误差）。
- 对 `cardinality`：接受近似，或调高 `precision_threshold`（更准但更费内存）；要绝对精确只能换 `terms` + `size` 很大的暴力方式，通常不划算。
- 对 `percentiles`：P50 一般准，P99 等尾部有误差，关键场景可换 `tdigest` 的 `compression` 调高或用 `hdr_histogram`。

一个常见的工程取舍：**报表类看板可以接受近似**（UV 差 1% 无所谓），但**财务、计费等要精确的场景别用 cardinality/percentiles**，要么用可加的 sum，要么干脆回 MySQL 算。

## 容易踩的坑

- **把 cardinality 当精确值用**：它基于 HyperLogLog++ 近似，默认有误差，计费/财务场景不能依赖。
- **terms 结果有 doc_count_error 没注意**：分片归并导致计数可能偏差，要更准调大 `size`。
- **聚合忘了 `size: 0`**：纯统计查询不返回文档原文，加 `size: 0` 省掉取文档开销。
- **拿 ES 聚合和 SQL GROUP BY 当完全等价**：思路像，但 ES 多了分片近似这层，精度边界不同。
- **在 text 字段上聚合**：text 默认不能聚合（没 doc_values），要聚合得用 keyword 子字段。

## 小结

- 聚合分三类：bucket（分组，≈ GROUP BY）、metric（算指标，≈ AVG/SUM）、pipeline（基于聚合结果再算）。
- 聚合可嵌套，bucket 里套 metric 做下钻分析；纯统计查询加 `size: 0` 不返回文档原文。
- 与 SQL 的本质区别：ES 部分聚合是**分片近似**——sum/max/min/avg 精确，但 **terms 有 doc_count_error、cardinality 基于 HyperLogLog++ 近似、percentiles 有尾部误差**。
- cardinality 的 `precision_threshold` 控精度，报表可近似、计费要精确的场景别用近似聚合。
- text 字段默认不能聚合，要聚合用 keyword 子字段。

## 参考

基于 Elasticsearch 官方文档与 Apache Lucene 官方文档中核心概念、索引、映射、分词、查询、评分、聚合、分页、分片副本和读写流程相关内容整理。
