---
title: "数组、链表、栈、队列怎么选？"
description: "从连续内存与指针结构讲清线性结构取舍。"
breadcrumb: true
article: true
editLink: false
category:
  - "数据结构"
tag:
  - "必会"
  - "高频"
  - "基础"
prev:
  text: "数据结构"
  link: "/cs-basics/data-structure/"
next:
  text: "二叉树和 BST 要掌握什么？"
  link: "/cs-basics/data-structure/ds-tree-bst.html"
---

# 数组、链表、栈、队列怎么选？

> 线性结构的真正分水岭不是“增删查改谁更快”这句口号，而是：你要随机访问，还是只在两端动手。

## 先用一张表定调

| 结构             | 随机访问 | 头/尾插删                | 中间插删                       | 典型场景                                 |
| ---------------- | -------- | ------------------------ | ------------------------------ | ---------------------------------------- |
| 数组 / ArrayList | O(1)     | 尾部均摊 O(1)，头部 O(n) | O(n)                           | 读多、下标访问、顺序遍历                 |
| 链表             | O(n)     | 已知头尾时 O(1)          | 已知节点时 O(1)，否则先找 O(n) | 节点级插删、LRU 一类“持有节点引用”的结构 |
| 栈               | 只看栈顶 | 栈顶 O(1)                | 不支持                         | 撤销、括号匹配、DFS、函数调用            |
| 队列             | 只看队头 | 两端 O(1)                | 不支持                         | 缓冲、BFS、生产者消费者                  |

选型先看访问模式，再谈实现细节。

## 数组：连续内存带来的“免费加速”

数组把同类型元素放在连续内存里。下标访问本质是：

```text
地址 = 基址 + index * 元素大小
```

所以 `a[i]` 是 O(1)，不需要顺着指针走。中间插入/删除则要把后面元素整体搬移，最坏 O(n)。

连续内存还有一个常被忽略的收益：缓存局部性。CPU 读 `a[i]` 时，相邻的 `a[i+1]`、`a[i+2]` 往往已经进了 cache line。顺序遍历数组通常比遍历链表快，不是因为“算法复杂度更优”，而是因为内存访问更省。

```text
数组： [A][B][C][D]   一次读可能命中多个元素
链表： A → B → C → D  每个节点可能落在不同缓存行
```

代价也很明确：容量固定。静态数组装不下就要新开更大空间再拷贝。

## ArrayList：工程里最常用的动态数组

`ArrayList` 底层是 `Object[]`，对外表现为可变长列表。无参构造不会立刻分配长度为 10 的数组，第一次 `add` 时才扩到默认容量 10。后续容量不够时，大致按 **1.5 倍**扩容：

```text
newCapacity = oldCapacity + (oldCapacity >> 1)
```

扩容不是“原地拉长”，而是申请新数组再 `Arrays.copyOf`。所以：

1. 能预估数量就写 `new ArrayList<>(n)`，减少复制。
2. 已有列表后批量追加，可先 `ensureCapacity`。
3. 尾部追加均摊 O(1)；`add(index, e)` / `remove(index)` 仍是 O(n)。

```java
List<Long> ids = new ArrayList<>(records.size());
for (Record r : records) {
    ids.add(r.id());
}
// 大批量追加时：
// result.ensureCapacity(result.size() + batch.size());
```

它实现了 `RandomAccess`，适合 `get(i)` 和顺序遍历。业务列表、分页结果、批量转换后的 DTO 列表，默认就该是它。

## 链表：节点级插删快，不等于业务代码里“增删快”

链表不要求连续内存，每个节点自带指针。常见形态：

| 类型         | 指针        | 特点                               |
| ------------ | ----------- | ---------------------------------- |
| 单链表       | 只有 next   | 结构简单，逆向遍历难               |
| 双向链表     | prev + next | 可双向走，Java `LinkedList` 就是它 |
| 循环链表     | 尾指向头    | 适合环形遍历                       |
| 双向循环链表 | 首尾互指    | 结构更完整，实现更重               |

理论复杂度要加前提：**“已知节点”时**插删才是 O(1)。按 index 插删必须先走到目标位置，平均仍是 O(n)。

```text
插入节点 X 到 P 之后：
P.next = X
X.next = oldNext
// 双向链表还要维护 prev
```

额外成本也很实在：每个节点多存指针，对象头、对齐、GC 压力都比数组高。内存碎片化后，遍历时 cache miss 更多。

## 为什么工程默认 ArrayList，而不是 LinkedList？

教科书常写“数组查询快、链表增删快”。落到 Java 业务代码里，这句经常误导人。

原因有三：

1. **随机访问和遍历更常见。** 接口返回列表、循环处理、按 index 取元素，数组更合适。
2. **CPU cache。** 连续数组顺序扫一遍，通常比链表逐节点跳快一截。
3. **Java 的 LinkedList 不暴露节点引用。** 你拿到的是 `List` API，`add(index, e)` 仍然要先定位，O(n) 定位 + O(1) 改指针，总体还是 O(n)。

真正适合链表的场景，往往是“已经持有节点”的结构，比如 LRU：哈希表定位节点，双向链表在 O(1) 内挪到队头。纯业务 `List` 接口下，很少能拿到这个前提。

头尾频繁入队出队？优先考虑 `ArrayDeque`，而不是条件反射写 `LinkedList`。

## 栈：后进先出，约束出能力

栈只允许在栈顶 push / pop，语义是 **LIFO**。底层可用数组或链表实现，接口复杂度都是 O(1)。

经典场景：

- 括号匹配：遇左括号入栈，遇右括号弹出比对。
- 撤销/重做：操作历史本身就是栈。
- 函数调用：后调用的先返回，JVM 本地方法栈也是这套模型。
- DFS：显式栈模拟递归，或系统调用栈本身就是栈。

```java
// 不要用 java.util.Stack
Deque<Character> stack = new ArrayDeque<>();
stack.push('(');
char top = stack.pop();
```

`java.util.Stack` 继承自古老的 `Vector`，方法带同步、设计过时。现代 Java 里栈用 `Deque`（通常 `ArrayDeque`）表达即可：`push` / `pop` / `peek` 语义清晰，也没有额外同步开销。

## 队列：先进先出，以及双端和阻塞变体

队列默认 **FIFO**：一端入，一端出。常见用途是削峰缓冲、BFS 层序遍历、异步解耦。

Java 选型可以按语义拆：

| 需求                       | 优先选择        | 说明                                           |
| -------------------------- | --------------- | ---------------------------------------------- |
| 单线程队列 / 栈 / 双端队列 | `ArrayDeque`    | 循环数组，均摊 O(1)，不存 null                 |
| 必须存 null 的双端结构     | `LinkedList`    | 能用，但多数场景可避开                         |
| 多线程生产消费、需要阻塞   | `BlockingQueue` | 如 `ArrayBlockingQueue`、`LinkedBlockingQueue` |
| 按优先级出队               | `PriorityQueue` | 不是 FIFO，别和普通队列混谈                    |

```java
Queue<Task> q = new ArrayDeque<>();
q.offer(task);     // 入队
Task t = q.poll(); // 出队，空则 null

// 并发缓冲：
BlockingQueue<Task> buffer = new ArrayBlockingQueue<>(1024);
buffer.put(task);  // 满则阻塞
Task next = buffer.take(); // 空则阻塞
```

`offer/poll` 失败返回特殊值，`add/remove` 失败抛异常，`put/take` 会阻塞。排查线程卡住时，先分清用的是哪一组 API。

## 选型口诀

```text
读多、要下标、顺序遍历多  → 数组 / ArrayList
只在两端操作（栈/队列）    → ArrayDeque；并发再上 BlockingQueue
必须节点级 O(1) 插删       → 链表结构（通常要自己持有节点）
多线程共享可变集合         → 并发容器或外部同步，别拿普通 List 硬扛
```

再补两条工程经验：

1. “链表增删快”只有在**已定位到节点**时成立；按 index 操作，链表并不占优。
2. 复杂度相同不等于实际更快。数组的 cache 友好性，在真实机器上经常决定胜负。

## 容易踩的坑

1. 把 `LinkedList` 当成所有“增删场景”的默认答案。多数业务增删其实是尾部追加，`ArrayList` 更合适。
2. 用 `Stack` 类表达栈。应改成 `Deque`。
3. 并发场景直接用 `ArrayList` / `LinkedList`。它们都不是线程安全的；需要阻塞语义就上 `BlockingQueue`。
4. 把“中间插入 O(1)”说成 `LinkedList` 的无条件优势。Java 里按 index 插入仍然要先遍历。

## 小结

1. 数组靠连续内存换随机访问 O(1) 和更好的缓存局部性；中间插删要搬移，O(n)。
2. `ArrayList` 是 1.5 倍扩容的动态数组，工程默认列表；能预估容量就提前指定。
3. 链表在“已知节点”时插删 O(1)，但访问是 O(n)，指针与对象开销更大。
4. 栈是 LIFO，队列是 FIFO；Java 里优先 `ArrayDeque`，并发用 `BlockingQueue`，别用过时的 `Stack`。
5. 选型口诀：读多索引用数组，两端操作用栈/队列，并发换并发容器。

## 参考

综合自线性数据结构基础（数组/链表/栈/队列特性与复杂度）、Java 集合中 `ArrayList`/`LinkedList`/`ArrayDeque`/`BlockingQueue` 的实现边界与工程选型实践整理；对“链表一定增删快”“业务默认 LinkedList”等常见绝对化说法做了纠偏。
