---
title: "对象拷贝怎么做？深浅拷贝和 Cloneable 有什么坑？"
description: "从浅拷贝边界、深拷贝方式到拷贝构造讲清对象复制的取舍。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "基础"
  - "细节题"
  - "高频"
prev:
  text: "强、软、弱、虚引用有什么区别？各自用在哪？"
  link: "/java/basis/java-basis-reference-type.html"
next:
  text: "面向对象三大特征、重载重写、接口与抽象类怎么理解？"
  link: "/java/basis/java-basis-oop.html"
---

# 对象拷贝怎么做？深浅拷贝和 Cloneable 有什么坑？

> 对象拷贝看似是 `clone()` 一行调用的事，真正的坑在「引用类型字段到底复制了没有」和「`Cloneable` 这个接口为什么不招人待见」。

## 先分清三种"拷贝"

面试一问对象拷贝，最容易混的就是"引用拷贝""浅拷贝""深拷贝"这三个词。先把边界画清楚：

| 拷贝方式 | 是否新建外层对象 | 引用类型字段 | 一句话                               |
| -------- | ---------------- | ------------ | ------------------------------------ |
| 引用拷贝 | 否               | 指向同一对象 | 只是变量名多了一个，对象还是原来那个 |
| 浅拷贝   | 是               | 仍是同一对象 | 外壳是新的，里面装的人还是原来那批   |
| 深拷贝   | 是               | 也是新对象   | 连内部对象一起换了一套全新的         |

用一个例子看最直观。假设：

```java
class Address {
    String city;
}

class Person {
    Address address;
}
```

- 引用拷贝：`Person p2 = p1;`，`p1` 和 `p2` 就是同一个对象，改 `p2.address.city`，`p1` 也看得到。这和 [Java 只有值传递](/java/basis/java-basis-pass-by-value.html) 里讲的"传的是引用值的副本"是同一回事。
- 浅拷贝：`p1` 复制成一个新的 `Person`，但 `address` 字段还指向原来的 `Address`，改 `copy.address.city` 会让 `p1` 跟着变。
- 深拷贝：连 `Address` 也新建一份，两边彻底独立。

判断是哪种，就看两件事：外层对象 `new` 没有；引用字段 `new` 没有。两个都 `new` 才叫深拷贝。

## Object.clone() 默认就是浅拷贝

Java 里实现拷贝最"原生"的方式是 `Cloneable` + `clone()`。但这里有个反直觉的设计先记牢：

- `Cloneable` 是个**标记接口**，里面一个方法都没有。
- 真正干活的是 `Object.clone()`，它是个 `protected native` 方法，默认做的是**逐字段拷贝**。
- 你不实现 `Cloneable` 直接调 `clone()`，会抛 `CloneNotSupportedException`；实现了，`super.clone()` 才正常返回。

也就是说，接口本身不提供能力，它只是给 `Object.clone()` 发了一张"允许调用"的通行证。

逐字段拷贝意味着：基本类型字段复制值，引用类型字段复制引用。所以默认就是浅拷贝：

```java
public class Address implements Cloneable {
    String city;
    @Override
    public Address clone() {
        try {
            return (Address) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError(); // 实现了 Cloneable 不会走到这里
        }
    }
}

public class Person implements Cloneable {
    Address address;
    @Override
    public Person clone() {
        try {
            return (Person) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}
```

测试：

```java
Person p1 = new Person(new Address("武汉"));
Person copy = p1.clone();
System.out.println(p1.getAddress() == copy.getAddress()); // true —— 同一个 Address
```

`==` 是 `true`，说明 `address` 字段没有真正复制，两边指向同一个 `Address`。这就是浅拷贝的直接后果。标准库里 `ArrayList.clone()` 也是这个路数——它新建了列表和底层数组，但元素引用还是原来那批，官方注释直接写明"元素本身不被复制"。

> 顺带纠个偏：有的资料把"实现了 `Cloneable`"描述成"具有拷贝能力，可以进行深拷贝或浅拷贝操作"。这个说法不严谨。`Cloneable` 只是让 `Object.clone()` 不抛异常，默认行为是浅拷贝；要深拷贝得自己在 `clone()` 里逐个把引用字段再 `clone` 一遍。

## 想要深拷贝，三种主流做法

### 1. 在 clone() 里手动补刀

最直接的深拷贝，是在 `super.clone()` 拿到浅拷贝后，再把每个引用字段单独复制：

```java
@Override
public Person clone() {
    try {
        Person copy = (Person) super.clone();
        copy.address = address.clone(); // 引用字段也 clone
        return copy;
    } catch (CloneNotSupportedException e) {
        throw new AssertionError();
    }
}
```

现在 `p1.getAddress() == copy.getAddress()` 变成 `false`，两边独立了。

缺点也很明显：每个引用字段都要记得手动 `clone`，而且这些字段自己的类也得支持克隆；嵌套一深就累人，漏一个就悄悄退回浅拷贝。

### 2. 拷贝构造器 / 静态工厂

不依赖 `Cloneable`，直接写一个"以同类型对象为参数"的构造器：

```java
public class Person {
    Address address;

    // 拷贝构造器
    public Person(Person other) {
        this.address = new Address(other.address); // Address 同样提供拷贝构造
    }

    // 或包成静态工厂
    public static Person copyOf(Person other) {
        return new Person(other);
    }
}
```

用起来就是 `Person copy = new Person(p1);`。这是集合框架的常用套路：`new ArrayList<>(list)`、`new HashMap<>(map)` 都是拷贝构造，而且 `new ArrayList<>(collection)` 还能接收任意 `Collection` 子类。它的优势放到后面专门对比。

### 3. 序列化往返

实现 `Serializable`，把对象先序列化成字节流再反序列化回来，得到的就是一份完全独立的深拷贝。因为序列化会沿着对象图走一遍，反序列化时整套对象重新 `new` 出来：

```java
public Person deepCopy() throws Exception {
    // 序列化
    ByteArrayOutputStream bos = new ByteArrayOutputStream();
    try (ObjectOutputStream oos = new ObjectOutputStream(bos)) {
        oos.writeObject(this);
    }
    // 反序列化
    try (ObjectInputStream ois = new ObjectInputStream(
            new ByteArrayInputStream(bos.toByteArray()))) {
        return (Person) ois.readObject();
    }
}
```

前提是对象图里所有对象都实现 `Serializable`，否则抛 `NotSerializableException`。这种方式不用手写每个字段，但开销大、要求整个引用图可序列化。Java 原生序列化本身的坑（`serialVersionUID`、安全风险、版本耦合）放在 [序列化那篇](/java/basis/java-basis-serialization.html) 展开。

三种方式放一起对比：

| 方式                  | 实现成本                 | 约束                                       | 适合场景                   |
| --------------------- | ------------------------ | ------------------------------------------ | -------------------------- |
| 手动 clone 逐字段补   | 中，每个引用字段都要照顾 | 类要实现 `Cloneable`，引用字段也要支持克隆 | 结构简单、引用层级浅       |
| 拷贝构造器 / 静态工厂 | 低，一个构造器搞定       | 无需标记接口，能配合 `final` 字段          | 日常业务对象、集合拷贝     |
| 序列化往返            | 低代码量，高运行开销     | 整个对象图都要 `Serializable`              | 引用图深、不想手写每个字段 |

## 数组的 clone 有个反直觉的结论

数组也支持 `clone()`，它默认也是浅拷贝：复制数组结构，但不复制元素本身。但对基本类型数组来说，"元素是值不是引用"，所以浅拷贝出来的就是一份完全独立的副本：

```java
int[] a = {1, 2, 3};
int[] b = a.clone();
b[0] = 99;
System.out.println(a[0]); // 1，没被影响 —— 基本类型数组 clone 等价于深拷贝
```

换成引用类型数组就回到浅拷贝：

```java
Person[] arr = {new Person(new Address("武汉"))};
Person[] copy = arr.clone();
System.out.println(arr[0] == copy[0]);                 // true —— 同一个 Person
System.out.println(arr[0].address == copy[0].address);  // true —— 同一个 Address
```

所以"数组 `clone()` 是浅拷贝"没错，但要补一句：基本类型数组因为元素本身没有引用可言，浅拷贝出来的效果就等于深拷贝。

## 为什么 Cloneable 一直被诟病

`Cloneable` 在设计圈口碑不好，主要这么几条。

**一，它是个"带魔法"的标记接口。** `Cloneable` 自己没有 `clone()` 方法，却能改变 `Object.clone()` 的行为——没实现它就抛 `CloneNotSupportedException`。一个子接口去改父类方法的语义，这种模式在标准库里独一份，理解起来很别扭。

**二，`clone()` 不调用构造器。** `Object.clone()` 是 `native` 的，走的是内存级字段拷贝，对象的构造函数根本不会执行。这意味着你在构造器里做的参数校验、不变式建立、id 生成等逻辑，在 `clone` 出来的对象上一概不生效，很容易造出"状态不合法"的对象。

**三，`final` 字段在 `clone()` 里没法重新赋值。** 这是最硬的伤。`super.clone()` 已经把 `final` 字段按原值拷过来了，你想深拷贝一个 `final` 引用字段时却发现赋不了值：

```java
public class Person implements Cloneable {
    private final Address address; // final 字段

    public Person(Address address) {
        this.address = address;
    }

    @Override
    public Person clone() {
        Person copy = (Person) super.clone();
        // copy.address = address.clone(); // 编译失败：final 字段无法赋值
        return copy; // 只能返回浅拷贝
    }
}
```

深拷贝和 `final` 直接打架——要么放弃深拷贝，要么放弃 `final`，要么上反射 `setAccessible` 强写（脆弱且不推荐）。可偏偏不可变对象该是 `final` 字段的典型用户，结果恰恰最难深拷贝。

> 业界对 `Cloneable` 的通行结论是：这个接口设计上有缺陷，能不用就不用。一个接口既不声明方法、又依赖 `Object` 里的 `protected` 实现、还和构造器、`final` 语义冲突，维护成本远大于收益。

## 替代方案：拷贝构造器和静态工厂更稳

既然 `Cloneable` 这么多坑，替代方案就是拷贝构造器或静态工厂：

```java
public class Person {
    private final Address address;

    public Person(Person other) {
        this.address = new Address(other.address); // final 字段在构造器里正常处理
    }

    public static Person copyOf(Person other) {
        return new Person(other);
    }
}
```

它的优势对照 `Cloneable` 看就很清楚：

| 维度             | Cloneable + clone()         | 拷贝构造器 / 静态工厂                            |
| ---------------- | --------------------------- | ------------------------------------------------ |
| 是否需要标记接口 | 必须实现 `Cloneable`        | 不需要                                           |
| 是否调用构造器   | 否，native 内存拷贝         | 是，走正常构造逻辑                               |
| `final` 字段     | 无法深拷贝重赋值            | 在构造器里正常处理                               |
| 不变式 / 校验    | 绕过，需手动补              | 构造器里自然保证                                 |
| 类型约束         | 只能返回同类型，协变靠强转  | 可接收接口类型，如 `new ArrayList<>(Collection)` |
| 误用风险         | 漏 clone 某字段就退回浅拷贝 | 编译器能帮你查字段                               |

实际工程里，`new ArrayList<>(list)`、`List.copyOf(list)` 这类 API 早就示范了：拷贝构造和静态工厂比 `Cloneable` 更安全、更好用，`clone()` 反而少见。

## 小结

- 判断拷贝类型看两点：外层对象 `new` 没有、引用字段 `new` 没有；两个都 `new` 才是深拷贝，只 `new` 外层是浅拷贝，都不 `new` 是引用拷贝。
- `Cloneable` 是无方法的标记接口，`Object.clone()` 默认逐字段拷贝即浅拷贝；不实现就抛 `CloneNotSupportedException`。
- 深拷贝三条路：`clone()` 里逐字段补、拷贝构造器 / 静态工厂、序列化往返；日常优先拷贝构造。
- 数组 `clone()` 是浅拷贝，但基本类型数组因元素是值，效果等价深拷贝。
- `Cloneable` 被诟病主因：接口有魔法却无方法、`clone()` 不走构造器、`final` 字段无法深拷贝重赋值，能用拷贝构造器就别用 `Cloneable`。

## 参考

综合对象拷贝相关的常见论述与集合类 `clone` 源码注释，对照 JDK 中 `Object.clone`、`Cloneable` 接口源码逐条核对浅拷贝边界、`final` 字段无法重赋值、`clone` 不调用构造器等结论，并补充了业界对 `Cloneable` 设计缺陷的通行分析。
