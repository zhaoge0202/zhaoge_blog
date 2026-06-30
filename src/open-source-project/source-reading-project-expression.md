---
title: "面试里怎么把源码阅读讲成项目能力？"
description: "从问题驱动、源码证据和项目改进讲清源码阅读表达方法。"
breadcrumb: true
article: true
editLink: false
category:
  - "开源项目"
tag:
  - "项目实战"
  - "体系化"
  - "进阶"
prev:
  text: "读 Netty 源码应该先理解 Reactor 还是 ByteBuf？"
  link: "/open-source-project/source-reading-netty-entry.html"
next:
  text: "技术书籍"
  link: "/books/"
---

# 面试里怎么把源码阅读讲成项目能力？

> 源码阅读不能只说“我看过某框架源码”，要讲清你为了解决什么问题、看到了什么证据、最后怎么影响项目决策。

## 一个好表达长什么样？

可以按四段讲：

1. 项目遇到的问题。
2. 为什么文档和经验不足以判断。
3. 读源码确认了哪条关键路径。
4. 最后怎么改了配置、代码或排障方法。

例如：线程池拒绝策略不是只背概念，而是结合 `ThreadPoolExecutor#execute` 的执行顺序解释为什么队列满后才扩容到最大线程数。

## 避免什么？

- 不要说“通读过源码”，范围太大也不可信。
- 不要背类名清单。
- 不要只讲源码细节，不讲项目收益。
- 不要把资料结论当成自己验证过的源码行为。

## 小结

1. 源码阅读要问题驱动，不要为了读而读。
2. 表达时要有项目问题、源码证据和落地改进。
3. 只讲类名和流程图不够，要讲取舍和边界。
4. 最有价值的是把源码行为转成排障、调优或设计能力。

## 参考

基于 Spring Framework、Spring Boot、MyBatis、Netty 官方文档与公开源码中启动流程、生命周期、执行链路、Reactor 和 ByteBuf 等相关内容整理。
