---
title: "HashSet 为什么能去重？和 HashMap 是什么关系？"
description: "从 HashMap key、equals/hashCode 契约讲清 HashSet 去重原理。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "必会"
  - "高频"
  - "细节题"
prev:
  {
    text: "LinkedHashMap 为什么适合做 LRU？",
    link: "/java/collection/java-collection-linkedhashmap-lru.html",
  }
next:
  {
    text: "CopyOnWriteArrayList 适合什么读多写少场景？",
    link: "/java/collection/java-collection-copyonwritearraylist.html",
  }
---

# HashSet 为什么能去重？和 HashMap 是什么关系？

> `HashSet` 的去重能力来自底层 `HashMap`：元素作为 key，统一占位对象作为 value。

## HashSet 底层到底是什么？

`HashSet` 不是自己重新实现了一套哈希表，它内部持有一个 `HashMap`。

可以简化理解成：

```java
class HashSet<E> {
    private transient HashMap<E, Object> map;
    private static final Object PRESENT = new Object();
}
```

当你调用：

```java
set.add(user);
```

底层做的事情类似：

```java
map.put(user, PRESENT);
```

也就是说：

- `HashSet` 的元素是 `HashMap` 的 key。
- value 是同一个占位对象，没有业务意义。
- 能不能加进去，取决于这个 key 在 `HashMap` 里是否已经存在。

## add 怎么判断重复？

`HashSet.add(e)` 的返回值很有意思：

```java
public boolean add(E e) {
    return map.put(e, PRESENT) == null;
}
```

如果 `put` 返回 `null`，说明之前没有这个 key，添加成功。

如果 `put` 返回旧值，说明 key 已经存在，`HashSet` 不会新增元素，`add` 返回 `false`。

所以 `HashSet` 去重依赖两步：

1. 先用 `hashCode` 定位桶。
2. 冲突后再用 `equals` 判断是否逻辑相等。

## 自定义对象为什么要同时重写 equals 和 hashCode？

假设要按 `userId` 去重：

```java
class User {
    private Long userId;
    private String name;
}
```

如果只重写 `equals`，不重写 `hashCode`，两个 `userId` 相同的对象可能落到不同桶里。它们甚至没有机会互相比较 `equals`，去重就会失败。

正确思路是让“相等对象必须有相同 hashCode”：

```java
class User {
    private Long userId;
    private String name;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof User other)) return false;
        return Objects.equals(userId, other.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId);
    }
}
```

契约可以这样记：

| 关系                  | 要求                                    |
| --------------------- | --------------------------------------- |
| `a.equals(b) == true` | `a.hashCode() == b.hashCode()` 必须成立 |
| hashCode 相同         | `equals` 不一定为 true，可能只是冲突    |
| `equals` 用了哪些字段 | `hashCode` 通常也要使用同一组字段       |

## HashSet、LinkedHashSet、TreeSet 怎么选？

三个 Set 都能去重，但顺序语义不同：

| 容器            | 底层思路        | 顺序特点       | 典型场景                   |
| --------------- | --------------- | -------------- | -------------------------- |
| `HashSet`       | `HashMap`       | 不承诺顺序     | 普通去重、快速判断是否存在 |
| `LinkedHashSet` | `LinkedHashMap` | 保留插入顺序   | 去重后保持首次出现顺序     |
| `TreeSet`       | 红黑树          | 按比较规则排序 | 有序输出、范围查询         |

例如“按用户浏览顺序去重”更适合 `LinkedHashSet`：

```java
Set<Long> userIds = new LinkedHashSet<>();
userIds.add(10L);
userIds.add(20L);
userIds.add(10L);
// 遍历结果仍是 10, 20
```

如果只是判断某个商品 ID 是否已经处理过，`HashSet` 就够了。

## 为什么不要用 List.contains 循环去重？

一个常见低效写法：

```java
List<Long> result = new ArrayList<>();
for (Long id : ids) {
    if (!result.contains(id)) {
        result.add(id);
    }
}
```

`ArrayList.contains` 需要线性扫描，N 个元素整体可能变成 O(n²)。

用 `HashSet` 则接近 O(n)：

```java
Set<Long> seen = new HashSet<>();
List<Long> result = new ArrayList<>();
for (Long id : ids) {
    if (seen.add(id)) {
        result.add(id);
    }
}
```

如果还要保持原顺序，也可以直接用 `LinkedHashSet`。

## 容易踩的坑

1. “HashSet 无序”不是“每次随机”，而是不承诺业务可依赖的遍历顺序。
2. 可变对象放进 `HashSet` 后，不要修改参与 `equals/hashCode` 的字段，否则可能再也找不到它。
3. `HashSet` 允许一个 `null` 元素，因为底层 `HashMap` 允许一个 `null` key。
4. `TreeSet` 去重依赖比较规则，不是只看 `equals`。

## 小结

- `HashSet` 底层用 `HashMap`，元素作为 key，value 是统一占位对象。
- 去重先靠 `hashCode` 定位，再靠 `equals` 判断逻辑相等。
- 自定义对象要同时维护 `equals/hashCode` 契约。
- 普通去重用 `HashSet`，保序去重用 `LinkedHashSet`，排序去重用 `TreeSet`。
- 不要用 `ArrayList.contains` 循环做大集合去重。

## 参考

基于 Oracle Java SE API Documentation 与 OpenJDK Java Collections Framework 源码中 List、Map、Set、Queue、Concurrent Collections 等相关内容整理。
