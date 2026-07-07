---
title: "WeakHashMap、EnumMap、IdentityHashMap 分别适合什么场景？"
description: "从弱引用、枚举键和引用相等讲清特殊 Map 的真实边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "细节题"
  - "进阶"
  - "项目实战"
prev:
  {
    text: "TreeMap 和 TreeSet 为什么能有序？红黑树在这里怎么用？",
    link: "/java/collection/java-collection-treemap-treeset.html",
  }
next:
  {
    text: "HashSet 为什么能去重？和 HashMap 是什么关系？",
    link: "/java/collection/java-collection-hashset.html",
  }
---

# WeakHashMap、EnumMap、IdentityHashMap 分别适合什么场景？

> 这三个 Map 不是 `HashMap` 的升级版，而是分别改变了 key 的生命周期、取值空间和相等语义。

## 先别按“谁更快”来选

普通 `HashMap` 依赖 `hashCode()` 和 `equals()` 判断 key 是否相同。特殊 Map 的关键不是“更快”，而是语义变了：

| 容器              | key 语义                          | 典型场景                   |
| ----------------- | --------------------------------- | -------------------------- |
| `HashMap`         | `hashCode + equals`               | 通用键值查找               |
| `LinkedHashMap`   | `hashCode + equals`，额外维护顺序 | 访问顺序、LRU              |
| `WeakHashMap`     | key 是弱引用                      | key 不应阻止对象回收       |
| `EnumMap`         | key 必须是同一种 enum             | 枚举到配置、策略、状态     |
| `IdentityHashMap` | key 用 `==` 比较                  | 对象图、循环引用、实例身份 |

所以面试回答不要背成性能对比。先说“它改变了什么语义”，再说场景。

## WeakHashMap：key 不应阻止对象回收

`WeakHashMap` 的 key 使用弱引用。一个 key 如果不再被普通强引用持有，只剩 `WeakHashMap` 里的弱引用，那么 GC 后这条映射可能被清掉。

典型场景是给外部对象挂临时元数据：

```java
Map<Object, Metadata> metadata = new WeakHashMap<>();

Object target = new Object();
metadata.put(target, new Metadata());

target = null;
// 之后 GC 可能清掉这条映射
```

适合场景：

- 框架里给对象实例绑定附属信息。
- 不想因为 Map 的 key 强引用导致对象无法释放。
- 临时元数据、辅助索引，丢了可以重建。

但它不是可靠缓存。GC 什么时候发生、什么时候清掉弱引用，都不应该作为业务正确性的前提。可靠缓存应考虑 Caffeine、Redis 等更明确的淘汰策略。

还有一个细节：value 是强引用。如果 value 反向强引用 key，就可能破坏自动清理预期：

```java
metadata.put(target, new Metadata(target)); // value 又强引用了 key
```

这种结构下，key 仍然可能通过 value 链路可达。

## EnumMap：key 空间固定且来自 enum

`EnumMap` 要求 key 必须来自同一个枚举类型。它利用 enum 常量集合固定的特点，内部可以按枚举顺序紧凑存储，遍历顺序也是枚举声明顺序。

```java
enum OrderStatus {
    CREATED, PAID, SHIPPED, CLOSED
}

Map<OrderStatus, String> text = new EnumMap<>(OrderStatus.class);
text.put(OrderStatus.CREATED, "待支付");
text.put(OrderStatus.PAID, "已支付");
```

适合场景：

- 订单状态到文案、配置、处理器的映射。
- 支付渠道到费率或路由策略的映射。
- 审核动作到下一步状态的映射。
- 每个枚举值一份统计计数。

比如一个简单状态机：

```java
EnumMap<OrderStatus, Set<OrderStatus>> transitions = new EnumMap<>(OrderStatus.class);
transitions.put(OrderStatus.CREATED, EnumSet.of(OrderStatus.PAID, OrderStatus.CLOSED));
transitions.put(OrderStatus.PAID, EnumSet.of(OrderStatus.SHIPPED));
```

边界也很清楚：

- key 不能是非 enum。
- key 必须来自同一个 enum 类型。
- 不允许 `null` key，但允许 `null` value。
- 如果你调整枚举声明顺序，遍历输出顺序也会变化。

关于枚举本身的建模价值，可以和 [枚举 enum 为什么比常量类更适合表达固定集合](/java/basis/java-basis-enum.html) 连起来看。

## IdentityHashMap：key 用对象身份判断

`IdentityHashMap` 判断 key 是否相同，用的是 `==`，不是 `equals()`。

```java
Map<String, String> map = new IdentityHashMap<>();

String a = new String("id");
String b = new String("id");

map.put(a, "A");
map.put(b, "B");

// size 是 2，因为 a != b
```

这不是“更快的 HashMap”，而是完全不同的相等语义。

适合场景：

- 深拷贝对象图：记录“原对象实例 -> 拷贝对象实例”。
- 序列化和图遍历：判断某个对象实例是否已经访问过，避免循环引用。
- 为每个对象实例维护代理、调试句柄、临时状态。

示例：

```java
Map<Object, Object> copied = new IdentityHashMap<>();

Object copy(Object source) {
    if (copied.containsKey(source)) {
        return copied.get(source);
    }
    Object target = createCopy(source);
    copied.put(source, target);
    copyFields(source, target);
    return target;
}
```

这里必须按对象身份判断。如果两个不同对象 `equals()` 相等，普通 `HashMap` 会把它们当成同一个 key，深拷贝就可能错。

## 放在一起怎么选

| 需求                              | 推荐              |
| --------------------------------- | ----------------- |
| 普通 key-value 查找               | `HashMap`         |
| 需要插入顺序或访问顺序            | `LinkedHashMap`   |
| key 是 enum，且要按 enum 维度映射 | `EnumMap`         |
| key 不应该阻止对象被回收          | `WeakHashMap`     |
| 必须区分对象实例身份              | `IdentityHashMap` |
| 需要排序或范围查询                | `TreeMap`         |

几个例子：

- 订单状态文案：`EnumMap<OrderStatus, String>`。
- 本地 LRU：`LinkedHashMap` 或 Caffeine。
- 给对象挂临时元数据：`WeakHashMap<Object, Metadata>`。
- 深拷贝时记录已复制对象：`IdentityHashMap<Object, Object>`。
- 价格区间查询：`TreeMap<Integer, Product>`。

## 容易踩的坑

- `WeakHashMap` 不等于缓存神器，GC 清理时机不可控。
- `WeakHashMap` 的 value 如果反向强引用 key，可能导致 key 不容易释放。
- `EnumMap` 只接受 enum key，不能拿来替代普通 `HashMap`。
- `EnumMap` 遍历顺序跟枚举声明顺序相关。
- `IdentityHashMap` 不是性能优化版 `HashMap`，它改变的是相等语义。
- 这三个 Map 默认都不是线程安全容器。
- 业务代码里如果没有明确特殊语义，优先用普通 `HashMap`。

## 小结

1. `WeakHashMap` 解决的是 key 生命周期问题：key 不应阻止对象回收。
2. `EnumMap` 解决的是 enum key 空间固定问题，适合状态、类型、策略映射。
3. `IdentityHashMap` 解决的是对象身份问题，用 `==` 而不是 `equals()` 判断 key。
4. 三者都不是 `HashMap` 的通用升级版，使用前先确认语义是否匹配。
5. 可靠缓存、有序范围查询、线程安全 Map 都不是它们的主要职责。

## 参考

综合自本地资料《Java 集合常见面试题总结》和本专题 HashMap、LinkedHashMap、枚举文章，并结合 Java SE API 对 `WeakHashMap`、`EnumMap`、`IdentityHashMap` 的 key 语义做了边界校准。
