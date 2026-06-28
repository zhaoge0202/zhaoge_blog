---
title: "MongoDB"
description: "围绕文档模型、索引、聚合管道、副本集和分片的文档数据库专题。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "深分页怎么优化？ES 还有哪些性能调优手段？"
  link: "/database/elasticsearch/es-deep-pagination-tuning.html"
next:
  text: "MongoDB 文档模型怎么设计？和 MySQL 怎么选？"
  link: "/database/mongodb/mongodb-data-model.html"
---

# MongoDB

## 为什么重要

MongoDB 是后端面试里最常见的文档型数据库。它不像 MySQL 那样围绕表、行、事务和 join 建模，而是围绕文档、访问模式和水平扩展做取舍。面试里真正有区分度的，不是会不会说“BSON、无模式、分片”，而是能不能讲清什么时候该嵌入、索引为什么没走、聚合管道怎么控制成本、副本集和分片分别解决什么问题。

## 知识主线

文档模型 -> 索引 -> 聚合 -> 副本集与分片

## 怎么读这个专题

这个专题沿着“MongoDB 为什么不是无约束的 MySQL”这条线写。先从文档模型讲起，明确嵌入和引用的边界；再讲索引和查询优化，避免把“建索引”答成口号；然后讲聚合管道，说明它和 SQL GROUP BY 的差别；最后收束到副本集、读写关注、分片键和分片策略。

MongoDB 资料里容易有两类问题：一类是把“无模式”讲成“不用设计”；另一类是把“支持事务、支持分片”讲成银弹。后面的文章会把这些边界单独点出来。

## 面试焦点

不是会背 MongoDB 名词，而是能把文档建模、索引顺序、TTL 延迟、聚合阶段顺序、Secondary 旧读、分片键选择这些问题讲成工程判断。

## 前置知识

数据库基础、索引基础、分布式系统基础

## 目标人群

3-5 年 Java 后端工程师

## 子模块

### 1. 文档模型与选型

- MongoDB 文档模型怎么设计，和 MySQL 怎么选

### 2. 索引与查询优化

- MongoDB 索引怎么设计，查询为什么没走索引

### 3. 聚合管道

- MongoDB 聚合管道怎么用，和 SQL GROUP BY 有什么不同

### 4. 高可用与扩展

- MongoDB 副本集和分片集群怎么理解

## 题目列表

### 文档模型与选型

- [MongoDB 文档模型怎么设计？和 MySQL 怎么选？](./mongodb-data-model.html) - 从文档、集合、BSON 和嵌入式建模讲清 MongoDB 的适用边界。

### 索引与查询优化

- [MongoDB 索引怎么设计？查询为什么没走索引？](./mongodb-index-query.html) - 讲清单字段、复合、多键、TTL、覆盖查询和 `explain()` 排障思路。

### 聚合管道

- [MongoDB 聚合管道怎么用？和 SQL GROUP BY 有什么不同？](./mongodb-aggregation-pipeline.html) - 用订单统计例子讲清 `$match`、`$unwind`、`$group`、`$lookup` 的顺序和边界。

### 高可用与扩展

- [MongoDB 副本集和分片集群怎么理解？](./mongodb-replica-sharding.html) - 从 oplog、读写关注、Secondary 旧读、分片键和分片策略讲清集群能力。
