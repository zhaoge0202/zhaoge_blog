---
title: "反射是什么？注解又是怎么靠反射工作的？"
description: "讲清反射的能力与代价，以及注解如何通过保留策略被反射在运行时读取。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "高频"
  - "进阶"
  - "原理深入"
prev: { text: "泛型是什么？类型擦除会带来哪些坑？", link: "/java/basis/java-basis-generics.html" }
next:
  { text: "JDK 动态代理和 CGLIB 有什么区别？", link: "/java/basis/java-basis-dynamic-proxy.html" }
---

# 反射是什么？注解又是怎么靠反射工作的？

> 反射让程序在运行时"反观自身"；注解则是贴在代码上的标签，本身不干活，得靠反射在运行时把它读出来才生效。这一篇把两者串起来讲清楚。

## 反射到底给了我们什么能力

平时写代码，编译期就把一切定死了：调哪个方法、访问哪个字段、`new` 哪个类，编译器都能查得明明白白。反射（Reflection）打破的正是这个"编译期定死"的前提——它让你在**运行时**才去探知一个类长什么样：有哪些方法、哪些字段、什么构造器，然后动态地创建对象、调用方法、读写字段，哪怕这些成员是 `private` 的。

一句话概括反射的四项能力：

- 运行时拿到一个类的完整结构信息（`Class`）
- 运行时创建它的实例（`Constructor`）
- 运行时调用它的方法（`Method`）
- 运行时读写它的字段（`Field`）

这四项能力的入口都是 `Class` 对象。JVM 在加载一个类时，会为它在方法区生成一个 `Class` 对象，这个对象就是该类的"说明书"——反射的所有操作，都是先拿到说明书，再照着说明书办事。

## 怎么拿到 Class 对象：四种方式

```java
// 1. 已知具体类，直接用 .class —— 不触发类初始化，最快
Class<TargetObject> c1 = TargetObject.class;

// 2. 有对象实例，用 getClass() —— 运行时多态时常用
TargetObject obj = new TargetObject();
Class<?> c2 = obj.getClass();

// 3. 只知道全限定类名字符串，用 Class.forName() —— 会触发类初始化
Class<?> c3 = Class.forName("cn.example.TargetObject");

// 4. 通过类加载器 loadClass() —— 只加载不初始化
Class<?> c4 = ClassLoader.getSystemClassLoader().loadClass("cn.example.TargetObject");
```

这四种方式拿到的是**同一个** `Class` 对象（每个类在同一个类加载器下只有一份），但**副作用不同**，面试常追问这个区别：

| 方式                          | 是否触发类初始化             | 典型场景           |
| ----------------------------- | ---------------------------- | ------------------ |
| `.class`                      | 否                           | 编译期已知类型     |
| `getClass()`                  | 类已存在，无所谓             | 拿到实例后反查类型 |
| `Class.forName(name)`         | **是**（默认执行静态代码块） | 加载 JDBC 驱动等   |
| `classLoader.loadClass(name)` | 否                           | 只想加载不想初始化 |

"初始化"指的是执行静态代码块、给静态变量赋初值这一步。老式 JDBC 写法 `Class.forName("com.mysql.jdbc.Driver")` 之所以能加载驱动，靠的正是 `forName` 会触发驱动类的静态代码块，把自己注册到 `DriverManager`——换成 `loadClass` 就不生效了。`forName` 也有个重载能传 `initialize=false` 关掉初始化。

## 反射的基本操作：一个完整例子

假设有这样一个类，一个私有字段、一个公有方法、一个私有方法：

```java
package cn.example;

public class TargetObject {
    private String value;

    public TargetObject() {
        value = "hello";
    }

    public void publicMethod(String s) {
        System.out.println("public: " + s);
    }

    private void privateMethod() {
        System.out.println("private, value = " + value);
    }
}
```

用反射把它彻底"拆开"来操作：

```java
Class<?> clazz = Class.forName("cn.example.TargetObject");

// 创建实例：推荐用构造器，newInstance() 已过时（见下文）
Object target = clazz.getDeclaredConstructor().newInstance();

// 列出所有声明的方法（含私有，但不含继承来的）
for (Method m : clazz.getDeclaredMethods()) {
    System.out.println(m.getName());
}

// 拿到指定公有方法并调用
Method pub = clazz.getDeclaredMethod("publicMethod", String.class);
pub.invoke(target, "world");

// 修改私有字段：先关掉访问检查
Field field = clazz.getDeclaredField("value");
field.setAccessible(true);
field.set(target, "changed");

// 调用私有方法：同样要关检查
Method pri = clazz.getDeclaredMethod("privateMethod");
pri.setAccessible(true);
pri.invoke(target);
```

几个容易混的 API 名字，记住命名规律就不用背：

- `getMethods()` / `getFields()`：拿**公有**的，包括从父类继承来的。
- `getDeclaredMethods()` / `getDeclaredFields()`：拿**本类声明**的全部（含 `private`），但不含继承的。
- `setAccessible(true)`：关闭 Java 的访问权限检查，这是反射能突破 `private` 封装的关键开关。

这里要点名一个资料常见的过时写法：`clazz.newInstance()`。它从 **Java 9 起已被 `@Deprecated`**，因为它会把构造器抛出的受检异常"吞"成难以排查的形式，而且只能调用无参构造器。正确写法是 `clazz.getDeclaredConstructor(参数类型...).newInstance(参数...)`，异常处理更清晰，也支持带参构造。新代码别再用老的 `newInstance()`。

## 反射的优点与代价（重点）

反射的价值可以浓缩成一句：**它是几乎所有 Java 框架的地基。**

- Spring 的 IoC：启动时扫描带 `@Component`、`@Service` 的类，用反射把它们实例化成 Bean，再用反射把依赖注入进字段。
- MyBatis / Hibernate 的 ORM：查出一行数据后，用反射读取 Java 类的属性列表，按名字把列值 `set` 进对象。
- JDBC 加载驱动：靠 `Class.forName` 触发驱动注册。
- 序列化、通用工具（对象拷贝、Bean 转换）：都靠反射遍历字段。

没有反射，这些"你只管加注解、框架自动帮你干活"的体验就无从谈起。

但灵活是有代价的，缺点同样是高频考点：

1. **性能开销**。反射调用比直接调用慢，因为要做动态类型解析、方法查找，还会限制 JIT 的内联等优化。不过这个"慢"要分场景看：现代 JVM 对反射做了不少优化（比如多次调用后会生成字节码加速），框架层面也普遍**缓存 `Method`/`Field` 对象**、提前 `setAccessible(true)`，把开销摊薄。真正的热点循环里高频反射才需要担心，多数框架场景影响有限。所以别一口咬定"反射一定很慢不能用"，更准确的说法是"有开销，但有优化手段，看用在哪"。
2. **破坏封装**。`setAccessible(true)` 能直接改私有字段，绕过了封装设计，可能带来数据被篡改的风险。
3. **编译期检查失效**。反射调用的方法名、字段名都是字符串，写错了编译器发现不了，只有运行到那一行才抛 `NoSuchMethodException` 之类的异常，问题暴露得晚。它还能绕过泛型的类型检查（泛型检查只发生在编译期），埋下类型不安全的隐患。
4. **影响 AOT/JIT 优化**。反射的动态性让编译器难以做静态分析，在 GraalVM 原生镜像（AOT 编译）这类场景下，反射目标还得额外配置才能被保留。

## 注解是什么：不产生行为的"标签"

`Annotation`（注解）是 Java 5 引入的特性，可以理解成一种**结构化的注释**——普通注释给人看，注解则能被编译器和程序读取处理。它用来修饰类、方法、字段、参数等，往上面**附加元数据**。

关键要认清一点：**注解本身不产生任何行为**。`@Override`、`@Autowired` 写上去，代码不会因为这个注解自己多做什么事。它只是个标签，真正干活的是"读标签的人"——编译器或框架。

从语言层面看，注解本质是一个特殊的接口。当你写：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.SOURCE)
public @interface Override {
}
```

编译器会把这个 `@interface` 处理成一个隐式继承 `java.lang.annotation.Annotation` 的接口。有些资料会同时把 `public interface Override extends Annotation {}` 这行也写出来，容易让人误以为要自己去 `extends Annotation`——其实**不用你写，也不能这么写**，那是编译器自动生成的等价形态，写出来只是帮助理解。

## 元注解：给注解贴标签的注解（重点）

定义注解时，用来修饰注解本身的注解叫元注解，常用四个：

| 元注解        | 作用                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `@Target`     | 限定注解能贴在哪里（类、方法、字段、参数……），取值来自 `ElementType` |
| `@Retention`  | 决定注解**保留到哪个阶段**，取值来自 `RetentionPolicy`，最关键       |
| `@Documented` | 生成 Javadoc 时把该注解也带上                                        |
| `@Inherited`  | 让注解可被子类继承（仅对类上的注解生效）                             |

其中 `@Retention` 是理解"注解怎么工作"的命门，它有三档保留策略：

- **`SOURCE`**：只存在于源码，编译后就被丢弃。比如 `@Override`——它的使命是让编译器帮你检查是否真的重写了父类方法，检查完就没用了，`.class` 文件里根本不留它。
- **`CLASS`**：保留到 `.class` 字节码文件里，但类加载时 JVM 不把它读进内存，运行时反射**读不到**。这是默认值。
- **`RUNTIME`**：保留到运行时，JVM 会把它加载进内存，**反射能读到**。所有希望被框架在运行时处理的注解（`@Autowired`、`@Component`、各种自定义业务注解）都必须是 `RUNTIME`。

一句话记住：**只有 `RUNTIME` 的注解才能被反射读取。** 自定义注解想让框架在运行时读，就必须标 `@Retention(RetentionPolicy.RUNTIME)`——这也是新手最常踩的坑：注解写好了、反射代码也写了，却读不到，八成是保留策略没设成 `RUNTIME`。

## 注解怎么被处理：编译期 vs 运行期

注解只有被"解析"才会生效，解析分两条路：

**一是编译期处理（APT，Annotation Processing Tool）**。编译器在编译时扫描注解并处理。`@Override` 的检查就是编译期做的；Lombok 更典型——它通过注解处理器在编译阶段直接改抽象语法树（AST），把 `@Data`、`@Getter` 展开成真实的 getter/setter 字节码。这类注解不需要运行时存在，保留策略可以是 `SOURCE`。

**二是运行期反射处理**。框架在程序运行时用反射检查类/方法/字段上有没有某个注解，有就执行对应逻辑。Spring 看到 `@Value` 就用反射读出注解里的 key，去配置文件找值，再用反射 `set` 给字段——这一整套动作，正是"注解靠反射工作"的字面体现。

## 把反射和注解串起来：一个自定义注解的完整例子

光说概念不够，走一遍就通了。先定义一个运行时注解：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)   // 关键：必须 RUNTIME，否则下面反射读不到
public @interface Log {
    String value() default "";        // 注解可以带属性
}
```

贴到方法上：

```java
public class OrderService {
    @Log("下单")
    public void createOrder() {
        System.out.println("创建订单...");
    }
}
```

然后用反射把它读出来，模拟框架的处理逻辑：

```java
Class<?> clazz = OrderService.class;
Object service = clazz.getDeclaredConstructor().newInstance();

for (Method method : clazz.getDeclaredMethods()) {
    // 判断方法上有没有 @Log 注解
    if (method.isAnnotationPresent(Log.class)) {
        Log log = method.getAnnotation(Log.class);   // 拿到注解实例
        System.out.println("[日志] 开始执行：" + log.value());  // 读注解属性
        method.invoke(service);                        // 反射调用方法
        System.out.println("[日志] 执行结束：" + log.value());
    }
}
```

输出：

```plain
[日志] 开始执行：下单
创建订单...
[日志] 执行结束：下单
```

这段代码就是 Spring AOP、各种日志/权限框架的底层缩影：**注解负责"声明意图"（贴标签），反射负责"读取意图并执行"（读标签+干活）**。如果把 `@Log` 的保留策略改成 `SOURCE` 或 `CLASS`，`isAnnotationPresent` 会返回 `false`，整段逻辑就静默失效——这也再次印证了 `RUNTIME` 的必要性。

顺带一提，框架真正处理注解时往往不是直接反射硬调，而是结合**动态代理**：生成一个代理对象，在代理里统一拦截带注解的方法。JDK 动态代理内部的 `Method.invoke` 也依赖反射。动态代理这块内容较多，JDK 动态代理与 CGLIB 的对比另有专篇，这里不展开。

## 容易踩的坑

- **注解读不到，先查 `@Retention`**：没设成 `RUNTIME` 的注解，反射一律读不出来，这是最高频的坑。
- **`newInstance()` 已过时**：Java 9 起改用 `getDeclaredConstructor().newInstance()`，别再抄老代码。
- **`getMethods` 和 `getDeclaredMethods` 别混**：前者是公有+继承，后者是本类全部（含私有）+不含继承。
- **别神话也别妖魔化反射性能**：它有开销，但缓存 `Method`、提前 `setAccessible` 等手段能大幅缓解，框架场景通常可接受。
- **`setAccessible(true)` 在模块化（JPMS）下可能被拒**：Java 9 以后跨模块反射私有成员，未开放的模块会抛 `InaccessibleObjectException`，不再是无脑能突破。

## 小结

1. 反射是运行时动态获取类信息、创建对象、调用方法、读写字段的能力，入口是 `Class` 对象，四种拿法中 `Class.forName` 会触发类初始化、`.class` 和 `loadClass` 不会。
2. 反射是框架的基石（Spring IoC、MyBatis ORM、JDBC 驱动加载都靠它），代价是性能开销、破坏封装、编译期检查失效和影响 AOT/JIT 优化。
3. 注解本质是隐式继承 `Annotation` 的特殊接口，是不产生行为的元数据标签，真正干活的是读标签的编译器或框架。
4. `@Retention` 的三档保留策略里，只有 `RUNTIME` 的注解能被反射读到；`SOURCE`（如 `@Override`、Lombok）走编译期处理，`CLASS` 是默认值但运行时读不到。
5. 注解靠反射工作：自定义 `RUNTIME` 注解 + `isAnnotationPresent`/`getAnnotation` + `invoke`，就是框架处理注解的最小闭环。

## 参考

综合自项目内反射机制与高级特性资料的反射、注解两节，并做了如下核对与改写：将已过时的 `newInstance()` 更正为 `getDeclaredConstructor().newInstance()`；补充四种获取 `Class` 方式在"是否触发初始化"上的差异；澄清"注解 `extends Annotation`"是编译器生成而非手写；把"注解靠反射工作"用一个自定义 `@Log` 注解的完整例子串通；对反射性能给出"有开销但可优化"的分场景说明，并补充 JPMS 下 `setAccessible` 可能受限这一现代边界。
