---
home: true
title: "拾级"
description: "拾级 —— 面向 3-5 年 Java 后端工程师的进阶知识库，按知识域讲透高频题、原理与项目取舍，并保留独立博客记录实战与复盘。"
heroText: "拾级"
tagline: "拾级而上，把 Java 后端每个高频点从原理讲到能落地。"
actions:
  - text: "开始复习"
    link: "/interview-preparation/"
    type: "primary"
  - text: "进入博客"
    link: "/blog/"
    type: "default"
---

<div class="home-domain-row">
  <a href="/interview-preparation/">面试准备</a>
  <a href="/java/">Java</a>
  <a href="/database/">数据库</a>
  <a href="/cs-basics/">计算机基础</a>
  <a href="/system-design/">系统设计</a>
  <a href="/tools/">工具实践</a>
  <a href="/blog/">博客</a>
</div>

> 不照搬资料：每个结论都交叉验证过，过时和讲错的地方在正文里直接点出来。

## 精选题目

<div class="question-radar">
  <a href="./java/concurrent/java-concurrency-thread-pool.html">
    <span>并发</span>
    <strong>线程池 7 个参数怎么理解？</strong>
    <em>参数、队列、拒绝策略、项目调优</em>
  </a>
  <a href="./java/jvm/jvm-g1-vs-cms.html">
    <span>JVM</span>
    <strong>G1 相比 CMS 改进了什么？</strong>
    <em>分区、停顿预测、并发标记、适用场景</em>
  </a>
  <a href="./database/mysql/mysql-mvcc-read-view.html">
    <span>MySQL</span>
    <strong>MVCC 和 ReadView 是怎么工作的？</strong>
    <em>事务隔离、版本链、可见性判断</em>
  </a>
  <a href="./database/redis/redis-cache-consistency.html">
    <span>Redis</span>
    <strong>如何保证缓存和数据库一致性？</strong>
    <em>延迟双删、旁路缓存、最终一致性</em>
  </a>
</div>

## 最近博客

- [从资料汇总转向内容纠偏](./blog/essays/2026-06-16-note-1.html)：这个站点的价值不是简单聚合资料，而是筛选、纠错、解释取舍并沉淀自己的判断。
- [把本地 Markdown 媒体同步接到 R2 的一次实战](./blog/practice/2026-06-18-r2-media-sync-tutorial.html)：工具链要真的能跑通，卡住你的往往不是脚本，而是凭据链路。
