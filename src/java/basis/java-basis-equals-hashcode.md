---
title: "== 和 equals 有什么区别？为什么重写 equals 一定要重写 hashCode？"
description: "讲清 == 比引用、equals 比内容，以及 equals 与 hashCode 的约定为何必须一起重写。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "必会"
  - "高频"
  - "细节题"
prev:
  { text: "枚举 enum 为什么比常量类更适合表达固定集合？", link: "/java/basis/java-basis-enum.html" }
next:
  {
    text: "String 为什么不可变？和 StringBuilder、常量池是什么关系？",
    link: "/java/basis/java-basis-string.html",
  }
---

# == 和 equals 有什么区别？为什么重写 equals 一定要重写 hashCode？

> 一句话点题：`==` 和 `equals` 回答的是「是不是同一个对象」还是「内容一不一样」两个不同的问题；而 `equals` 和 `hashCode` 是一对必须同进同退的搭档，拆开就会在哈希容器里埋雷。

这三个东西经常被放在一起问，原因是它们环环相扣：`==` 是语言层面的运算符，`equals` 是可以被重写的方法，`hashCode` 又是让哈希容器高效工作的前提。搞懂它们之间的关系，很多「集合去重失灵」的诡异 bug 就一目了然了。

## == 到底比的是什么？

`==` 是运算符，它的行为取决于两边是什么类型：

- **两边是基本类型**（`int`、`long`、`double`、`char`……）：比较的是**值本身**。`1 == 1`、`'a' == 'a'` 都是 true。
- **两边是引用类型**（对象）：比较的是**引用**，也就是两个变量是不是指向堆里的**同一个对象**。

有一种更统一的理解方式：Java 只有值传递，`==` 比的永远是「变量里存的那个值」。基本类型变量存的就是数值，引用类型变量存的是对象的地址，所以对引用类型来说，「值相等」就等价于「地址相同、是同一个对象」。

```java
int a = 128, b = 128;
System.out.println(a == b);      // true，比的是数值

String s1 = new String("hi");
String s2 = new String("hi");
System.out.println(s1 == s2);    // false，两个 new 出来的对象，地址不同
```

顺带提一个容易忽略的细节：`==` 两边类型不一致时会发生自动类型提升，比如 `42 == 42.0` 是 true，因为 `int` 会被提升成 `double` 再比数值。这类跨类型比较在实际代码里很少刻意去写，知道有这么回事即可。

## equals：没重写时就是 ==，重写后才比内容

`equals` 是 `Object` 里定义的方法，所以每个类都有。它的**默认实现**其实什么都没多做：

```java
public boolean equals(Object obj) {
    return (this == obj);
}
```

也就是说，**一个类如果没重写 `equals`，那 `equals` 和 `==` 完全等价**，比的还是引用。真正让 `equals` 有「比内容」能力的，是各个类**自己重写**了它。`String`、`Integer`、`Double` 这些常用类都重写过。

最经典的对比就是 `String`：

```java
String a = new String("ab");   // 堆上一个新对象
String b = new String("ab");   // 堆上另一个新对象，内容相同
System.out.println(a == b);        // false，不是同一个对象
System.out.println(a.equals(b));   // true，String 重写了 equals，比的是内容
```

`a == b` 为 false 是因为两个 `new` 各自在堆上开辟了对象；而 `a.equals(b)` 为 true，是因为 `String.equals` 被重写成「逐字符比较内容」。这就是「引用不同、内容相同」的典型场景。

> 一个小提醒：网上很多资料贴的 `String.equals` 源码是基于 `char[]` 的老版本。从 Java 9 起 `String` 底层改用 `byte[]` 存储，源码细节已经变了（这属于 String 不可变专篇的内容，这里不展开）。但**它「比内容」这个语义一直没变**，记住结论就行。

所以规则很清楚：**要判断两个对象内容是否相等，用 `equals`；要判断是不是同一个对象，用 `==`。** 对引用类型用 `==` 比内容，几乎都是 bug。

## hashCode 是什么？哈希表为什么需要它

`hashCode()` 也定义在 `Object` 里，返回一个 `int`，俗称哈希码 / 散列码。它单独看没什么用，它的价值全部体现在**哈希表**（`HashMap`、`HashSet`）里：哈希表用这个 int 来**快速定位一个对象该放进哪个桶（bucket）**。

设想一个 `HashSet` 里已经存了一万个元素，现在要判断某个新对象在不在集合里。如果没有 hashCode，就只能拿它跟一万个元素挨个 `equals`，慢得离谱。有了 hashCode，流程就变成：

1. 先算出新对象的 `hashCode`，经过一次内部散列换算定位到某个桶；
2. 只在**这一个桶**里的少量元素上调用 `equals` 做精确比较。

这样就把「和一万个比」缩小成了「和一个桶里的两三个比」。`HashMap` 内部比较时也是**先比 int 型的 hash（极快），hash 相等了再调 `equals`（较慢）**，用便宜的比较挡在前面，减少昂贵的 `equals` 调用次数。

（哈希码到桶下标的具体换算、扩容、链表转红黑树等，属于 HashMap 底层结构的内容，另有专篇，这里只需要知道「hashCode 用来定位桶」这一层。）

顺便澄清一个流传很广的误解：**hashCode 并不等于对象的内存地址**。很多人以为 `Object.hashCode()` 返回的是地址转换来的值，其实在主流的 OpenJDK 8 里，默认实现是「基于线程局部状态的 Marsaglia xor-shift 随机数」，不同 JDK/参数下算法还不一样。所以别把 hashCode 当地址用。

## ⭐️ 为什么重写 equals 一定要重写 hashCode？

这是本篇的核心。答案来自 `Object` 给这两个方法定下的**契约**：

> **如果两个对象 `equals` 相等，那它们的 `hashCode` 必须相等。**

如果你只重写了 `equals`（让业务上相等的对象被判为相等），却没重写 `hashCode`（还用 `Object` 那个「几乎每个对象都不一样」的默认实现），就会违反这条契约：两个 `equals` 相等的对象，`hashCode` 却不同。放进哈希容器时，麻烦立刻就来。

来走一遍具体例子。定义一个 `Person`，只重写 `equals`，故意不重写 `hashCode`：

```java
class Person {
    String name;
    int age;
    Person(String name, int age) { this.name = name; this.age = age; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Person p = (Person) o;
        return age == p.age && Objects.equals(name, p.name);
    }
    // 故意不重写 hashCode
}
```

现在把两个「业务上完全相同」的人放进 `HashSet` 去重：

```java
Set<Person> set = new HashSet<>();
set.add(new Person("Tom", 18));
set.add(new Person("Tom", 18));
System.out.println(set.size());   // 期望 1，实际却是 2
```

去重失败了。原因是：两个 `Person` 的 `equals` 返回 true 没错，但它们的 `hashCode` 用的是 `Object` 默认实现，几乎必然不同。`HashSet` 第一步就靠 `hashCode` 定位桶——两个对象被分到了**不同的桶**，于是根本没机会走到「同桶内再 `equals`」那一步，`HashSet` 自然认为它们是两个不同元素，两个都存了进去。

补上 `hashCode` 就正常了：

```java
    @Override
    public int hashCode() {
        return Objects.hash(name, age);   // 相等的对象算出相等的 hashCode
    }
```

再跑，`set.size()` 就是 1。同样的道理也发生在 `HashMap` 上：你用一个「内容相同的新对象」当 key 去 `get`，因为算出的桶和当初 `put` 时不一致，会取到 `null`，明明存过却像丢了。

一句话总结这个坑：**只重写 equals 不重写 hashCode，会让「逻辑上相等」的对象在哈希容器里被当成不同对象，导致去重失效、查不到值。**

## equals 与 hashCode 的三条约定

把它们的关系理成三条，面试直接背：

| 情况              | 结论                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `equals` 相等     | `hashCode` **必须**相等（这是硬契约，违反就出 bug）                |
| `hashCode` 相等   | `equals` **不一定**相等（这叫哈希冲突，允许且正常）                |
| `hashCode` 不相等 | `equals` **一定**不相等（可以直接判定为不同对象，无需再比 equals） |

第二条要特别理解：**hashCode 相等但 equals 不等，就是哈希冲突（哈希碰撞），这是完全正常的**。int 只有约 42 亿个取值，而对象可以有无穷多个，不同对象撞上同一个 hashCode 在所难免。哈希容器本来就设计了链表 / 红黑树来容纳同一个桶里的多个不同元素。所以「hashCode 相同」只能说明「可能相等，值得进一步用 equals 确认」，不能直接下结论。

反过来第三条正是 hashCode 提速的来源：hashCode 不同 → 直接判不等，`equals` 都不用调。

除了和 hashCode 的这层关系，`equals` 本身还要满足自反性、对称性、传递性、一致性和「非空对象 equals null 返回 false」这几条。自己手写 equals 容易漏掉对称性或类型判断，实践中建议直接用 IDE 生成，或用 `Objects.equals` / `Objects.hash` 来拼，省心且不易错。

## Object 还有哪些常见方法

顺带过一遍 `Object` 里其他几个常被问到的方法，简单了解即可：

- `getClass()`：`final native`，返回运行时的 `Class` 对象，不能被重写。
- `toString()`：默认返回「类名 @ 十六进制 hashCode」，可读性差，建议子类重写成有意义的描述。
- `clone()`：`protected native`，做对象拷贝，要用得实现 `Cloneable`，默认是浅拷贝。
- `wait()` / `notify()` / `notifyAll()`：`final native`，配合 `synchronized` 做线程间通信，属于并发部分的内容。
- `finalize()`：对象被 GC 回收前的回调。**注意它从 Java 9 起已被标记为 `@Deprecated`**，且执行时机不可控、可能根本不执行，早就不建议使用，新代码别碰它。资料把它算进「常见方法」里，但实践中它其实是被淘汰的角色。

## 容易踩的坑

- **对引用类型用 `==` 比内容**：尤其是字符串比较，`str == "abc"` 在字面量场景可能碰巧为 true，一旦对象来自 `new` 或运行时拼接就翻车。比内容一律用 `equals`。
- **只重写 equals 忘了 hashCode**：哈希容器去重 / 查找直接失灵，是最典型的坑，也是本篇重点。反过来只重写 hashCode 不重写 equals，则会把不同对象误判为相等。两者必须成对出现。
- **拿可变字段算 hashCode 后又改它**：对象进了 `HashSet`/`HashMap` 之后，再修改参与 `hashCode` 计算的字段，它的桶位置就对不上了，从此在容器里既删不掉也查不到。当 key 用的对象，参与哈希的字段最好是不可变的。
- **把 hashCode 当内存地址**：它只是个用于散列的 int，不同 JDK 实现不同，别依赖它的具体数值或唯一性。

## 小结

1. `==` 比基本类型的值、比引用类型的地址（是否同一对象）；`equals` 默认等价于 `==`，重写后才按内容比较。
2. `String`、`Integer` 等常用类都重写了 `equals`；`new String("a").equals(new String("a"))` 为 true 而 `==` 为 false。
3. `hashCode` 返回 int，服务于哈希表：先用它定位桶、比 hash，再在桶内比 `equals`，大幅减少 `equals` 调用。
4. 重写 `equals` 必须重写 `hashCode`，因为契约要求「equals 相等则 hashCode 必相等」；否则相等对象落入不同桶，导致 `HashSet`/`HashMap` 去重失败、查不到值。
5. hashCode 相等不代表 equals 相等（哈希冲突，正常现象）；hashCode 不等则 equals 必不等。

## 参考

- 综合自项目内 Java 基础资料的 Object 章节（== 与 equals、hashCode 作用、为何重写 equals 要重写 hashCode）。
- 结合官方约定与实践做了以下核对与改写：指出「hashCode 即内存地址」是常见误解（OpenJDK 8 默认用 xor-shift 随机数）；补充 `finalize()` 自 Java 9 起已废弃、不建议使用；说明 `String.equals` 源码在 Java 9+ 已由 `char[]` 改为 `byte[]`，但「比内容」语义不变；HashMap 底层桶定位与扩容树化细节留待专篇。
