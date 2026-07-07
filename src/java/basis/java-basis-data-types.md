---
title: "基本类型和包装类型有什么区别？缓存机制是怎么回事？"
description: "从存储、默认值到 Integer 缓存和浮点精度，讲清基本类型与包装类型的坑。"
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
  { text: "Java 是编译型语言还是解释型语言？", link: "/java/basis/java-basis-compile-and-run.html" }
next:
  {
    text: "final、static、不可变对象到底怎么理解？",
    link: "/java/basis/java-basis-final-static-immutable.html",
  }
---

# 基本类型和包装类型有什么区别？缓存机制是怎么回事？

> `int` 和 `Integer` 看着只差一个大小写，背后却牵出存储位置、默认值、`==` 比较、缓存、装箱拆箱一整串坑。这篇把它们一次讲透。

## 先认全 8 种基本类型

Java 里就 8 种基本数据类型，记忆上可以分三类：4 种整数、2 种浮点、外加字符和布尔各一种。

| 类型      | 位数 | 字节 | 默认值     | 取值范围                                |
| :-------- | :--- | :--- | :--------- | :-------------------------------------- |
| `byte`    | 8    | 1    | 0          | -128 ~ 127                              |
| `short`   | 16   | 2    | 0          | -2^15 ~ 2^15-1（-32768 ~ 32767）        |
| `int`     | 32   | 4    | 0          | -2^31 ~ 2^31-1（约 ±21 亿）             |
| `long`    | 64   | 8    | 0L         | -2^63 ~ 2^63-1                          |
| `char`    | 16   | 2    | `'\u0000'` | 0 ~ 65535                               |
| `float`   | 32   | 4    | 0.0f       | 绝对值约 1.4E-45 ~ 3.4E38（可正可负）   |
| `double`  | 64   | 8    | 0.0d       | 绝对值约 4.9E-324 ~ 1.8E308（可正可负） |
| `boolean` | —    | —    | false      | true / false                            |

几个容易被表格误导的点，得单独说清楚：

- **整数最大值为什么都要减 1**：用的是补码表示法，最高位当符号位（0 正 1 负）。正数最大就是符号位 0、其余全 1，再加 1 就溢出变成负数，所以正向比负向少一个数（`int` 能到 -2^31 但只能到 2^31-1）。
- **`float`/`double` 的范围别只看那个小数**。表里常写「1.4E-45 ~ 3.4E38」，很多人误以为这是整个取值范围，其实 `1.4E-45` 是能表示的**最小正数**（离 0 最近的非零值），`3.4E38` 才是**最大值**，而且浮点数是有正负的。完整地说，`float` 能表示的范围是约 ±3.4E38。
- **`boolean` 到底占几位，规范没规定**。逻辑上一个 bit 就够，但实际由 JVM 厂商实现决定：单个 `boolean` 往往按一个 `int`（4 字节）对待，`boolean[]` 则可能按 `byte` 压缩。所以「boolean 占 1 位」只是逻辑理解，别当成确定的字节数去背。
- **`char` 占 2 字节**（16 位无符号），存的是 UTF-16 编码单元，所以中文一个字符也能塞进一个 `char`。

还有两个语法细节：`long` 字面量结尾要加 `L`（不加会先当 `int` 解析，可能溢出）；`float` 字面量结尾要加 `f`/`F`（不加默认是 `double`，赋给 `float` 直接编译不过）。

这 8 种类型各有对应的包装类：`Byte`、`Short`、`Integer`、`Long`、`Float`、`Double`、`Character`、`Boolean`（注意 `int`→`Integer`、`char`→`Character` 不是简单首字母大写）。

## 基本类型和包装类型到底差在哪

一句话概括：**基本类型是「值」，包装类型是「对象」。** 这个本质差异往下衍生出四点区别。

| 维度      | 基本类型（如 `int`）                       | 包装类型（如 `Integer`）                        |
| :-------- | :----------------------------------------- | :---------------------------------------------- |
| 存储      | 看作用域：局部变量在栈，成员变量随对象在堆 | 对象，实例在堆，变量持有引用                    |
| 默认值    | 有默认值（0、false、`'\u0000'`…）          | 引用默认是 `null`                               |
| 比较      | `==` 比的是值                              | `==` 比的是引用地址，比值要用 `equals` 或先拆箱 |
| 泛型/集合 | 不能做泛型参数，`List<int>` 不合法         | 可以，`List<Integer>` 才行                      |

关于「存储位置」，有个流传很广的说法是「基本类型都在栈上」，这并不准确。**基本类型的存储位置取决于它是局部变量还是成员变量**：

```java
public class Test {
    int a = 10;          // 成员变量，随对象存在堆里
    static int b = 20;   // 静态变量，属于类，存在堆里（JDK 7 后）

    public void m() {
        int c = 30;      // 局部变量，才在栈里
    }
}
```

进一步说，即便是堆上分配，HotSpot 开了逃逸分析后，如果发现某个对象没逃出方法，还可能通过标量替换做栈上分配。所以「对象一定在堆」也只是通常情况，不是铁律。面试时说清「局部变量在栈、成员变量随对象在堆」这个层次就够扎实了。

## Integer 的缓存机制：127 是 true，128 是 false

这是最经典的一道细节题，先看现象：

```java
Integer a = 127, b = 127;
System.out.println(a == b);   // true

Integer c = 128, d = 128;
System.out.println(c == d);   // false
```

同样是两个相等的 `Integer`，为什么 127 相等、128 就不等了？答案在 `Integer.valueOf` 的缓存：

```java
public static Integer valueOf(int i) {
    if (i >= IntegerCache.low && i <= IntegerCache.high)
        return IntegerCache.cache[i + (-IntegerCache.low)]; // 命中缓存，返回同一个对象
    return new Integer(i);                                   // 未命中，new 一个新对象
}
```

`Integer a = 127` 会被编译器改写成 `Integer a = Integer.valueOf(127)`（这就是自动装箱），而 `IntegerCache` 默认缓存了 **-128 ~ 127** 这 256 个对象。所以 127 落在缓存里，`a` 和 `b` 拿到的是同一个实例，`==` 自然 `true`；128 超出缓存，各自 `new` 出新对象，地址不同，`==` 就是 `false` 了。

各包装类的缓存范围记一下（有的资料只笼统说「-128~127」，其实 `Character` 不一样）：

| 包装类                                | 缓存范围   | 备注                                                            |
| :------------------------------------ | :--------- | :-------------------------------------------------------------- |
| `Byte` / `Short` / `Integer` / `Long` | -128 ~ 127 | 只有 `Integer` 上界能用 `-XX:AutoBoxCacheMax` 调大              |
| `Character`                           | 0 ~ 127    | `char` 无负数，下界是 0                                         |
| `Boolean`                             | 全部       | 直接返回预定义的 `TRUE` / `FALSE`，没有「范围」概念             |
| `Float` / `Double`                    | 无缓存     | 连续区间没法枚举缓存，所以 `Float x=1f,y=1f; x==y` 也是 `false` |

再看两个衍生坑：

**一是 `valueOf` 走缓存，`new` 永远不走。**

```java
Integer i1 = 40;                  // 走缓存
Integer i2 = new Integer(40);     // 强制 new，全新对象
System.out.println(i1 == i2);     // false
```

`new Integer(40)` 绕开了 `valueOf`，直接在堆上造对象，哪怕值在缓存范围内也和缓存实例不是同一个。顺带一提，`new Integer(int)` 这类构造器从 **JDK 9 起就被标记为 `@Deprecated`**（JDK 16 更是标为 `forRemoval`），官方明确建议改用 `Integer.valueOf(int)`，一来能享受缓存、更省内存，二来语义更清楚。所以现在写代码根本不该出现 `new Integer(...)`。

**二是别依赖缓存写业务逻辑。** 缓存的存在是为了性能优化，不是让你拿 `==` 比值的。正确姿势永远是：**包装类型比值用 `equals`，或者先拆箱成基本类型再用 `==`**。别写出「反正值小于 128，用 `==` 也对」这种代码，一旦值变大就是隐藏的线上 bug。

## 自动装箱与拆箱：语法糖背后的代价

装箱和拆箱说白了是编译器帮你插的调用，本质是两个方法：

- 装箱：`int` → `Integer`，编译器插入 `Integer.valueOf(i)`
- 拆箱：`Integer` → `int`，编译器插入 `i.intValue()`

```java
Integer i = 10;   // 装箱 → Integer.valueOf(10)
int n = i;        // 拆箱 → i.intValue()
```

反编译字节码能看到 `INVOKESTATIC Integer.valueOf` 和 `INVOKEVIRTUAL Integer.intValue`，跟上面对得上。理解了这层，两个高频坑就一目了然：

**坑一：循环里频繁装箱，性能被悄悄吃掉。**

```java
Long sum = 0L;                                  // 类型写成了包装类 Long
for (long i = 0; i <= Integer.MAX_VALUE; i++) {
    sum += i;   // 每次 sum+=i 都要：拆箱 sum → 相加 → 再装箱回 Long
}
```

`sum` 本该用基本类型 `long`，结果写成了 `Long`。循环体里每次 `+=` 都要拆一次、装一次，21 亿次循环凭空造出海量临时 `Long` 对象，既慢又给 GC 添负担。**能用基本类型的地方就别用包装类型**，尤其是循环变量和累加器。

**坑二：拆箱遇到 `null`，直接 NPE。**

```java
Integer i = null;
int j = i;        // 等价于 i.intValue()，i 是 null → NullPointerException
```

`int j = i` 会被编译成 `i.intValue()`，对 `null` 调方法必然空指针。这个坑在实际项目里特别隐蔽：从数据库查出来的字段、Map 里 `get` 出来的值，都可能是 `null` 包装类型，一旦被赋给基本类型变量（或参与算术运算触发拆箱）就爆。所以从可能为 `null` 的来源取值时，要么保留包装类型并做判空，要么给个默认值再拆箱。

## 浮点数为什么会精度丢失，怎么解决

先看个反直觉的例子：

```java
float a = 2.0f - 1.9f;   // 0.100000024
float b = 1.8f - 1.7f;   // 0.099999905
System.out.println(a == b);  // false
```

两个「都等于 0.1」的减法结果居然不相等。**根因是二进制没法精确表示大多数十进制小数**。计算机用有限位的二进制存小数，而像 0.1、0.2 这种换成二进制是无限循环的，存进去只能截断，误差就此产生。以 0.2 为例：

```text
0.2 * 2 = 0.4 → 0
0.4 * 2 = 0.8 → 0
0.8 * 2 = 1.6 → 1
0.6 * 2 = 1.2 → 1
0.2 * 2 = 0.4 → 0   （开始循环，永远除不尽）
```

所以只要是钱、计价、对账这类不容许误差的场景，**绝对不能用 `float`/`double` 直接算**，得请出 `BigDecimal`。但用 `BigDecimal` 有两个必须守住的规矩：

**规矩一：用字符串构造，别用 double 构造。**

```java
BigDecimal wrong = new BigDecimal(0.1);      // 0.1000000000000000055511151231257827021181583404541015625
BigDecimal right = new BigDecimal("0.1");    // 正好是 0.1
```

`new BigDecimal(0.1)` 传进去的 `0.1` 本身已经是个带误差的 `double`，`BigDecimal` 只是忠实地把这个误差记录下来，等于白搭。传字符串 `"0.1"` 才能拿到精确值。（如果手头只有 `double`，可以用 `BigDecimal.valueOf(double)`，它内部走 `Double.toString`，结果也是干净的。）

**规矩二：比值用 `compareTo`，别用 `equals`。**

```java
BigDecimal x = new BigDecimal("1");
BigDecimal y = new BigDecimal("1.0");
System.out.println(x.equals(y));        // false！
System.out.println(x.compareTo(y) == 0); // true
```

`equals` 会连**精度（scale）**一起比：`"1"` 的 scale 是 0，`"1.0"` 的 scale 是 1，值虽相等但精度不同，`equals` 判 `false`。而 `compareTo` 只比数值大小、忽略精度，返回 0 才代表值相等。记口诀：**基本浮点类型不能用 `==` 比，包装/`BigDecimal` 不能用 `equals` 比值。**

至于超过 `long`（64 位）范围的大整数，则用 `BigInteger`，它内部用 `int[]` 存任意长度的整数，代价是运算比原生整型慢。

## 顺带两个小点：变量默认值与字符常量

**成员变量有默认值，局部变量没有。** 成员变量不显式赋值也会被自动初始化成类型默认值（数值 0、`boolean` false、引用 `null`），这是为了保证对象状态可预测、不会读到内存里的垃圾值；局部变量则要求「使用前必须赋值」，否则编译不过——因为编译器能在方法内确切追踪它有没有被赋过值，索性强制你写清楚。

**字符常量 vs 字符串常量：**

- `'A'` 是字符常量，单引号，本质是一个整型（Unicode 码点），能直接参与算术运算，如 `'A' + 1 == 66`。
- `"A"` 是字符串常量，双引号，是个 `String` 对象，变量拿到的是引用（地址）。
- 占用上：`char` 固定 2 字节；字符串按内容和编码而定，`"Hello, world!"` 用 `getBytes()`（默认 UTF-8）取到 13 字节。

## 容易踩的坑

- 用 `==` 比较两个 `Integer`：小于 128 时「碰巧」对，大于等于 128 就错，本质是缓存在起作用。比值一律 `equals` 或拆箱。
- `new Integer(...)` 不走缓存、且 JDK 9 起已废弃，别再用，改 `Integer.valueOf(...)`。
- 把 `null` 的包装类型赋给基本类型或让它参与运算，触发拆箱直接 NPE。
- 循环里用包装类型当累加器，反复装箱拆箱拖慢性能还压 GC。
- `new BigDecimal(0.1)` 把 double 的误差原样带进来；比值用 `equals` 会因 scale 不同而误判。
- 把浮点表格里的 `1.4E-45` 当成 `float` 的下限——那是最小正数，不是最负的数。

## 小结

1. 8 种基本类型要能报出字节数与范围；`boolean` 的实际大小规范未定，别硬背；`char` 占 2 字节。
2. 基本类型是值、包装类型是对象，差异体现在存储、默认值（0 vs null）、比较（`==` 比值 vs 比引用）、能否用于泛型。
3. `Byte/Short/Integer/Long` 缓存 -128~127，`Character` 缓存 0~127，`Boolean` 全缓存，`Float/Double` 无缓存；`valueOf` 走缓存、`new` 不走。
4. 装箱是 `valueOf`、拆箱是 `intValue`；警惕循环里的频繁装箱和 `null` 拆箱 NPE。
5. 浮点精度丢失源于二进制无法精确表示小数，精确计算用 `BigDecimal` 且必须字符串构造、`compareTo` 比值。

## 参考

综合自项目内 Java 基础资料的基本数据类型与变量章节、BigDecimal 专题，并做了如下核对与修正：补充了 `new Integer(int)` 自 JDK 9 废弃这一事实；澄清了浮点范围表中 `1.4E-45` 是最小正数而非取值下限；明确了 `boolean` 大小由 JVM 实现决定、规范未规定；订正了 `char` 默认值应写作 `'\u0000'`；`Character` 缓存范围为 0~127 而非 -128~127。
