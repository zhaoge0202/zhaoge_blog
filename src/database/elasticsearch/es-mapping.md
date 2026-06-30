---
title: "Mapping 怎么设计？text 和 keyword 有什么区别？"
description: "讲清动态/显式映射、字段类型，以及 text 与 keyword 在分词、聚合上的本质区别。"
breadcrumb: true
article: true
editLink: false
category:
  - "Elasticsearch"
tag:
  - "基础"
  - "高频"
  - "项目实战"
prev:
  text: "分词器是怎么工作的？中文怎么分词？"
  link: "/database/elasticsearch/es-analyzer.html"
next:
  text: "查询 DSL 怎么写？match 和 term 有什么区别？"
  link: "/database/elasticsearch/es-query-dsl.html"
---

# Mapping 怎么设计？text 和 keyword 有什么区别？

> 一句话点题：mapping 就是 ES 的"表结构"，决定每个字段是什么类型、要不要分词、能不能聚合排序。其中最常被问、也最容易踩坑的，是 text 和 keyword 这两个看着都存字符串、行为却完全相反的类型。

上一篇讲了分词器，但分词器不是凭空生效的——它挂在 mapping 的字段定义上。所以这一篇把 mapping 讲透，重点放在 text 和 keyword 的本质区别，以及"字段类型一旦定就不能改"这条硬约束。

## mapping 是什么

mapping 相当于 MySQL 的表结构定义（DDL）：它规定一个 index 里每个 field 的类型、怎么索引、用什么分词器。区别在于 MySQL 的表结构可以随便 `ALTER`，而 **ES 的字段类型一旦写入数据就基本不能改**（后面会讲为什么）。

建 mapping 有两种方式：动态映射和显式映射。

### 动态映射：省事但有风险

动态映射（dynamic mapping）是指：你不预先定义 mapping，直接往 index 里写文档，ES 会**自动推断**每个字段的类型。比如写入 `{"title": "hello", "views": 100}`，ES 会把 `title` 推成 text、`views` 推成 integer。

省事是真省事，但生产环境往往不敢全靠它，因为推断有时不是你想要的：

- 字符串字段默认被推成 **text + 一个 keyword 子字段**（`fields.keyword`，`keyword` 类型，忽略长度 256），不一定符合业务。
- 日期格式字符串被推成 date，但格式不匹配时会推断失败或解析出错。
- 一个字段第一次写入是数字、第二次写成字符串，可能触发映射冲突报错。

### 显式映射：生产推荐

显式映射（explicit mapping）是**先定义好 mapping，再写数据**：

```json
PUT /articles
{
  "mappings": {
    "properties": {
      "title":    { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
      "status":   { "type": "keyword" },
      "views":    { "type": "integer" },
      "publish_at": { "type": "date", "format": "yyyy-MM-dd HH:mm:ss||epoch_millis" },
      "tags":     { "type": "keyword" },
      "author":   { "type": "object", "properties": { "name": { "type": "keyword" } } }
    }
  }
}
```

生产环境推荐显式映射，类型可控、分词器可控、避免动态推断翻车。

## 核心字段类型一览

常用的字段类型：

| 类型                              | 用途                           | 备注                                       |
| --------------------------------- | ------------------------------ | ------------------------------------------ |
| `text`                            | 全文检索的文本                 | 会分词，建倒排索引，**默认不能聚合排序**   |
| `keyword`                         | 精确值（标签、状态、ID、枚举） | 不分词，可聚合排序，有 doc_values          |
| `integer`/`long`/`float`/`double` | 数值                           | 精确匹配、范围、聚合都支持                 |
| `date`                            | 日期                           | 支持多种格式，内部存 epoch_millis          |
| `boolean`                         | 布尔                           | true/false                                 |
| `ip`                              | IP 地址                        | 支持 CIDR 范围查询                         |
| `object`                          | 嵌套对象（JSON 里再套 JSON）   | 被拍平存储，**数组里会丢失边界**           |
| `nested`                          | 对象数组                       | 作为独立文档存，保留数组项边界，查询更精确 |
| `flattened`                       | 整个对象当一层 key-value       | 适合不确定结构的动态 JSON                  |

其中 `object` 和 `nested` 的区别是个高频细节：`object` 类型会被"拍平"成 `author.name` 这样的扁平字段，但**一旦是对象数组，各项的字段会混在一起**，查"名字叫 A 且年龄大于 30"会错配；`nested` 把每个数组项当独立子文档，能精确做这种组合查询，代价是写入和查询都更贵。

## text 和 keyword：本质区别

这是 mapping 这篇的重头戏。两个类型都存字符串，但行为几乎相反：

| 维度          | text                                   | keyword                          |
| ------------- | -------------------------------------- | -------------------------------- |
| 是否分词      | **会分词**，存分词后的 term            | **不分词**，整体作为一个 term    |
| 适合          | 全文检索（标题、正文、描述）           | 精确匹配（状态、标签、ID、枚举） |
| 能否聚合/排序 | 默认**不能**（除非开 fielddata，危险） | **能**，靠 doc_values            |
| 查询方式      | `match`                                | `term`/`terms`                   |
| 例子          | "MySQL 索引优化" → mysql/索引/优化     | "published" → 整体 "published"   |

一句话记：**要搜内容用 text，要精确匹配/聚合/排序用 keyword。**

很多字段两种需求都有——既想全文搜标题，又想按标题精确过滤或聚合。这时用 `fields` 同时配两种：

```json
"title": {
  "type": "text",
  "analyzer": "ik_max_word",
  "fields": {
    "raw": { "type": "keyword" }
  }
}
```

这样 `title` 走分词做全文检索，`title.raw` 是不分词的 keyword，做精确匹配和聚合。这是生产里最常见的写法。

## 为什么 text 默认不能聚合排序

text 默认不能聚合和排序，背后是 doc_values 和 fielddata 的区别。

- **keyword、数值、日期等类型默认开 doc_values**：这是一种磁盘上的列式存储，聚合/排序时直接读磁盘列存，不占堆内存，安全高效。
- **text 默认没有 doc_values**：因为分词后一个字段对应多个 term，列存意义不大。如果硬要给 text 做聚合，得开 `fielddata: true`，它会**把倒排索引的数据加载进 JVM 堆内存**，数据量大时极易撑爆堆，触发 OOM。

所以结论很明确：**别给 text 开 fielddata 做聚合**，正确做法是要么用 `fields` 配一个 keyword 子字段聚合，要么一开始就把该字段设成 keyword。fielddata 基本是遗留方案，新设计不该依赖它。

## dynamic templates：控制推断行为

如果还是要用动态映射（比如日志场景字段不固定），可以用 **dynamic templates** 控制推断规则，而不是完全听天由命：

```json
"dynamic_templates": [
  {
    "strings_as_keyword": {
      "match_mapping_type": "string",
      "mapping": { "type": "keyword" }
    }
  }
]
```

这条规则让所有被推断为 string 的字段一律变成 keyword（而不是默认的 text+keyword），避免日志类数据被无谓地分词。dynamic templates 是动态映射和显式映射之间的折中，在字段不固定但类型规则明确的场景（如日志）很有用。

## 字段类型一旦定就不能改

这是 mapping 最硬的一条约束：**一个字段一旦有了数据，它的类型就不能再改**。比如 `views` 已经是 integer 且写入了数据，你想改成 keyword，`PUT _mapping` 会直接报错。

为什么不能改？因为字段类型决定了数据在倒排索引里的存储格式——integer 存的是数值、keyword 存的是不分词的字符串、text 存的是分词后的 term。改类型等于要改变所有已存数据的物理格式，而 segment 又是不可变的，没法原地翻新。

要"改类型"，只能走 **reindex**：

1. 建一个新 index，mapping 用你要的新类型；
2. 用 `_reindex` API 把老 index 的数据搬过来；
3. 切换别名指向新 index，删掉老的。

```json
POST /_reindex
{
  "source": { "index": "articles_old" },
  "dest":   { "index": "articles_new" }
}
```

正因为改类型成本这么高，**生产环境几乎都用别名（alias）访问 index**：业务读写都走别名，reindex 完只要把别名切到新 index，业务无感。这也是为什么 mapping 设计要在写数据前想清楚——事后改的代价是全量搬迁。

## 容易踩的坑

- **把该精确匹配的字段设成 text**：状态、ID、标签设成 text 会导致 `term` 查询搜不到（被分词了），且不能高效聚合。
- **给 text 开 fielddata 做聚合**：会把数据塞进 JVM 堆，极易 OOM；正确做法是配 keyword 子字段。
- **以为能直接 ALTER 字段类型**：ES 字段类型有数据后不可改，只能 reindex，所以一定要用别名 + 提前设计好 mapping。
- **对象数组用 object 类型**：`object` 会拍平丢失数组项边界，组合条件查询会错配，需要 `nested`。
- **依赖动态映射写生产数据**：推断结果不可控，要么显式映射，要么用 dynamic templates 收紧规则。

## 小结

- mapping 是 ES 的"表结构"，分动态映射（自动推断，省事但不可控）和显式映射（先定义后写入，生产推荐）。
- text 会分词、做全文检索、默认不能聚合排序；keyword 不分词、做精确匹配/聚合/排序、有 doc_values；两者常通过 `fields` 同时配置。
- text 默认不能聚合是因为没 doc_values，开 fielddata 会撑爆堆内存，正确做法是配 keyword 子字段。
- 字段类型一旦有数据就**不可改**（segment 不可变 + 存储格式固定），改类型要 reindex，所以生产用别名访问 index。
- 字段不固定场景用 dynamic templates 收紧推断规则，对象数组要查组合条件用 nested 而非 object。

## 参考

基于 Elasticsearch 官方文档与 Apache Lucene 官方文档中核心概念、索引、映射、分词、查询、评分、聚合、分页、分片副本和读写流程相关内容整理。
