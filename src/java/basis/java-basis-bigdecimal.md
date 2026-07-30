---
title: "BigDecimal 怎么用才不丢精度？"
description: "从精度、舍入模式到 equals 陷阱讲清 BigDecimal 使用要点。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "高频"
  - "细节题"
  - "项目实战"
prev:
  text: "基本类型和包装类型有什么区别？缓存机制是怎么回事？"
  link: "/java/basis/java-basis-data-types.html"
next:
  text: "final、static、不可变对象到底怎么理解？"
  link: "/java/basis/java-basis-final-static-immutable.html"
---

# BigDecimal 怎么用才不丢精度？

写 Java 的人迟早会遇到一个"诡异"现象：`0.1 + 0.2` 用 `double` 算出来不是 `0.3` 而是 `0.30000000000000004`。这不是 bug，是浮点数本身的限制——而 `BigDecimal` 就是用来兜住这个限制的。

## 为什么 float/double 会丢精度

计算机用二进制存小数，而很多十进制小数（比如 0.2）没法精确表示成有限位二进制，只能截断，于是有了精度损失。

```java
float a = 2.0f - 1.9f; // 0.100000024
float b = 1.8f - 1.7f; // 0.099999905
System.out.println(a == b); // false
```

本质：`float` / `double` 是 IEEE 754 浮点数，有效位有限，近似存储；涉及金额、对账这类要求精确的场景，必须用 `BigDecimal`。

## 怎么创建：别用 double 构造

`BigDecimal` 有几种构造方式，坑就坑在用 `double` 构造：

```java
BigDecimal a = new BigDecimal(0.1);   // 0.1000000000000000055511151231257827021181583404541015625
BigDecimal b = new BigDecimal("0.1"); // 0.1
```

`new BigDecimal(double)` 会把 double 已经丢失精度的值"忠实"记录下来，反而更不准。推荐两种：

- `new BigDecimal(String)`：用字符串，精确。
- `BigDecimal.valueOf(double)`：内部先 `Double.toString` 再解析，等价于字符串构造。

> 记住一句话：**金额场景一律字符串构造**，别用 `new BigDecimal(0.1)`。

## 加减乘除与舍入模式

`BigDecimal` 是不可变对象，运算返回新对象：

```java
BigDecimal x = new BigDecimal("1.0");
BigDecimal y = new BigDecimal("0.9");
x.add(y);       // 1.9
x.subtract(y);  // 0.1
x.multiply(y);  // 0.90
x.divide(y);    // 除不尽，抛 ArithmeticException
```

`divide` 是最大坑点：除不尽会直接抛 `ArithmeticException`。必须用三参版本指定精度和舍入模式：

```java
x.divide(y, 2, RoundingMode.HALF_UP); // 1.11
```

常用舍入模式：

| 模式        | 含义                 | 举例（保留 0 位）  |
| ----------- | -------------------- | ------------------ |
| `UP`        | 远离零进位           | 2.4 → 3，-2.4 → -3 |
| `DOWN`      | 向零截断             | 2.6 → 2，-2.6 → -2 |
| `CEILING`   | 向正无穷进位         | 2.4 → 3，-2.4 → -2 |
| `FLOOR`     | 向负无穷进位         | 2.6 → 2，-2.6 → -3 |
| `HALF_UP`   | 四舍五入             | 2.5 → 3            |
| `HALF_EVEN` | 银行家舍入（五成双） | 2.5 → 2，3.5 → 4   |

`HALF_UP` 是最常见的"四舍五入"；`HALF_EVEN` 是银行家舍入，统计上更公平，金融场景常用。**千万别用 `UNNECESSARY`**——它表示"预期正好除尽，否则抛异常"，除不尽时直接炸。

## 比较：用 compareTo 不要用 equals

```java
BigDecimal a = new BigDecimal("1");
BigDecimal b = new BigDecimal("1.0");
a.equals(b);    // false —— scale 不同（1 的 scale=0，1.0 的 scale=1）
a.compareTo(b); // 0    —— 只比数值
```

`equals` 既比值又比精度（scale），`1` 和 `1.0` 不等；`compareTo` 只比值。**比较大小一律用 `compareTo`**，返回 -1/0/1。

## 性能与工程注意

- 不可变：每次运算都 new 新对象，循环里高频计算要注意对象开销。
- scale 要统一：加减乘会按规则定 scale，除法要手动指定，否则除不尽抛异常。
- 金额落地：很多团队用"分"存 `long`，避免 BigDecimal 开销；只有展示 / 复杂运算才用 BigDecimal。
- `setScale`：单独调整精度，`m.setScale(2, RoundingMode.HALF_UP)`。

## 小结

- float / double 是二进制浮点，存不了精确十进制小数，金额场景必用 BigDecimal。
- 创建用 `new BigDecimal(String)` 或 `BigDecimal.valueOf(double)`，别用 `new BigDecimal(double)`。
- divide 除不尽会抛异常，必须指定 scale + RoundingMode；常用 HALF_UP，金融用 HALF_EVEN，禁用 UNNECESSARY。
- 比较大小用 `compareTo`，别用 `equals`——后者会比 scale 导致 1 ≠ 1.0。
- 不可变对象每次运算都 new，循环里注意开销；也可用 long 存"分"替代。

## 参考

本文综合公开 Java 基础教材与 BigDecimal 官方 API 文档，核对了浮点精度成因、构造方式取舍、舍入模式语义与 equals / compareTo 差异，并对照了金额计算的工程实践。
