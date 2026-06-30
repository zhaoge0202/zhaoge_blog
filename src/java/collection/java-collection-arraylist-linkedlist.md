---
title: "ArrayList 和 LinkedList 到底怎么选？"
description: "从底层结构、扩容、局部性和操作成本讲清 List 选型边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "集合"
tag:
  - "必会"
  - "高频"
  - "细节题"
prev: { text: "集合", link: "/java/collection/" }
next:
  {
    text: "HashMap 的底层结构和扩容流程是什么？",
    link: "/java/collection/java-collection-hashmap-structure.html",
  }
---

# ArrayList 和 LinkedList 到底怎么选？

> 大多数业务列表优先选 `ArrayList`；`LinkedList` 只有在非常明确的头尾操作、双端队列语义下才值得考虑。

## 先把结论放在前面

面试里经常有人背一句：“`ArrayList` 查询快，`LinkedList` 增删快”。这句话只说对了一半，甚至在工程里很容易误导选型。

更接近真实项目的判断是：

| 场景                       | 更常见选择              | 原因                                 |
| -------------------------- | ----------------------- | ------------------------------------ |
| 接口返回列表、分页结果     | `ArrayList`             | 遍历和下标读取多，数组局部性好       |
| 批量查询后顺序处理         | `ArrayList`             | 连续数组遍历成本低                   |
| 尾部追加                   | `ArrayList`             | 均摊 O(1)，偶尔扩容                  |
| 头尾都要入队出队           | `ArrayDeque`            | 双端队列语义更直接，通常比链表更高效 |
| 必须允许 `null` 的双端队列 | 可谨慎考虑 `LinkedList` | `ArrayDeque` 不允许 `null`           |
| 多线程读写                 | 另选并发容器或外部同步  | 二者本身都不是线程安全的             |

所以，`LinkedList` 不是“增删场景的默认答案”。如果你没有明确证明自己只做头尾操作，默认选 `ArrayList` 往往更稳。

## ArrayList 为什么适合普通业务列表？

`ArrayList` 底层是一段 `Object[]` 数组。数组带来两个直接好处：

1. 通过下标定位元素是 O(1)。
2. 元素在内存上更连续，CPU 缓存命中通常更友好。

假设接口查出 1000 条订单后要逐条组装响应：

```java
List<OrderDTO> result = new ArrayList<>(orders.size());
for (Order order : orders) {
    result.add(convert(order));
}
```

这类场景有两个特点：顺序遍历多、尾部追加多。`ArrayList` 正好适合。

尾部追加在容量足够时只是把元素放到 `elementData[size]`，然后 `size++`。只有容量不够时才会扩容，所以从均摊复杂度看仍然可以当成 O(1)。

## ArrayList 扩容到底发生了什么？

`new ArrayList<>()` 并不会立刻分配长度为 10 的数组。以 JDK 8 之后的实现看，无参构造先指向一个空数组，第一次 `add` 时才扩到默认容量 10。

后续容量不够时，扩容大致是：

```text
oldCapacity = 10
newCapacity = oldCapacity + oldCapacity / 2 = 15
```

也就是约 1.5 倍扩容。扩容不是在原数组上“拉长”，而是申请一块新数组，再把旧元素复制过去：

```text
[A, B, C, ...]  old array
      │
      └── Arrays.copyOf(...)
              ↓
[A, B, C, ..., empty] new array
```

这意味着两个工程边界：

1. 如果能预估数量，优先 `new ArrayList<>(expectedSize)`，减少扩容和复制。
2. `add(index, element)`、`remove(index)` 需要搬移后续元素，位置越靠前，移动成本越高。

例如在下标 1 插入元素：

```text
插入前： [1, 2, 3, 4]
插入后： [1, 9, 2, 3, 4]
              ↑ 2、3、4 都要右移
```

## LinkedList 真正擅长什么？

`LinkedList` 底层是双向链表，每个节点大致包含三部分：

```text
prev  ←  item  →  next
```

它的优势只在很窄的范围里成立：

| 操作                       | 成本 | 说明                     |
| -------------------------- | ---- | ------------------------ |
| `addFirst` / `removeFirst` | O(1) | 直接改头节点指针         |
| `addLast` / `removeLast`   | O(1) | 直接改尾节点指针         |
| `get(index)`               | O(n) | 需要从头或尾走到目标节点 |
| `add(index, e)`            | O(n) | 先定位节点，再改指针     |
| `remove(index)`            | O(n) | 同样先定位节点           |

也就是说，“链表插入删除快”成立的前提是：你已经拿到了节点，或者操作发生在头尾。Java 的 `LinkedList` 暴露给业务代码的是 `index` 和元素对象，不是内部节点引用，所以指定位置增删通常仍然要遍历。

此外，链表还有额外成本：每个节点都是独立对象，要多存两个引用，内存占用和 GC 压力都比数组更大。

## 为什么很多队列场景也不推荐 LinkedList？

`LinkedList` 同时实现了 `List` 和 `Deque`，看起来很全能。但工程里如果要表达栈、队列、双端队列，通常优先用 `ArrayDeque`：

```java
Deque<Long> queue = new ArrayDeque<>();
queue.offerLast(1L);
queue.offerLast(2L);
Long first = queue.pollFirst();
```

`ArrayDeque` 底层是循环数组，头尾操作也是均摊 O(1)，对象分配更少。除非你确实需要存储 `null`，否则 `ArrayDeque` 往往比 `LinkedList` 更适合作为双端队列。

## 容易踩的坑

1. `ArrayList` 尾插不是“永远 O(1)”，触发扩容时需要复制数组；只是均摊后可以看作 O(1)。
2. `LinkedList` 指定位置插入不是 O(1)，因为定位节点本身是 O(n)。
3. `RandomAccess` 只是标记接口，不是它让 `ArrayList` 变快；真正原因是数组支持下标寻址。
4. `foreach` 里直接调用集合的 `remove` 容易触发 fail-fast，要用 `Iterator.remove()` 或 `removeIf()`。
5. `Arrays.asList()` 返回的是固定大小列表，不能直接 `add/remove`。

## 小结

- 普通业务列表、分页结果、批量遍历，优先使用 `ArrayList`。
- `ArrayList` 扩容约 1.5 倍，本质是申请新数组并复制旧元素。
- `LinkedList` 只有头尾插入删除是 O(1)，指定位置操作仍然要先遍历。
- 双端队列场景通常优先选 `ArrayDeque`，不是 `LinkedList`。
- 二者都不是线程安全集合，并发场景要换容器或加同步控制。

## 参考

基于 Oracle Java SE API Documentation 与 OpenJDK Java Collections Framework 源码中 List、Map、Set、Queue、Concurrent Collections 等相关内容整理。
