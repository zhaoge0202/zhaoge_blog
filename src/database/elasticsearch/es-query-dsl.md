---
title: "查询 DSL 怎么写？match 和 term 有什么区别？"
description: "讲清 Query/Filter 上下文、bool 复合查询，以及 match 会分词、term 不分词的坑。"
breadcrumb: true
article: true
editLink: false
category:
  - "Elasticsearch"
tag:
  - "高频"
  - "必会"
  - "项目实战"
prev:
  text: "Mapping 怎么设计？text 和 keyword 有什么区别？"
  link: "/database/elasticsearch/es-mapping.html"
next:
  text: "相关性打分是怎么回事？TF-IDF 和 BM25 有什么区别？"
  link: "/database/elasticsearch/es-scoring.html"
---

# 查询 DSL 怎么写？match 和 term 有什么区别？

> 一句话点题：ES 的查询用 JSON 描述，叫 Query DSL。学它最该抓住的不是一堆语法，而是两条分界线——要不要打分（Query 上下文 vs Filter 上下文）、要不要分词（match vs term）。这两条线搞清楚，八成的查询都不会写错。

前面几篇讲了数据怎么存、怎么分词、怎么建映射，这篇终于到"怎么查"。ES 查询的门道不少，但只要抓住"打分"和"分词"两个维度，就能把 DSL 的结构理顺。

## 先分清两个上下文：打分还是不打分

这是理解 DSL 的第一把钥匙。ES 把查询分成两种上下文：

| 上下文             | 行为                                   | 典型场景                     |
| ------------------ | -------------------------------------- | ---------------------------- |
| **Query context**  | 既判断文档匹不匹配，**还算相关性打分** | 全文检索、按相关性排序       |
| **Filter context** | 只判断匹不匹配，**不打分**，结果可缓存 | 范围过滤、精确匹配、状态筛选 |

两者的区别不只是"打不打分"，还有**缓存**：Filter 的结果不依赖打分，ES 会缓存它（缓存的是"哪些文档匹配"的位图），下次同样的过滤直接命中缓存，飞快。Query 每次都要算分，没法这样缓存。

所以一条经验法则：**不需要相关性排序的判断，统统放 Filter**。比如"状态=已发布 AND 创建时间在最近 7 天"，这种纯过滤就该用 filter，省掉打分开销还能吃缓存；只有"标题匹配关键词并按相关性排序"才需要 Query 打分。

## 叶子查询：精确匹配那一类

最底层的查询叫叶子查询（leaf query），主要对应[term-level 查询](https://www.elastic.co/guide/en/elasticsearch/reference/current/term-level-queries.html)，特点是**不分词**，拿原始值去匹配。常用的几个：

| 查询     | 用途                            | 例子                                         |
| -------- | ------------------------------- | -------------------------------------------- |
| `term`   | 精确匹配单个值                  | `status` 等于 `published`                    |
| `terms`  | 匹配多个值之一（类似 SQL `IN`） | `status` 在 `[published, draft]` 中          |
| `range`  | 范围                            | `views` 在 100~1000、`publish_at` 在某段时间 |
| `exists` | 字段是否存在（非 null）         | 有 `author` 字段的文档                       |
| `ids`    | 按文档 id 批量查                | id 在 `[1, 2, 3]`                            |
| `prefix` | 前缀匹配                        | `name` 以 `mysq` 开头                        |

```json
GET /articles/_search
{
  "query": {
    "term": { "status": "published" }
  }
}
```

注意：term 查询**不对查询值分词**，你写 `"MySQL"` 它就拿 `MySQL` 整体去匹配倒排索引里的 term。这个特性是下一节那个大坑的根源。

## 复合查询：bool 把条件拼起来

真实查询很少只有一个条件，多半是"标题匹配关键词 AND 状态=已发布 AND 时间在最近 7天"。这种用 `bool` 组合，它有四种子句：

| 子句       | 作用                                                  | 是否打分              |
| ---------- | ----------------------------------------------------- | --------------------- |
| `must`     | 必须匹配                                              | **打分**              |
| `should`   | 应该匹配（满足可加分；无 must/should 时至少满足一个） | **打分**              |
| `must_not` | 必须不匹配                                            | 不打分（等同 filter） |
| `filter`   | 必须匹配，但**只过滤不打分**                          | 不打分，**可缓存**    |

一个典型写法——"标题匹配 mysql、状态已发布、最近 7 天、且不是草稿"：

```json
GET /articles/_search
{
  "query": {
    "bool": {
      "must":     [ { "match": { "title": "mysql" } } ],
      "filter":   [ { "term":  { "status": "published" } },
                    { "range": { "publish_at": { "gte": "now-7d" } } } ],
      "must_not": [ { "term":  { "status": "draft" } } ]
    }
  }
}
```

这条查询完美体现了上下文分工：`title` 要按相关性排序，放 `must`（Query context 打分）；`status`、`publish_at` 只是过滤，放 `filter`（不打分、可缓存）。把纯过滤条件从 `must` 挪到 `filter`，是 ES 查询优化最基本的一条。

## 全文查询：match 家族

和 term 相对的是全文查询，**会对查询文本分词**，是 text 字段的主力。核心是 `match`：

```json
{ "match": { "title": "mysql 索引" } }
```

ES 会先把 `"mysql 索引"` 分词成 `["mysql", "索引"]`，再去倒排索引里找包含这些词的文档，并按相关性打分排序。包含两个词的文档比只包含一个的得分高。

`match` 家族还有几个常用变体：

| 查询                  | 行为                                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| `match`               | 分词后任意词命中即可（默认 OR），可配 `operator: and`                               |
| `match_phrase`        | 分词后**词序必须连续**（"mysql 索引" 能匹配"mysql 索引优化"，不能匹配"索引 mysql"） |
| `match_phrase_prefix` | 末尾词允许前缀匹配（输入提示场景）                                                  |
| `multi_match`         | 在多个字段上做 match                                                                |

`match` 默认是 OR：查"mysql 索引"，包含 mysql **或** 索引的文档都返回。要变成"两个词都得有"，加 `"operator": "and"`。

## match 和 term 到底差在哪

这是全文检索最高频的坑，也是前面[分词器](./es-analyzer.html)埋的伏笔。一句话：**`match` 会分词，`term` 不会。**

看这个经典翻车场景：title 是 text 类型，分词后小写存入倒排索引（`MySQL` → `mysql`）。现在查"包含 MySQL 的文章"：

- 用 `match`：查询词 `MySQL` 被分词成小写 `mysql`，去匹配小写的 term，✅ 命中。
- 用 `term`：查询词 `MySQL` **不分词**，拿大写 `MySQL` 去匹配小写 `mysql`，❌ 搜不到。

所以结论很清晰：

| 字段类型  | 该用哪个查询        | 为什么                                                  |
| --------- | ------------------- | ------------------------------------------------------- |
| `text`    | `match`（全文检索） | text 存的是分词后小写 term，要分词才能对上              |
| `keyword` | `term`（精确匹配）  | keyword 不分词，整体就是一个 term，match 反而可能出问题 |
| 数值/日期 | `term`/`range`      | 本就是精确值，不需要分词                                |

一个常被忽略的细节：**用 `term` 查 text 字段几乎一定是错的**。哪怕碰巧能搜到（比如查小写值），也违背了 text 的设计意图，且无法利用打分。看到"明明有数据 term 却搜不到"，第一反应就该是：是不是查了 text 字段、或大小写没对上。

## 什么时候用 filter

把前面几节串起来，filter 的使用时机就清楚了：

1. **精确过滤**（状态、标签、ID、枚举）→ `filter` + `term`/`terms`
2. **范围过滤**（时间、数值区间）→ `filter` + `range`
3. **存在性判断**（字段有无）→ `filter` + `exists`

凡是"我只要判断匹不匹配、不关心它多相关"的条件，都放 filter。好处有二：省掉打分计算、结果可缓存。一个查询里，把能放 filter 的都从 must 挪到 filter，往往就是最立竿见影的优化。

## 容易踩的坑

- **用 term 查 text 字段**：text 存的是分词后小写 term，term 不分词拿原文匹配，大小写/词形对不上就搜不到——这是"搜不到"问题的头号原因。
- **把纯过滤条件放 must**：白白算分又吃不到缓存，能过滤的都该放 filter。
- **match 默认 OR 当成 AND**：查"mysql 索引"默认任一词命中就返回，要全包含得加 `operator: and`。
- **用 match 查 keyword 字段**：keyword 不分词，match 的分词行为反而可能把整体值切碎导致匹配异常，精确值该用 term。
- **以为 should 一定可选**：当 bool 里没有 must/filter 时，should 至少要满足一个（minimum_should_match 默认 1）；有 must 时 should 才是纯加分作用。

## 小结

- ES 查询分两个上下文：Query context 打分（全文检索）、Filter context 不打分且可缓存（纯过滤）；不需要相关性排序的判断都放 filter。
- 叶子查询（term/terms/range/exists 等）不分词，做精确匹配；`bool` 用 must/should/must_not/filter 组合条件，其中 must/should 打分，filter/must_not 不打分。
- 全文查询 `match` 会分词，是 text 字段主力；`match_phrase` 要求词序连续，`multi_match` 跨字段。
- **match 分词、term 不分词**：查 text 用 match、查 keyword/数值/日期用 term，用反了就搜不到。
- 优化第一步：把精确过滤和范围条件从 must 挪到 filter，省打分、吃缓存。

## 参考

本篇以 Elasticsearch 官方文档（Query DSL、Term-level queries、Full text queries、Bool query、Query and filter context）为权威源重写，上下文划分与缓存行为依据官方文档核对。过时或不严谨的说法已在正文中点明。
