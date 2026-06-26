---
title: "分词器是怎么工作的？中文怎么分词？"
description: "拆解 analyzer 三段结构、内置分词器与 IK 中文分词，并讲清索引时与查询时的分词坑。"
breadcrumb: true
article: true
editLink: false
category:
  - "Elasticsearch"
tag:
  - "基础"
  - "高频"
  - "细节题"
prev:
  text: "倒排索引为什么让 Elasticsearch 搜索这么快？"
  link: "/database/elasticsearch/es-inverted-index.html"
next:
  text: "Mapping 怎么设计？text 和 keyword 有什么区别？"
  link: "/database/elasticsearch/es-mapping.html"
---

# 分词器是怎么工作的？中文怎么分词？

> 一句话点题：倒排索引里的"词"不是天上掉下来的，是分词器把一整段文本切出来的。分词切得对不对，直接决定你能不能搜到——同一个词，索引时切成 A、查询时切成 B，就永远搜不到。

上一篇讲了倒排索引靠"词→文档"的反向表工作，但留下一个关键问题没回答：**这些词（term）是怎么从一篇文档里切出来的？** 这就是分词器（analyzer）的活。分词是 ES 全文检索最容易出 bug 的环节，理解它能少踩一半"明明有数据却搜不到"的坑。

## 分词器到底干什么

分词器把一段文本变成一串 term，供倒排索引使用。比如 `"MySQL 索引优化"` 经过切分，可能变成 `["mysql", "索引", "优化"]` 这几个 term，分别建进倒排索引。

一个完整的 analyzer 由三段串联而成，文本依次流过：

```mermaid
flowchart LR
    Text["原始文本\n'MySQL，索引优化！'"] --> CF["① character filter\n字符过滤"]
    CF --> TK["② tokenizer\n切词"]
    TK --> TF["③ token filter\n词项过滤"]
    TF --> Terms["最终 term\n[mysql, 索引, 优化]"]
```

三段各自的职责：

| 阶段                 | 干什么                                                | 例子                                     |
| -------------------- | ----------------------------------------------------- | ---------------------------------------- |
| **character filter** | 在切词前对原始文本做字符级处理                        | 去掉 HTML 标签（`html_strip`）、替换字符 |
| **tokenizer**        | 把文本切成一个个词项（token），**这是唯一必需的一段** | 按空格切、按标点切、按中文切             |
| **token filter**     | 对切出来的 token 做加工                               | 转小写、去停用词、加同义词、词干提取     |

注意一个常被忽略的点：**只有 tokenizer 是必需的**，character filter 和 token filter 可以没有。所以"分词器"在 ES 里既可以指完整的三段组合，也可以仅指一个 tokenizer——具体语境要注意。

## 用一个例子走一遍

拿 `"MySQL，索引优化！"` 走一遍标准分词器（`standard`）：

1. **character filter**：standard 没配，原样通过。
2. **tokenizer**：standard tokenizer 按 Unicode 文本分割算法切词，标点会被切掉，得到 `["MySQL", "索引", "优化"]`。
3. **token filter**：standard 内置了 lowercase filter，把 `MySQL` 转成 `mysql`；中文部分保持不变。最终 term：`["mysql", "索引", "优化"]`。

这几个 term 就会被写进倒排索引。注意 **`MySQL` 存进索引时已经是小写 `mysql`**——这意味着你后面用 `term` 查询大写的 `MySQL` 是搜不到的（因为 term 不分词，会拿原始大写去匹配小写 term）。这个坑在[查询 DSL](./es-query-dsl.html) 那篇会重点讲，这里先埋个伏笔。

## 内置分词器有哪些

ES 自带一批开箱即用的 analyzer，常用的几个：

| analyzer     | 行为                                         | `"MySQL 索引优化"` 的结果       |
| ------------ | -------------------------------------------- | ------------------------------- |
| `standard`   | 默认，按 Unicode 分词 + 转小写，中文按"字"切 | `[mysql, 索, 引, 优, 化]`       |
| `simple`     | 按非字母切分 + 转小写                        | `[mysql]`（中文被当非字母切掉） |
| `whitespace` | 只按空白切，**不转小写**                     | `[MySQL, 索引优化]`             |
| `keyword`    | 不分词，整段当成一个 term                    | `["MySQL 索引优化"]`            |
| `stop`       | 同 simple 但去掉停用词（the/a/is 等）        | `[mysql]`                       |

这里有个**反直觉但关键的事实**：ES 自带的 `standard` 分词器对中文，是**按单字切**的——"索引优化"会被切成"索""引""优""化"四个字，而不是"索引""优化"两个词。

为什么？因为中文词之间没有空格，standard 的切分算法认不出词边界，只能退化成逐字切。这会带来一个麻烦：搜"索引"时，"索引"和"引索"都会命中（都包含"索""引"两字），相关性很差。所以**做中文搜索，基本都要换专门的中文分词器**，最常见的是 IK。

## 中文分词：为什么需要 IK

中文分词的难点在于"词"没有明确边界，"研究生命起源"可以是"研究/生命/起源"，也可以是"研究生/命/起源"，得靠词典和统计判断。ES 默认的 standard 搞不定，社区最常用的是 **IK 分词器**。

IK 提供两种切分模式：

| 模式          | 粒度   | "研究生命起源" 的结果                                  |
| ------------- | ------ | ------------------------------------------------------ |
| `ik_smart`    | 粗粒度 | `[研究生, 命, 起源]` 或 `[研究, 生命, 起源]`（看词典） |
| `ik_max_word` | 细粒度 | `[研究, 研究生, 生命, 命, 起源]`（尽量多切）           |

两者的取舍是经典的"索引时 vs 查询时"分工：

- **索引时用 `ik_max_word`（细粒度）**：把文本尽量切全，召回率高，保证用户搜各种词都能命中。
- **查询时用 `ik_smart`（粗粒度）**：查询词切得少而准，减少歧义，提升精确度。

这是 IK 的官方推荐用法，也是中文搜索的标配配置。在 [Mapping](./es-mapping.html) 里会给字段配 `analyzer: ik_max_word`（索引时）、`search_analyzer: ik_smart`（查询时）。

IK 还支持**自定义词典**和**远程词典**（热更新），新词加进词典即可被切出来，不用重建索引（但已索引的旧文档不会自动重新分词，需要 reindex）。

## 用 \_analyze 调试分词

分词出问题时，别靠猜，用 `_analyze` API 直接看一段文本会被切成什么：

```json
POST /_analyze
{
  "analyzer": "ik_max_word",
  "text": "研究生命起源"
}
```

返回每个 token 及其位置、起止偏移。这个 API 是排查"搜不到"问题的第一工具——**先确认索引时和查询时分别切成了什么 term，再对比它们一不一致**。

也可以指定字段，看某个字段实际用的分词器：

```json
POST /my_index/_analyze
{
  "field": "title",
  "text": "研究生命起源"
}
```

## 索引时 vs 查询时：双重分词的坑

分词最大的坑，来自它发生在**两个时机**：

1. **索引时（index time）**：文档写入时，用字段的 `analyzer` 分词，结果存进倒排索引。
2. **查询时（search time）**：查询时，对查询文本分词（`match` 等会分词），用 `search_analyzer`（没配就用 `analyzer`），再去倒排索引里匹配。

这带来两类经典 bug：

**坑一：索引和查询分词器不一致。** 索引用 `ik_max_word` 切成"索引""优化"，查询时如果误配成 `whitespace`（按空格切），查询词"索引优化"不会被切，整体作为一个 term 去匹配，自然搜不到。所以 `analyzer` 和 `search_analyzer` 要配套。

**坑二：用错查询类型。** `match` 会对查询文本分词，`term` 不会。索引时"MySQL"被切成小写 `mysql` 存入；你用 `term` 查 `MySQL`，ES 拿原始大写 `MySQL` 去匹配小写 `mysql`，匹配失败。这不是分词器坏了，是查询类型用错了——精确匹配不分词的字段（如 keyword、数字、IP）才该用 `term`，全文检索要用 `match`。这个区分在[查询 DSL](./es-query-dsl.html) 会展开。

## 容易踩的坑

- **以为 standard 能分中文词**：standard 对中文是逐字切，做中文搜索必须换 IK 等中文分词器。
- **索引和查询分词器不配套**：`analyzer` 和 `search_analyzer` 要对应，否则索引切成 A、查询切成 B，永远搜不到。
- **用 term 查 text 字段**：text 字段存的是分词后的小写 term，`term` 不分词拿原文匹配，大小写/词形对不上就搜不到。
- **加了新词典就以为旧数据生效**：词典更新只影响新写入的文档，已索引的旧文档要 reindex 才会重新分词。
- **把 analyzer 和 tokenizer 混为一谈**：analyzer 是三段组合，tokenizer 只是中间切词那一段，配置时别填错层级。

## 小结

- 分词器把文本切成 term 供倒排索引使用，由三段组成：character filter（字符过滤）→ tokenizer（切词，唯一必需）→ token filter（转小写/去停用词/同义词等）。
- ES 默认 `standard` 对中文是逐字切，做中文搜索要用 IK：**索引时 `ik_max_word` 提召回、查询时 `ik_smart` 提精确**。
- 用 `_analyze` API 直接看分词结果，是排查"搜不到"的第一工具。
- 分词发生在索引时和查询时两个时机，`analyzer`/`search_analyzer` 要配套；`match` 会分词、`term` 不分词，用错类型是搜不到的高频原因。
- 词典热更新只影响新文档，旧文档需 reindex 才能重新分词。

## 参考

本篇以 Elasticsearch 官方文档（Analysis、Analyzer 构成、内置 analyzer）为权威源重写，IK 分词器的两种模式与索引/查询配套用法依据 IK 官方说明核对。过时或不严谨的说法已在正文中点明。
