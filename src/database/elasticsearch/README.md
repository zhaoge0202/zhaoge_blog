---
title: "Elasticsearch"
description: "围绕倒排索引、分词映射、查询打分、聚合、分片集群与读写流程的搜索专题。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "写 SQL 有哪些常见的写法坑？"
  link: "/database/sql/sql-writing-best-practices.html"
next:
  text: "Elasticsearch 的核心概念是什么，和 MySQL 怎么对应？"
  link: "/database/elasticsearch/es-core-concepts.html"
---

# Elasticsearch

## 为什么重要

搜索、日志检索、多维数据分析场景的标配。Elasticsearch 的核心竞争力来自倒排索引和近实时检索，这也是面试里最常被追问的原理点。但它的概念体系和 MySQL 差异很大——index 不是索引、type 已经被删、写入有 1 秒延迟——这些"反直觉"的点正是区分"会用"和"懂"的关键。

## 知识主线

核心概念 → 倒排索引原理 → 分词与映射 → 查询与打分 → 聚合 → 分片与集群读写 → 工程调优

## 怎么读这个专题

这个专题沿着"ES 凭什么搜得快、又凭什么和 MySQL 不一样"这条线写。重点不是背 DSL 语法，而是把每个机制落回原理：倒排索引为什么快、分词为什么会让人搜不到、refresh 和 flush 到底差在哪、深分页为什么会打爆协调节点。

ES 资料里最容易出问题的，是把概念罗列当成讲解——堆一堆 DSL 例子，却没说清 Query 和 Filter 的本质区别、term 和 match 为什么不能混用。后面的文章会把这些地方用具体例子走一遍。涉及 MySQL B+ 树、事务等内容时，会链接到已有的 MySQL 专题，不在本篇重复。

## 面试焦点

不是会写几条查询，而是能把倒排索引原理、分词的双重性、Query/Filter 上下文、BM25 打分、分片路由不可变、读写两阶段这些讲成"能落地、能排障"的工程判断。

## 前置知识

数据库基础、SQL 基本语法

## 目标人群

3-5 年 Java 后端工程师

## 子模块

### 1. 核心概念与原理

- Elasticsearch 的核心概念是什么，和 MySQL 怎么对应
- 倒排索引为什么让 Elasticsearch 搜索这么快

### 2. 分词与映射

- 分词器是怎么工作的，中文怎么分词
- Mapping 怎么设计，text 和 keyword 有什么区别

### 3. 查询与打分

- 查询 DSL 怎么写，match 和 term 有什么区别
- 相关性打分是怎么回事，TF-IDF 和 BM25 有什么区别

### 4. 聚合

- 聚合查询怎么用，和 SQL GROUP BY 有什么不同

### 5. 集群与分布式

- 分片和副本是怎么回事，分片数怎么定
- 写入和查询在集群里是怎么流转的

### 6. 工程实践

- 深分页怎么优化，ES 还有哪些性能调优手段

## 题目列表

### 核心概念与原理

- [Elasticsearch 的核心概念是什么，和 MySQL 怎么对应？](./es-core-concepts.html) - 讲清 index/document/node/shard 的对应关系，以及 type 在 8.x 已删除的纠偏。
- [倒排索引为什么让 Elasticsearch 搜索这么快？](./es-inverted-index.html) - 从正排痛点出发，讲透倒排索引、segment、translog 与近实时机制。

### 分词与映射

- [分词器是怎么工作的？中文怎么分词？](./es-analyzer.html) - 拆解 analyzer 三段结构、内置分词器与 IK 中文分词，讲清索引时与查询时的分词坑。
- [Mapping 怎么设计？text 和 keyword 有什么区别？](./es-mapping.html) - 讲清动态/显式映射、字段类型，以及 text 与 keyword 在分词、聚合上的本质区别。

### 查询与打分

- [查询 DSL 怎么写？match 和 term 有什么区别？](./es-query-dsl.html) - 讲清 Query/Filter 上下文、bool 复合查询，以及 match 会分词、term 不分词的坑。
- [相关性打分是怎么回事？TF-IDF 和 BM25 有什么区别？](./es-scoring.html) - 讲清 TF-IDF 的问题与 BM25 的改进，以及默认打分自 5.0 起切换的版本纠偏。

### 聚合

- [聚合查询怎么用？和 SQL GROUP BY 有什么不同？](./es-aggregation.html) - 讲清 bucket/metric/pipeline 三类聚合、嵌套用法，以及基于分片近似的边界。

### 集群与分布式

- [分片和副本是怎么回事？分片数怎么定？](./es-shard-replica.html) - 讲清主分片不可变的原因、路由公式、副本作用，以及分片数怎么估。
- [写入和查询在集群里是怎么流转的？](./es-read-write-flow.html) - 讲清写流程的 refresh/flush/同步副本，以及读流程的 query then fetch 两阶段。

### 工程实践

- [深分页怎么优化？ES 还有哪些性能调优手段？](./es-deep-pagination-tuning.html) - 对比 from+size/scroll/search_after 三种分页，并汇总写入、查询、JVM 等调优要点。
