---
title: "TreeMap 和 TreeSet 为什么能有序？红黑树在这里怎么用？"
description: "从比较器、红黑树和范围查询讲清有序集合的使用边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "进阶"
  - "原理深入"
  - "细节题"
prev:
  {
    text: "LinkedHashMap 为什么适合做 LRU？",
    link: "/java/collection/java-collection-linkedhashmap-lru.html",
  }
next:
  {
    text: "WeakHashMap、EnumMap、IdentityHashMap 分别适合什么场景？",
    link: "/java/collection/java-collection-special-maps.html",
  }
---

# TreeMap 和 TreeSet 为什么能有序？红黑树在这里怎么用？

> `TreeMap` 的有序来自按 key 构建的红黑树；`TreeSet` 复用 `TreeMap` 的 key，所以元素也按同一套比较规则有序。

## TreeMap 的有序是什么意思

`TreeMap` 的“有序”不是插入顺序，而是按 key 的比较结果排序。value 不参与排序。

```java
Map<Integer, String> map = new TreeMap<>();
map.put(3, "C");
map.put(1, "A");
map.put(2, "B");

// 遍历顺序：1=A, 2=B, 3=C
```

如果你要保持插入顺序或访问顺序，看 [LinkedHashMap](/java/collection/java-collection-linkedhashmap-lru.html)；如果只是普通 key-value 快速查找，通常用 [HashMap](/java/collection/java-collection-hashmap-structure.html)。`TreeMap` 的优势是排序、邻近查找和范围查询。

## TreeMap 怎么用红黑树维护顺序

可以先把 `TreeMap` 想成一棵按 key 比较结果组织的二叉搜索树：

- 新 key 小于当前节点 key，往左子树走。
- 新 key 大于当前节点 key，往右子树走。
- 比较结果等于 0，认为是同一个 key，覆盖旧 value。

插入 `2, 1, 3` 后，形态可以简化理解成：

```text
      2
     / \
    1   3

中序遍历：1 -> 2 -> 3
```

普通二叉搜索树遇到有序插入时可能退化成链表，查询从 `O(log n)` 退化到 `O(n)`。红黑树的作用就是通过颜色规则、旋转、变色保持近似平衡，让查找、插入、删除都稳定在 `O(log n)`。

面试里问 `TreeMap`，通常不是让你手写红黑树删除修复，而是看你能不能说清三件事：比较规则决定节点位置，红黑树限制树高，范围查询依赖有序结构。

## TreeSet 为什么也有序

`TreeSet` 底层依赖 `TreeMap`。元素放在 `TreeMap` 的 key 上，value 是一个占位对象：

```java
Set<Integer> set = new TreeSet<>();
set.add(3);
set.add(1);
set.add(2);

// 遍历顺序：1, 2, 3
```

所以 `TreeSet` 的排序和去重逻辑，跟 `TreeMap` 的 key 比较逻辑一致。它没有自己再造一套树结构。

这也解释了为什么 `TreeSet` 不是靠 `equals()` 去重，而是靠 `compareTo()` 或 `Comparator` 的比较结果去重。

## 自然排序和 Comparator 怎么选

如果不传 `Comparator`，key 或元素必须实现 `Comparable`，也就是自然排序：

```java
TreeSet<Integer> numbers = new TreeSet<>();
```

如果业务排序规则不是类型自身的自然顺序，就传 `Comparator`：

```java
TreeSet<User> users = new TreeSet<>(
    Comparator.comparingInt(User::age)
        .thenComparingLong(User::id)
);
```

比较器有两个细节：

- 不要用 `return a - b`，整数可能溢出，优先用 `Integer.compare(a, b)`。
- 非唯一字段排序要补 tie-breaker。只按年龄排序，两个同龄用户会被当成同一个元素。

## compareTo 和 equals 不一致会怎样

`HashMap`、`HashSet` 主要看 `hashCode + equals`。`TreeMap`、`TreeSet` 主要看比较结果是否为 0。

```java
record User(long id, int age) {}

Set<User> set = new TreeSet<>(Comparator.comparingInt(User::age));
set.add(new User(1, 18));
set.add(new User(2, 18));

// size 是 1，因为两个对象按 age 比较结果为 0
```

这两个 `User` 明明不是同一个业务对象，却被 `TreeSet` 当成重复元素。

`BigDecimal` 也有经典例子：

```java
new BigDecimal("1.0").compareTo(new BigDecimal("1.00")) == 0; // true
new BigDecimal("1.0").equals(new BigDecimal("1.00"));         // false
```

所以排序集合里，最好让比较规则和业务“相等”语义一致。否则会出现“放进去一个，另一个被覆盖或去重”的问题。

## 范围查询为什么是强项

`TreeMap` 实现了 `SortedMap` 和 `NavigableMap`，所以能做邻近和范围操作：

- `firstKey()`、`lastKey()`
- `lowerKey()`、`floorKey()`、`ceilingKey()`、`higherKey()`
- `subMap()`、`headMap()`、`tailMap()`
- `descendingMap()`

示例：

```java
NavigableMap<Integer, String> prices = new TreeMap<>();
prices.put(99, "A");
prices.put(199, "B");
prices.put(299, "C");

prices.subMap(100, true, 300, false);
// 包含 199，不包含 99 和 299
```

`TreeSet` 也有对应能力：`first()`、`last()`、`lower()`、`floor()`、`ceiling()`、`higher()`、`subSet()`、`headSet()`、`tailSet()`。

注意：很多范围方法返回的是视图，不是完整复制。修改视图可能影响原集合，往视图里放越界 key 也会出问题。

## 和 HashMap、LinkedHashMap、HashSet 怎么选

| 容器            | 底层思路          | 顺序语义           | 复杂度      | 适合场景                 |
| --------------- | ----------------- | ------------------ | ----------- | ------------------------ |
| `HashMap`       | 哈希表            | 不承诺顺序         | 平均 `O(1)` | 普通 key-value 查找      |
| `LinkedHashMap` | 哈希表 + 双向链表 | 插入顺序或访问顺序 | 平均 `O(1)` | 保序遍历、LRU            |
| `TreeMap`       | 红黑树            | key 排序           | `O(log n)`  | 排序、范围查询、邻近查询 |
| `HashSet`       | `HashMap` key     | 不承诺顺序         | 平均 `O(1)` | 普通去重                 |
| `TreeSet`       | `TreeMap` key     | 元素排序           | `O(log n)`  | 排序去重、范围查询       |

`HashMap` 在 JDK 8 之后冲突桶也可能树化成红黑树，但那只是单个桶的极端哈希冲突优化，不代表整个 `HashMap` 有序。`TreeMap` 的红黑树是整体按 key 排序。

## 容易踩的坑

- `TreeMap` 有序不是插入顺序，插入顺序看 `LinkedHashMap`。
- `TreeMap` 排的是 key，不是 value。
- `TreeSet` 去重看比较结果，不直接看 `equals()`。
- 比较器不能只写非唯一字段，否则不同对象可能被覆盖或去重。
- 范围查询返回的常是视图，不是独立副本。
- 参与排序的字段放入集合后不要再改，否则树中位置和比较结果会不一致。
- `TreeMap`、`TreeSet` 不是线程安全集合，并发有序结构可看 `ConcurrentSkipListMap`。
- 自然排序下不要随便放 `null`，因为比较时会出问题；自定义比较器是否支持 `null` 要自己保证。

## 小结

1. `TreeMap` 的有序来自 key 比较规则，value 不参与排序。
2. 红黑树负责维持近似平衡，让查找、插入、删除保持 `O(log n)`。
3. `TreeSet` 底层复用 `TreeMap`，元素就是 key。
4. `compareTo/Comparator` 返回 0 就会被认为是同一个 key 或元素。
5. 范围查询和邻近查询是 `TreeMap/TreeSet` 相比哈希容器的核心优势。

## 参考

综合自本地资料《Java 集合常见面试题总结》、红黑树资料和本专题 HashMap、LinkedHashMap、HashSet 文章，并对照 JDK 集合类结构校准了 `TreeMap`、`TreeSet` 的排序与去重语义。
