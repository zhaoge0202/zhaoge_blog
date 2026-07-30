---
title: "Atomic 原子类怎么用？LongAdder 为什么比 AtomicLong 快？"
description: "从 CAS 原子类到 LongAdder 分段计数讲清原子类家族与选型。"
breadcrumb: true
article: true
editLink: false
category:
  - "并发"
tag:
  - "必会"
  - "高频"
  - "原理深入"
prev:
  text: "CAS 是怎么实现原子操作的？有哪些问题？"
  link: "/java/concurrent/java-concurrency-cas.html"
next:
  text: "ReentrantLock 和 AQS 是怎么配合的？"
  link: "/java/concurrent/java-concurrency-reentrantlock.html"
---

# Atomic 原子类怎么用？LongAdder 为什么比 AtomicLong 快？

> CAS 是无锁原子操作的原语，Atomic 家族则是把它封装成一组拿来即用的现成类。会 CAS 的原理，还要会按场景选对那个类——尤其是 `AtomicLong` 和 `LongAdder` 之间那道分水岭。

## 为什么要原子类：`i++` 不是原子的

多线程下最经典的坑就是计数。`count++` 看着是一句话，实际上是三步：读 `count`、加 1、写回 `count`。三步之间随时可能被别的线程插队，所以两个线程各加 1 万次，最后常常不是 2 万。

解决思路有两条：

- **加锁**：`synchronized` 或 `ReentrantLock`，把这段操作串行化。简单粗暴，但每次都要走加锁/解锁、可能阻塞、可能上下文切换，竞争一激烈就重。
- **无锁 CAS**：基于「比较并交换」，不需要阻塞线程，失败就重试。Atomic 原子类就是 CAS 的工程化封装——把底层 `Unsafe.compareAndSwapXxx` 那套自旋逻辑包成 `incrementAndGet`、`compareAndSet` 这种好用的方法，你不用自己写循环。

所以原子类的定位很清楚：**单个变量的原子读写，又不至于为它上锁时，用它最合适**。多个变量、复杂逻辑还得回到锁。

## 原子类家族总览

`java.util.concurrent.atomic` 包的原子类，按操作的「数据形态」可以分成五类：

| 类别       | 典型类                                                                               | 解决什么                                         | 适用场景                     |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------- |
| 基本类型   | `AtomicInteger`、`AtomicLong`、`AtomicBoolean`                                       | 单个基本类型变量的原子读写                       | 普通计数、状态标志           |
| 引用类型   | `AtomicReference`、`AtomicStampedReference`、`AtomicMarkableReference`               | 对象引用的原子替换，带版本号/标记的引用          | 不可变对象更新、解决 ABA     |
| 数组类型   | `AtomicIntegerArray`、`AtomicLongArray`、`AtomicReferenceArray`                      | 数组里某个元素的原子更新                         | 并发改数组下标               |
| 字段更新器 | `AtomicIntegerFieldUpdater`、`AtomicLongFieldUpdater`、`AtomicReferenceFieldUpdater` | 用反射方式原子更新某个类里已有的 `volatile` 字段 | 不想把字段包成 Atomic 对象时 |
| 累加器     | `LongAdder`、`LongAccumulator`、`DoubleAdder`、`DoubleAccumulator`                   | 高并发累加计数，用分段（Cell）分散竞争           | 写多读少、高并发统计计数     |

> 这里有必要纠偏一下：有些资料只把原子类分成「基本 / 数组 / 引用 / 字段更新器」四类，漏掉了累加器这一类。累加器（`LongAdder` 等）是 JDK 8 才加进来的，专门冲着高并发计数器场景去的，单列一类更准确——它和基本类型原子类在实现思路上根本不是一个路子。

记住一个总原则：**前四类都是「一个值 + CAS 自旋」**，累加器则是「把一个值拆成一堆 Cell，分散竞争」\*\*，这是后面选型的关键分水岭。

## 基本类型：`AtomicInteger` / `AtomicLong` / `AtomicBoolean`

三个类的方法几乎一一对应，以 `AtomicInteger` 为例，常用的就这么几个：

| 方法                                       | 作用                                   |
| ------------------------------------------ | -------------------------------------- |
| `get()` / `set(int)`                       | 直接读 / 写当前值                      |
| `getAndIncrement()`                        | 返回旧值，再自增（等价于 `i++`）       |
| `incrementAndGet()`                        | 先自增，返回新值（等价于 `++i`）       |
| `getAndDecrement()` / `decrementAndGet()`  | 自减的两种版本                         |
| `getAndAdd(int)` / `addAndGet(int)`        | 加一个数，区别在返回旧值还是新值       |
| `compareAndSet(int expect, int update)`    | 经典 CAS：等于预期才更新，返回是否成功 |
| `updateAndGet(IntUnaryOperator)`           | 用函数式更新，函数内部自己包 CAS 重试  |
| `getAndAccumulate(int, IntBinaryOperator)` | 用函数把当前值和参数合并，返回旧值     |

带 `get` 在前的返回旧值、`get` 在后的返回新值，这个命名规律记住了就不容易混。

```java
AtomicInteger cnt = new AtomicInteger(0);

cnt.incrementAndGet();              // 1
int old = cnt.getAndAdd(5);          // old=1，cnt=6
boolean ok = cnt.compareAndSet(6, 10); // true，cnt=10

// 函数式更新：自旋到成功为止，不用自己写 while
cnt.updateAndGet(x -> x * 2);       // 20
```

底层实现就是把 `Unsafe.compareAndSwapInt` 包成自旋循环。以 `getAndAdd` 为例，核心就是上一篇 CAS 里讲的那段：

```java
public final int getAndAddInt(Object o, long offset, int delta) {
    int v;
    do {
        v = getIntVolatile(o, offset);          // 读当前值
    } while (!compareAndSwapInt(o, offset, v, v + delta)); // 失败就重来
    return v;
}
```

`value` 字段是 `volatile` 的，保证读到的值对其他线程可见；CAS 又保证「读-改-写」这个复合操作原子。两者配合就是无锁线程安全。

> 一个常被忽略的细节：`AtomicBoolean` 内部存的其实不是 `boolean`，而是一个 `int`（0 表示 `false`，非 0 表示 `true`）。因为底层的 CAS 是 `compareAndSwapInt`，没有原生的 boolean CAS，所以只能这么包一层。知道这点就不会对它的源码感到奇怪。

`AtomicIntegerArray` 等数组类的 API 和上面几乎一样，只是每个方法多了一个下标参数（`getAndIncrement(int i)`），底层的偏移量是按下标算出来的，这里不展开。

## 引用类型：`AtomicReference` 与 ABA 问题

基本类型原子类只能管一个基本变量。要原子地更新一个对象引用（比如把一个不可变对象整体替换成新的），就用 `AtomicReference`。

```java
// 不可变对象：每次更新都换一个新实例
record Config(int version, String name) {}

AtomicReference<Config> ref = new AtomicReference<>(new Config(1, "old"));
Config old = ref.get();
boolean ok = ref.compareAndSet(old, new Config(2, "new")); // 引用替换，原子
```

但 CAS 在引用上有个老问题——**ABA**。

### ABA 问题

CAS 只判断「当前值是不是还等于我读到的旧值」。可一个值从 A 变成 B、又被改回 A，CAS 会以为它从没被动过：

```
时间线：
  线程 1 读到引用 A
  线程 2 把引用改成 B
  线程 2 又把引用改回 A
  线程 1 CAS(A → C) 成功 —— 但中间的 B → A 完全没察觉
```

对纯计数器来说这无所谓（A 还是 A，结果对）。但一旦涉及「值变化的过程」——比如链表节点被弹出又复用、栈里同一个节点被回收再塞回——ABA 就可能让 CAS 改错对象，造成数据损坏。

### 用版本号解决：`AtomicStampedReference`

思路很直接：光比值不够，再比一个版本号（stamp）。每次更新版本号也跟着变，于是 A→B→A 会被识别成 `stamp` 不一致。

```java
AtomicStampedReference<String> ref =
    new AtomicStampedReference<>("A", 0);   // 初始值 A，初始版本 0

int[] stampHolder = new int[1];
String oldRef = ref.get(stampHolder);        // 取引用，stampHolder[0]=0
int oldStamp = stampHolder[0];

// 必须引用和版本号同时匹配才更新，并把版本号加 1
boolean ok = ref.compareAndSet(oldRef, "C", oldStamp, oldStamp + 1);
```

`compareAndSet` 要同时满足「旧引用相等」和「旧版本号相等」，才把引用和版本号一起换掉。这样哪怕值绕回 A，版本号也对不上，CAS 失败。

### `AtomicMarkableReference`：它管不了 ABA

> 这里要特别点明一个流传很广的说法。有不少资料（包括本篇参考的一些资料）会讲：`AtomicMarkableReference`「也可以解决 ABA 问题」，甚至把它和 `AtomicStampedReference` 并列当 ABA 的解决方案。**这是错的。**

`AtomicMarkableReference` 挂的是一个 `boolean` 标记，不是版本号。它每次更新你可以一起翻转标记，但标记只有「真/假」两种状态，根本做不到「每次都不同」——同一个标记值可以反复出现，所以它无法识别「A→B→A」这种中间变化。

它的真正用途是给引用配一个简单的状态位（比如「这个对象是否已经被清理过」），属于附带标记的引用更新，**不是 ABA 的解决方案**。要解 ABA，只有 `AtomicStampedReference`（带整数版本号）这一条正路。

## 字段更新器：`AtomicIntegerFieldUpdater`

前面的类都得你专门 new 一个 Atomic 对象来包住值。但有时候值本来就在某个类的字段里，你不想为了原子更新它再额外造一个 Atomic 对象（比如为了内存或 API 兼容），这时候用字段更新器。

`AtomicIntegerFieldUpdater` 用反射的方式，对一个类里**已有的** `volatile` 字段做原子更新：

```java
class Account {
    volatile int balance;   // 必须是 volatile int，且对更新器可见
}

AtomicIntegerFieldUpdater<Account> balUpdater =
    AtomicIntegerFieldUpdater.newUpdater(Account.class, "balance");

Account a = new Account();
balUpdater.incrementAndGet(a);        // balance: 1
balUpdater.addAndGet(a, 100);         // balance: 101
balUpdater.compareAndSet(a, 101, 50); // 期望 101，改成 50
```

用它的前提条件得记牢，漏一个就抛异常：

| 条件                  | 说明                                                          |
| --------------------- | ------------------------------------------------------------- |
| 字段必须是 `volatile` | 更新器靠 volatile 保证可见性，没有它会直接报错                |
| 类型必须严格匹配      | `AtomicIntegerFieldUpdater` 只能更新 `int`，`long` 要用对应类 |
| 字段必须可被访问      | `private` 字段在类外用更新器会失败；跨包还要注意访问权限      |
| 只能是实例字段        | 静态字段不支持，得用别的方案                                  |

它的好处是**省内存、不侵入对象结构**：一堆 Account 对象共用一个更新器，不用每个对象里都塞一个 `AtomicInteger`。代价是反射开销和上面那堆限制，适合字段已经存在、又不想改造类的场景。

## LongAdder 为什么比 AtomicLong 快

这是原子类里最值得讲透的一问。先看 `AtomicLong` 在高并发下为什么撑不住，再看 `LongAdder` 怎么破。

### AtomicLong 的瓶颈：所有人都抢同一个值

`AtomicLong` 内部就一个 `volatile long value`，所有线程的自增都走同一个 `compareAndSwapLong`。竞争一激烈，CAS 失败的概率上升，失败就自旋重试，重试又加剧竞争——形成**自旋风暴**，CPU 全耗在「失败-重试」上，真正的加法反而没做多少。

线程数一多，吞吐量会断崖式下降。这不是 `AtomicLong` 写得差，是「单一热点值」这个结构本身的限制。

### LongAdder 的思路：把一个值拆成一段段

`LongAdder`（父类 `Striped64`）的内部结构是：

```
LongAdder
  ├─ base   (long)        — 无竞争时直接 CAS 这个
  └─ Cell[] cells          — 有竞争时分散到不同 Cell
       └─ Cell { volatile long value; @Contended }
```

每次 `add(x)`：

1. 先尝试 CAS 更新 `base`，没人抢就到此为止，开销和 `AtomicLong` 一样；
2. 抢不到（说明有竞争），就按线程的探针值（`threadLocalRandomProbe`）算出一个下标，落到某个 `Cell` 上去 CAS；
3. 某个 `Cell` 也抢不到，就考虑扩容 `Cell[]`，让线程散得更开。扩容上限大致和 CPU 核心数相当，再多也没意义。

这样大部分线程各自改自己的 `Cell`，互不打扰；只有对同一个 `Cell` 的少数线程才会真正竞争。

读的时候用 `sum()`：把 `base` 加上所有 `Cell` 的值。**注意 `sum()` 不是强一致的快照**——你遍历 `Cell` 的过程中别的线程可能还在改，所以它返回的是「大致当前值」。计数器场景一般不在乎这点，但如果你依赖精确值，就要小心。

### 一个关键优化：`@Contended` 避免伪共享

`Cell` 上标了 `@Contended`，意思是给这个对象做缓存行填充。为什么？CPU 缓存以缓存行（通常 64 字节）为单位，如果多个 `Cell` 恰好挤在同一个缓存行里，一个线程改了 Cell A，会让 Cell B 所在的整行缓存失效——别的 CPU 读 Cell B 就得到主存重新拉，这就是**伪共享**，会让「分散竞争」的好处全白费。`@Contended` 在 Cell 前后塞填充，让每个 Cell 独占缓存行，从根上避免这个问题。

代价是占更多内存。所以这是典型的**空间换时间**。

### 性能对比与选型

| 并发程度           | `AtomicLong` | `LongAdder`                       |
| ------------------ | ------------ | --------------------------------- |
| 低并发（1-2 线程） | 好           | 略差（Cell 数组初始化、求和开销） |
| 中并发（4-8 线程） | 自旋变多     | 明显更优                          |
| 高并发（16+ 线程） | 严重退化     | 优势巨大                          |

选型就两条：

- **要精确值、要 `compareAndSet` 语义**：用 `AtomicLong`。`LongAdder` 没有对外暴露 CAS，也不能保证强一致读。
- **高并发、写多读少的统计计数**：用 `LongAdder`。比如 QPS、访问量、限流计数这类「写极多、偶尔读一次」的场景，它就是为这个设计的。

> 一句话：低并发、要精确、要 CAS 条件更新 → `AtomicLong`；高并发纯累加计数 → `LongAdder`。别一看到计数就无脑 `LongAdder`，也别在低并发场景下被它的初始化开销拖累。

累加器里还有个更通用的 `LongAccumulator`，它不限定加法，传一个二元函数和一个初始值就行（比如传 `Long::max` 就能维护并发下的最大值）；`DoubleAdder` / `DoubleAccumulator` 是 `double` 版本，底层用 `long` 位存 `double` 的位模式。思路和 `LongAdder` 一脉相承，按需选用即可。

## 小结

- 原子类是把 CAS 自旋封装成易用 API 的工程化方案，定位是「单变量原子读写，又不想上锁」；多变量、复杂逻辑还是得回到锁。
- 家族分五类：基本类型、引用类型、数组类型、字段更新器、累加器。前四类都是「一个值 + CAS 自旋」，累加器是「分段 Cell 分散竞争」，路子不同。
- ABA 用 `AtomicStampedReference`（整数版本号）解决；`AtomicMarkableReference` 只是个带 `boolean` 标记的引用，**不能**解决 ABA——这个错误说法要主动驳掉。
- `AtomicIntegerFieldUpdater` 用反射原子更新已有 `volatile` 字段，省内存但有「必须 volatile、类型严格匹配、可访问、实例字段」一堆限制。
- `AtomicLong` 高并发下所有线程抢同一个值，自旋风暴；`LongAdder` 用 `base + Cell[]` 分段、`@Contended` 避免伪共享，写多读少高并发计数碾压 `AtomicLong`，但 `sum()` 非强一致、无 CAS。选型看「要不要精确值/CAS 语义」。

## 参考

基于公开 Java 并发教材、`java.util.concurrent.atomic` 包 API 文档与 OpenJDK 源码（`AtomicInteger`、`Striped64`/`LongAdder` 实现）整理，并对「`AtomicMarkableReference` 能否解决 ABA」「原子类分类是否包含累加器」等常见说法做了源码层面的核对与纠偏。
