---
title: "String 为什么不可变？和 StringBuilder、常量池是什么关系？"
description: "从不可变设计、常量池到 intern 与拼接优化，讲清 String 的核心考点。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "必会"
  - "高频"
  - "原理深入"
prev:
  {
    text: "== 和 equals 有什么区别？为什么重写 equals 一定要重写 hashCode？",
    link: "/java/basis/java-basis-equals-hashcode.html",
  }
next:
  {
    text: "Java 异常体系是怎么设计的？checked 和 unchecked 怎么选？",
    link: "/java/basis/java-basis-exception.html",
  }
---

# String 为什么不可变？和 StringBuilder、常量池是什么关系？

> String 是 Java 里用得最多的类，也是被误解最多的一个。这篇把「不可变、常量池、拼接优化」这三件事串成一条线讲清楚——它们其实是同一个设计的三个侧面。

## String、StringBuilder、StringBuffer 到底差在哪？

先把三兄弟摆到一张桌子上。它们都用来装字符串，区别集中在两点：**能不能改**、**改的时候线程安不安全**。

| 维度     | String                           | StringBuilder            | StringBuffer                      |
| -------- | -------------------------------- | ------------------------ | --------------------------------- |
| 可变性   | 不可变，每次「修改」都生成新对象 | 可变，在内部数组上原地改 | 可变，在内部数组上原地改          |
| 线程安全 | 天然安全（因为不可变）           | 不安全                   | 安全（方法加了 `synchronized`）   |
| 性能     | 频繁拼接会疯狂创建对象，最差     | 无锁，单线程最快         | 有锁开销，比 StringBuilder 慢一点 |
| 出场时间 | 一直都有                         | JDK 5                    | 一直都有                          |

后两者的关系很近：`StringBuilder` 和 `StringBuffer` 都继承自 `AbstractStringBuilder`，真正干活的 `append`、`insert` 这些方法都写在父类里。差别只在于 `StringBuffer` 把这些方法用 `synchronized` 包了一层，所以多线程下安全，代价是每次调用都要拿锁。

一个常被夸大的说法是「StringBuilder 比 StringBuffer 快很多」。实际单线程下差距大约在 10%~15%，而且现代 JVM 有锁消除（lock elision）等优化，某些场景下 `StringBuffer` 的锁开销会被优化掉，差距进一步缩小。所以别为了这点性能在真正需要并发安全的地方乱用 `StringBuilder`。

选择上记住一句话就够了：

- 只是零星拼几下、或干脆是常量拼接 → 直接用 `String`；
- 单线程里大量拼接（尤其循环）→ 用 `StringBuilder`；
- 多个线程共享同一个可变字符串缓冲区 → 用 `StringBuffer`（这种场景其实很少，通常会换成更合适的并发结构）。

## String 为什么是不可变的？

这是本篇的核心，也是最容易背错原因的一道题。

先说一个**要警惕的错误说法**：很多老资料写「因为 String 内部的字符数组用 `final` 修饰，所以 String 不可变」。这个理由是站不住的。`final` 修饰引用类型变量，只能保证这个引用**不再指向别的数组**，并不能保证数组里的**元素不被改**。也就是说，光凭 `final char[] value` 这一条，数组内容照样能被改动，不足以推出不可变。

真正让 String 不可变的是三件事叠加：

1. **存字符的数组本身是 `private` 且 `final` 的**——外部拿不到这个数组的引用，`final` 又保证它不会被换成另一个数组。
2. **String 没有对外暴露任何能改动这个数组内容的方法**。你调 `substring`、`replace`、`concat`，返回的都是**新的 String 对象**，原对象纹丝不动。这是关键：没有修改入口，内容自然改不了。
3. **String 类被 `final` 修饰，不能被继承**。这样就杜绝了别人写个子类、绕过封装去破坏不可变性的可能。

三条缺一不可，尤其第 2 条才是本质。

### 顺带纠正一个版本细节：内部不再是 char[]

大量资料至今还写「String 内部是 `char[]`」。这在 JDK 9 之前对，但**从 JDK 9 起已经改了**。为了省内存（这个特性叫 Compact Strings / 紧凑字符串），String 的底层实现从 `char[]` 换成了 `byte[]` 外加一个 `coder` 标志位：

```java
// JDK 9 及以后
public final class String implements ... {
    @Stable
    private final byte[] value;   // 不再是 char[]
    private final byte coder;     // 编码标志：LATIN1 或 UTF16
}
```

原理是：一个 `char` 固定占 2 字节（UTF-16），但现实中绝大多数字符串（英文、数字、常见符号）都落在 Latin-1 能表示的范围里，一个字节就够。于是新实现按内容自适应：

- 全是 Latin-1 能表示的字符 → 用 Latin-1 编码，每个字符 1 字节，直接省一半内存；
- 含有超出 Latin-1 的字符（比如中文）→ 退回 UTF-16，每字符仍是 2 字节，和以前一样。

`coder` 就是记录当前用的哪种编码。面试里要是能主动点出「JDK 9 之后其实是 byte[]+coder，不是 char[]」，会比只会背老答案的人显得更懂。

### 不可变到底带来了什么好处

不可变不是为了限制你，而是换来了一堆实打实的收益：

- **可以放心共享和缓存**。既然内容不会变，多个引用指向同一个 String 对象也不会互相影响，这正是常量池能复用字符串的前提。
- **hashCode 可以缓存**。String 内部有个 `hash` 字段，第一次算完就存起来，之后重复用。正因为内容不变，这个缓存永远有效——这让 String 当 `HashMap` 的 key 时特别高效，也是它成为最常用 key 类型的原因之一。
- **天生线程安全**。多个线程读同一个 String，没有任何数据竞争，不需要加锁。
- **安全**。像类加载的类名、数据库连接串、网络地址这些敏感值经常用 String 传递，不可变保证它们在校验之后不会被偷偷改掉。

## 字符串常量池是什么？在哪？

字符串常量池（String Pool）是 JVM 专门为字符串开的一块缓存区，目的很单纯：**同样内容的字符串字面量只存一份，重复复用，省内存**。

```java
String a = "ab";  // 池里没有 "ab"，创建一个放进去，a 指向它
String b = "ab";  // 池里已有 "ab"，直接返回同一个引用
System.out.println(a == b); // true，是同一个对象
```

这里有个**版本变化要说清**：常量池的位置搬过家。JDK 7 之前，字符串常量池待在方法区（HotSpot 里的永久代 PermGen）；**从 JDK 7 开始，它被移到了堆里**。这么改是因为永久代空间有限、容易 OOM，而字符串常量池在大量 `intern` 的场景下会疯狂增长，放到更大的堆里更合理（顺带一提，JDK 8 干脆用元空间彻底取代了永久代）。这个「搬家」直接影响下面 `intern` 的行为，先记住。

## `String s = "abc"` 和 `new String("abc")` 有什么区别？创建几个对象？

这是两种完全不同的创建方式：

- `String s = "abc";` 走的是字面量，JVM 先去常量池找 "abc"，有就直接返回引用，没有才创建。多个字面量共享同一个对象。
- `String s = new String("abc");` 里的 `new` **强制在堆上新建一个对象**，绝不复用常量池里的那个。

所以经典问题「`new String("abc")` 创建了几个对象」的答案是 **1 个或 2 个**，取决于常量池里有没有 "abc"：

- **常量池里没有 "abc"**：创建 2 个。一个在常量池里（由字节码里的 `ldc` 指令触发创建），一个在堆里（由 `new` 创建，用常量池里的 "abc" 来初始化内容）。
- **常量池里已经有 "abc"**：创建 1 个。只在堆里 `new` 出一个，常量池那个直接复用，不再新建。

从字节码看会更直观。`String s = new String("abc")` 大致对应：

```text
new     #2 <java/lang/String>   // 在堆上分配一个 String 对象
dup
ldc     #3 <abc>                // 拿到常量池里的 "abc"（没有则先创建）
invokespecial <String.<init>>   // 用 "abc" 初始化堆里那个对象
astore_1
```

`new` 负责堆里那个，`ldc` 负责常量池那个——两个动作分得清清楚楚，所以最多 2 个对象。

## intern() 到底干了什么？

`String.intern()` 是个 native 方法，作用是「**把这个字符串手动塞进/对齐到常量池**」，规则两句话：

1. 常量池里已经有内容相同的字符串 → 直接返回**池里那个**的引用；
2. 池里没有 → 把当前字符串的引用登记进常量池，再返回这个引用。

一个例子看明白：

```java
String s1 = "Java";                 // 常量池里的 "Java"
String s2 = s1.intern();            // 池里已有，返回同一个
String s3 = new String("Java");     // 堆上新对象
String s4 = s3.intern();            // 返回池里的 "Java"

System.out.println(s1 == s2); // true，都是池里那个
System.out.println(s3 == s4); // false，s3 在堆里，s4 在池里
System.out.println(s1 == s4); // true，都是池里那个
```

再看那个最能说明问题的写法：`new String("a").intern() == "a"` 结果是 `true`。因为 `new String("a")` 在堆上，但 `.intern()` 会返回常量池里的 "a"，而字面量 `"a"` 指的也正是池里那个，两者相等。

补充一个和「常量池搬家」相关的冷知识：JDK 7 之后池在堆里，`intern` 遇到堆上已有对象时，可以直接把**那个堆对象的引用**登记进池，而不必再拷贝一份。这让 `new String("1") + new String("1")` 这类拼接结果 `intern` 后能直接等于后续的同名字面量——这也是很多「intern 面试题在 JDK 6 和 7+ 结果不同」的根源。日常开发几乎用不到 `intern`，它更多是面试考点和特殊省内存场景的手段。

## 字符串拼接：`+` 还是 StringBuilder？

Java 不支持运算符重载，唯一的例外就是为 String 重载的 `+` 和 `+=`。那 `+` 底层到底怎么拼的，得分两种情况看。

### 编译期能确定的常量，编译器直接帮你算好

```java
String s = "str" + "ing";
```

`"str"` 和 `"ing"` 都是编译期就知道值的常量，编译器会做**常量折叠（Constant Folding）**，在编译阶段就把它算成 `"string"` 直接嵌进字节码，并放进常量池。所以：

```java
String s3 = "str" + "ing"; // 编译期折叠成 "string"，指向常量池
String s5 = "string";
System.out.println(s3 == s5); // true
```

能享受这个优化的，是「编译期就能定值」的东西：基本类型和字符串字面量、`final` 修饰的基本类型/字符串变量、以及它们之间的算术/拼接。一旦掺进**运行期才知道值的变量**，就没法折叠了。

### 含变量的拼接，本质是 new StringBuilder().append()

```java
String str1 = "str";
String str2 = "ing";
String str4 = str1 + str2;     // 变量拼接
```

`str1`、`str2` 是普通变量，编译期不知道值。这时 `+` 会被编译器翻译成大致这样的代码：

```java
String str4 = new StringBuilder().append(str1).append(str2).toString();
```

所以 `str4` 是运行时 new 出来的新对象，和常量池里的 `"string"` 不是同一个：`str3 == str4` 为 `false`。反过来，如果给变量加上 `final`，编译器又能当常量处理，折叠后就相等了——前提是这个 `final` 变量的值编译期能定，若是 `final String s = getStr()` 这种运行期才返回的，照样折叠不了。

> 版本提醒：JDK 9 之后，`+` 拼接的底层实现从「显式 new StringBuilder」改成了用 `invokedynamic` 调用 `makeConcatWithConstants`（JEP 280），由运行时动态决定拼接策略、提前估算容量，减少临时对象。但这套优化主要惠及 `a+b+c` 这种简单拼接，**循环里的大量拼接它救不了**，还是得手动上 `StringBuilder`。

## 容易踩的坑

- **循环里用 `+` 拼字符串**，这是最经典的坑。因为 `+` 每轮都 `new` 一个新的 `StringBuilder`、append、再 `toString`，循环 n 次就制造 n 个临时 StringBuilder 和一堆中间 String，性能随数据量急剧劣化。正确做法是循环外建一个 `StringBuilder`，循环里只 `append`：

  ```java
  // 反例：每轮都新建 StringBuilder
  String s = "";
  for (String x : arr) s += x;

  // 正解：复用同一个 StringBuilder
  StringBuilder sb = new StringBuilder();
  for (String x : arr) sb.append(x);
  String s = sb.toString();
  ```

- **把「String 不可变」理解成「引用不能变」**。不可变说的是对象内容，引用变量当然能重新赋值指向别的 String，只是原对象没被改而已。
- **拿 `==` 比字符串内容**。`==` 比的是引用（是不是同一个对象），内容比较一律用 `equals`。字面量因为常量池复用，`==` 有时也返回 true，这纯属巧合，别依赖。
- **背原因时只说「因为 final」**。前面强调过，`final char[]` 挡不住数组元素被改，真正原因是私有 final 数组 + 无修改入口 + 类被 final。

## 小结

1. String 不可变、天然线程安全；StringBuilder 可变不安全但快，StringBuffer 可变且用 `synchronized` 保证安全。零星拼接用 String，单线程大量拼接用 StringBuilder，并发共享才用 StringBuffer。
2. String 不可变的真正原因是：存字符的数组私有且 final、不对外暴露修改入口、类本身被 final 不可继承——不是单靠 `final` 修饰数组。
3. JDK 9 起 String 内部由 `char[]` 改为 `byte[]+coder`（Compact Strings），按 Latin-1/UTF-16 自适应省内存；老资料还写 char[] 的要留神。
4. 字符串常量池 JDK 7 起从方法区（永久代）移到了堆；`new String("abc")` 创建 1 或 2 个对象，`intern()` 用来把字符串对齐到常量池并返回池中引用。
5. `+` 拼接常量会被编译器常量折叠，含变量则等价于 StringBuilder.append；循环里绝不能用 `+`，要显式用 StringBuilder。

## 参考

- 综合整理自项目内 Java 基础资料的 String 部分，并对其中「final 修饰数组即不可变」的说法做了纠偏、补充了 JDK 9 的 byte[]+coder 变化与常量池 JDK 7 搬家的细节。
- Compact Strings 官方说明：OpenJDK JEP 254。
- 字符串拼接底层实现（invokedynamic）：OpenJDK JEP 280。
