---
title: "SDS、dict、quicklist、listpack、skiplist 分别解决什么问题？"
description: "从 Redis 对象编码讲清底层结构的取舍与版本边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "Redis"
tag:
  - "原理深入"
  - "细节题"
  - "体系化"
prev:
  text: "Redis 常见数据类型怎么选？"
  link: "/database/redis/redis-data-structures.html"
next:
  text: "ZSet 为什么用跳表？和红黑树有什么取舍？"
  link: "/database/redis/redis-zset-skiplist.html"
---

# SDS、dict、quicklist、listpack、skiplist 分别解决什么问题？

> Redis 底层结构这道题不是让你背源码名词，而是看你能不能把“业务数据类型”和“内部编码结构”分清楚。

平时我们说 Redis 有 `String`、`Hash`、`List`、`Set`、`ZSet`，这是面向使用者的数据类型。

但 Redis 内部真正保存数据时，还会根据数据规模、访问方式和内存成本选择不同编码。比如：

- `String` 可能用整数编码，也可能用 SDS。
- `List` 在现代 Redis 里主要围绕 quicklist/listpack 理解。
- `Hash` 小对象和大对象的编码不一样。
- `ZSet` 小集合和大集合也不是同一套结构。

所以答这题时，先把一句话立住：

**Redis 数据类型是用户看到的接口，底层数据结构是 Redis 为了性能和内存做的实现选择。**

## Redis 对象为什么要有 encoding

Redis 每个 key 和 value 底层都会落到对象模型里。对象里不仅记录“它是什么类型”，还记录“它现在用哪种编码保存”。

可以粗略理解为：

```text
redisObject
├── type -> String / Hash / List / Set / ZSet
├── encoding -> int / embstr / raw / listpack / quicklist / hashtable / skiplist
└── ptr -> 指向真正的数据结构
```

这样设计的好处是：同一种逻辑类型可以在不同规模下切换实现。

举个例子，Hash 里只有几个短字段时，用紧凑结构更省内存；字段很多、访问频繁时，再用哈希表换查询效率。Redis 不是一开始就把所有东西都放到最重的结构里。

线上排查时可以直接看对象编码：

```bash
OBJECT ENCODING user:profile:1001
MEMORY USAGE user:profile:1001
```

这两个命令能帮你确认“逻辑类型”和“底层编码”有没有按预期工作。比如一个本该很小的 Hash 已经膨胀成大哈希表，或者一个 ZSet 已经从紧凑编码转成 skiplist，就说明它的规模和访问成本已经不是“小对象”了。

可以把常见映射先记成这张表：

| 用户侧类型 | 常见 encoding            | 主要底层结构                |
| ---------- | ------------------------ | --------------------------- |
| String     | `int` / `embstr` / `raw` | 整数编码或 SDS              |
| Hash       | `listpack` / `hashtable` | 紧凑列表或 dict             |
| List       | `quicklist`              | quicklist 节点内嵌 listpack |
| Set        | `intset` / `hashtable`   | 整数集合或 dict             |
| ZSet       | `listpack` / `skiplist`  | 紧凑列表或 dict + skiplist  |

阈值和名称会随 Redis 版本演进，面试里不要把某个版本的具体阈值背成永久规则。更重要的规律是：**小对象优先省内存，大对象切到更适合查询和更新的结构。**

## SDS：解决 C 字符串不适合做数据库字符串的问题

Redis 用 C 写，但没有直接把普通 C 字符串当核心字符串结构，而是封装了 SDS。

SDS 主要解决三个问题：

| 问题           | C 字符串的麻烦               | SDS 的做法                         |
| -------------- | ---------------------------- | ---------------------------------- |
| 求长度慢       | `strlen` 要从头扫到 `\0`     | 记录 `len`，长度获取是 O(1)        |
| 不适合二进制   | 中间出现 `\0` 会被当成结束符 | 按长度读写，可以保存二进制内容     |
| 拼接容易溢出   | 调用方要自己保证缓冲区足够   | 记录容量，空间不够时由 SDS 扩容    |
| 频繁扩容成本高 | 每次增长都可能重新分配       | 预分配空间，减少连续追加的分配次数 |

所以 `String` 能保存 JSON、数字、token、序列化对象甚至二进制内容，背后很大一部分原因就是 SDS 比 C 字符串更适合做数据库里的 value。

不过 SDS 也不是让你把所有东西都塞进一个 String。一个 5MB 的 JSON 放在 String 里，读取、复制、AOF 追加、主从同步都会被放大。SDS 解决的是字符串表示问题，不解决业务模型过大的问题。

String 还常见三个 encoding：

- `int`：字符串内容可以表示成整数时，Redis 可以直接用整数编码。
- `embstr`：短字符串的一种紧凑分配方式，对象头和 SDS 尽量连续放在一块内存里。
- `raw`：普通 SDS 字符串，适合更长或被修改后的字符串。

`embstr` 更像短字符串优化，不适合反复原地修改；一旦发生修改，可能转成 `raw`。所以看到 `OBJECT ENCODING` 变化，不一定是异常，也可能只是对象从小而稳定变成了更通用的形态。

## dict：Redis 整个 key 空间的底座

Redis 是 key-value 数据库，所有 key 最终要能被快速定位。

这个“快速定位”的核心就是 dict，也就是哈希表。

dict 至少承担两类工作：

1. 保存整个数据库的 key 到 value 的映射。
2. 支撑大规模 Hash、Set、ZSet 里的 member 查找。

dict 的典型特点是平均 O(1) 查找，但它也要处理哈希冲突和扩容问题。

Redis 的 rehash 不是一次性把旧表全搬完，而是渐进式搬迁。原因很简单：如果一个大字典一次性 rehash，主线程会被明显阻塞。渐进式 rehash 把成本摊到后续操作里，更符合 Redis 单线程事件循环的工作方式。

## quicklist：List 为什么不再只讲双向链表

很多旧资料会说 List 底层是双向链表或压缩列表。这个说法要带版本边界。

现代 Redis 里，List 更应该围绕 quicklist 理解。

quicklist 可以看成：

```text
quicklist
├── 节点 1 -> listpack
├── 节点 2 -> listpack
└── 节点 3 -> listpack
```

它不是单纯链表，也不是一个巨大连续数组，而是把多个紧凑列表节点串起来。

这样做是在平衡两件事：

- 链表适合头尾插入、拆分和连接，但指针多、内存碎片多。
- 连续紧凑结构省内存、缓存友好，但太大时移动成本高。

quicklist 把它们折中：节点之间像链表，节点内部尽量紧凑。

## listpack：替代 ziplist 的紧凑结构

ziplist 曾经是 Redis 很重要的紧凑结构，但它有一个典型问题：级联更新。

如果一个元素长度变化，可能影响后面元素记录前驱长度的字段，进而一层层改下去。数据规模不大时问题不明显，一旦触发，最坏情况下会带来额外移动成本。

listpack 的目标就是保留紧凑存储的优势，同时减少 ziplist 那类级联更新风险。

所以在 Redis 7.0 之后写文章，不能再把 ziplist 当成现代 Redis 的主线结构。更稳妥的表达是：

**ziplist 是历史上常见的紧凑编码，现代 Redis 已经更多转向 listpack。**

这个版本边界在面试和排障里都很重要：如果你维护的是 Redis 5/6，仍然可能在配置、命令输出或资料里看到 ziplist；如果是 Redis 7 之后，更应该用 listpack 来解释小 Hash、小 ZSet 和 quicklist 节点内部的紧凑存储。

## skiplist：为排序、范围和排名服务

skiplist 最常见的出场位置是 ZSet。

ZSet 不只是“集合 + 分数”，它要同时支持：

- 按 member 快速查 score
- 按 score 范围查数据
- 按排名取数据
- score 相同再按 member 做稳定排序

单靠哈希表只能解决第一类问题，解决不了有序范围查询。

所以大规模 ZSet 通常会组合使用：

```text
ZSet
├── dict -> member 快速定位 score
└── skiplist -> 按 score/member 维护有序关系
```

这也是为什么说“ZSet 底层是跳表”不够准确。更准确是：**ZSet 在大对象场景下用 dict + skiplist 共同完成查找和排序。**

## intset：小整数集合的省内存选择

Set 如果里面都是整数，并且数量较少，可以用 intset。

intset 的优势是紧凑，适合小规模整数集合；缺点是查找、插入不如哈希表那样适合大规模随机操作。

当集合元素变多，或者出现不能用整数表示的成员时，就会转向哈希表编码。

这也是 Redis 编码策略的一贯思路：**小而规整时省内存，大而复杂时换效率。**

还有一个容易忽略的点：编码升级通常不会自动降级。一个 Set 从 intset 升到 hashtable 后，即使后来删除到只剩少量整数，也不一定自动回到 intset。线上看内存时不要只看当前元素数量，还要考虑这个 key 曾经是否膨胀过。

## 一张表串起来

| 结构      | 主要解决的问题                 | 常见承载场景                     |
| --------- | ------------------------------ | -------------------------------- |
| SDS       | 安全、高效、二进制友好的字符串 | String、key、协议缓冲等          |
| dict      | O(1) 级别快速定位              | key 空间、Hash、Set、ZSet member |
| quicklist | List 的头尾操作与内存紧凑平衡  | List                             |
| listpack  | 小对象紧凑存储，降低元数据成本 | 小 Hash、小 ZSet、quicklist 节点 |
| skiplist  | 有序范围查询和排名             | 大 ZSet                          |
| intset    | 小整数集合省内存               | 小 Set                           |

## 这些结构怎么影响业务选型？

底层结构不是为了炫源码，而是会直接影响你怎么建模：

| 业务需求                     | 更稳的 Redis 结构 | 背后的结构取舍                         |
| ---------------------------- | ----------------- | -------------------------------------- |
| 用户资料字段少、字段局部更新 | Hash              | 小对象可紧凑编码，字段多后转 dict      |
| 时间线只做头尾追加和分页     | List/Stream       | List 适合简单队列，Stream 更适合消费组 |
| 排行榜和 TopN                | ZSet              | dict 查成员，skiplist 做范围和排名     |
| 签到、开关位、用户状态布尔值 | Bitmap/String     | 本质是紧凑二进制字符串                 |
| 大对象缓存                   | 拆分多个 key      | 避免单个 SDS、Hash、ZSet 过大          |

所以回答这题时，最后要落到业务：结构选择不是只看命令是否能实现，还要看对象会不会长大、是否要范围查询、是否要局部更新、是否会带来 big key。

## 容易踩的坑

### “Redis 数据结构就是 String、List、Hash、Set、ZSet”

这句话只说了一半。它们是用户侧数据类型，不是内部结构。

### “List 底层就是双向链表”

这是旧口径，现代 Redis 要重点讲 quicklist/listpack。

### “ZSet 底层就是跳表”

不完整。大对象 ZSet 既要 dict 查 member，也要 skiplist 做排序和范围。

### “listpack 和 ziplist 是同一个东西”

不对。它们都偏紧凑存储，但 listpack 是后来替代 ziplist 的结构，重点就是改善 ziplist 的一些结构性问题。

## 小结

- Redis 数据类型是用户看到的接口，encoding 才是具体落地结构。
- SDS 解决字符串长度、二进制安全和扩容安全问题。
- dict 是 Redis 快速查找的基础，既支撑 key 空间，也支撑多种集合类型。
- quicklist/listpack 是现代 Redis 理解 List 和小对象编码的重点。
- ZSet 大对象不能只说跳表，更准确是 dict + skiplist 协作。
- 底层结构最终要服务业务建模，过大的 String、Hash、List、ZSet 都会把持久化、复制和删除成本放大。

## 参考

基于 Redis 官方文档中 Data types、Persistence、Replication、Sentinel、Cluster、Programmability、Administration 与 Observability 等相关章节整理。
