---
title: "final、static、不可变对象到底怎么理解？"
description: "从变量绑定、类成员和对象状态讲清 final/static 与不可变设计。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "基础"
  - "高频"
  - "细节题"
prev:
  {
    text: "基本类型和包装类型有什么区别？缓存机制是怎么回事？",
    link: "/java/basis/java-basis-data-types.html",
  }
next: { text: "为什么说 Java 只有值传递？", link: "/java/basis/java-basis-pass-by-value.html" }
---

# final、static、不可变对象到底怎么理解？

> `final` 管“能不能再换”，`static` 管“属于谁”，不可变对象管“对象状态会不会被改”。

## 这三个概念先拆开

面试里经常把 `final`、`static final`、不可变对象混在一起问。它们不是一层东西：

| 概念       | 关注点                   | 一句话                               |
| ---------- | ------------------------ | ------------------------------------ |
| `final`    | 变量、方法、类能不能变化 | 引用不能换，不代表对象内容不能变     |
| `static`   | 成员属于类还是对象       | 静态成员属于类，被所有实例共享       |
| 不可变对象 | 对象创建后状态能不能变   | 依赖封装、防御性拷贝和不暴露修改入口 |

看一个最容易答错的例子：

```java
final List<String> names = new ArrayList<>();
names.add("Tom");              // 可以
// names = new ArrayList<>();  // 编译失败
```

`final` 限制的是变量 `names` 不能再指向另一个 `List`，但这个 `List` 自己还是可变对象。这和 [Java 只有值传递](/java/basis/java-basis-pass-by-value.html) 里讲的引用值拷贝是同一套理解：变量里放的是引用值，`final` 锁住的是这个引用值。

## final 到底限制了什么

`final` 可以修饰变量、方法和类。

| 位置         | 语义                                     | 典型用途             |
| ------------ | ---------------------------------------- | -------------------- |
| 基本类型变量 | 值不能再改                               | 局部常量             |
| 引用类型变量 | 引用不能再指向别的对象                   | 固定依赖、避免误赋值 |
| 字段         | 必须在声明处、初始化块或构造器里完成赋值 | 不可变设计的一部分   |
| 方法         | 子类不能重写                             | 保持父类方法语义     |
| 类           | 不能被继承                               | 防止子类破坏约束     |

再看代码：

```java
final int age = 18;
// age = 20; // 编译失败

final List<String> roles = new ArrayList<>();
roles.add("admin"); // 可以，roles 指向的对象没换

final class Money {
}
```

`final` 字段还有一个工程价值：它能让对象构造后的状态更稳定，减少“先 new 出来，后面再一点点补字段”的不确定性。但它只是不可变对象的必要条件之一，不是充分条件。

## static 到底属于谁

`static` 修饰的成员属于类，不属于某一个对象实例。多个对象看到的是同一份静态变量：

```java
class Counter {
    static int total;
    String name;

    Counter(String name) {
        this.name = name;
        total++;
    }
}
```

`new Counter("a")` 和 `new Counter("b")` 会得到两个不同的 `name`，但共享同一个 `Counter.total`。

静态方法也属于类，所以它不能直接访问实例字段：

```java
class User {
    private String name;

    static void print() {
        // System.out.println(name); // 编译失败：没有具体对象
    }
}
```

还有一个常见坑：`static` 方法不能被重写。子类声明同名静态方法，只是“隐藏”父类静态方法，不参与运行时多态。关于重写和多态，可以和 [面向对象那篇](/java/basis/java-basis-oop.html) 连起来看。

## static 代码块和初始化顺序怎么判断

静态初始化发生在类初始化阶段，不一定只有第一次 `new` 才触发。比如 `Class.forName()`、访问某些非编译期常量静态字段，也可能触发类初始化。

同一个类里，静态字段和静态代码块按源码顺序执行：

```java
class AppConfig {
    static String env = loadEnv();

    static {
        System.out.println("init config");
    }
}
```

父子类创建对象时，可以按这条顺序记：

```text
父类静态初始化
  ↓
子类静态初始化
  ↓
父类实例字段 / 实例代码块
  ↓
父类构造方法
  ↓
子类实例字段 / 实例代码块
  ↓
子类构造方法
```

静态初始化只跟类有关，实例初始化才跟每次 `new` 有关。

## static final 一定是常量吗

不一定。

```java
public static final int MAX_RETRY = 3;
public static final List<String> ROLES = new ArrayList<>();
```

`MAX_RETRY` 是典型常量；`ROLES` 不是安全常量。`final` 只保证 `ROLES` 这个引用不能换，集合内容仍然能被改：

```java
ROLES.add("admin"); // 可以，且影响全局
```

所以生产代码里要区分：

- 基本类型、`String`、枚举这类不可变值，适合做 `static final` 常量。
- 集合常量优先用 `List.of(...)`、`Set.of(...)`，或返回防御性拷贝。
- 共享可变对象不要随便暴露成 `public static final`。

## 不可变对象应该怎么设计

不可变对象的目标是：对象创建后，对外可观察状态不再变化。

常见做法：

1. 类声明为 `final`，或者确保没有可被子类破坏的不安全方法。
2. 字段使用 `private final`。
3. 构造器里完成校验和赋值。
4. 不提供 setter。
5. 对可变入参做防御性拷贝。
6. 返回可变字段时，也返回拷贝或不可变视图。

错误示例：

```java
final class Period {
    private final Date start;
    private final Date end;

    Period(Date start, Date end) {
        this.start = start;
        this.end = end;
    }

    Date start() {
        return start;
    }
}
```

即使字段是 `final`，外部仍然可以通过传入的 `Date` 引用或返回的 `Date` 引用修改时间。更稳的写法是拷贝：

```java
final class Period {
    private final Date start;
    private final Date end;

    Period(Date start, Date end) {
        this.start = new Date(start.getTime());
        this.end = new Date(end.getTime());
    }

    Date start() {
        return new Date(start.getTime());
    }
}
```

如果能用 `LocalDateTime`、`Instant` 这类不可变时间类型，就比 `Date` 更省心。

## String 为什么是不可变对象

`String` 的不可变不是因为“内部数组用了 `final`”这么简单。`final` 数组引用挡不住数组元素被改。

更准确的原因是组合拳：

- `String` 类本身是 `final`，不能被子类破坏语义。
- 内部存储字段是私有的。
- 不暴露修改内部内容的方法。
- 任何看似修改字符串的操作都会返回新对象。
- JDK 9 之后底层实现已经从 `char[]` 调整为 `byte[] + coder`，老资料只背 `char[]` 会过时。

更完整的字符串常量池、拼接和 `intern()` 细节，放在 [String 为什么不可变](/java/basis/java-basis-string.html) 里展开。

## 容易踩的坑

- `final` 引用不等于对象不可变，`final List` 仍然能 `add`。
- 字段全是 `final` 也不一定不可变，可变字段如果泄漏引用照样能被改。
- `static` 属于类，不属于对象，通过对象访问静态成员只是语法允许，不推荐。
- `static` 方法不是重写，运行时多态不作用于静态方法。
- 静态代码块不是只在第一次 `new` 时执行，类初始化触发方式不止一种。
- `String` 不可变不是靠 `final char[]` 单点保证，何况 JDK 9 后底层也不是老的 `char[]` 说法。

## 小结

1. `final` 限制变量绑定、方法重写和类继承，不直接等于对象不可变。
2. `static` 成员属于类，被所有实例共享，静态方法不能直接访问实例状态。
3. `static final` 修饰可变对象时，只是引用不能换，内容仍可能变。
4. 不可变对象靠封装、防御性拷贝、无修改入口和继承约束共同保证。
5. 面试回答要把“引用不能换”和“对象不能变”分开说。

## 参考

综合自本地资料《final, static, this, super 关键字总结》《Java 基础常见面试题总结》，并结合现有 String、值传递、面向对象文章校准了 `final` 引用、静态成员和不可变设计的边界。
