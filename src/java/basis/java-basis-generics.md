---
title: "泛型是什么？类型擦除会带来哪些坑？"
description: "从编译期类型检查讲到类型擦除、通配符与 PECS 原则的取舍。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java 基础"
tag:
  - "高频"
  - "进阶"
  - "原理深入"
prev:
  {
    text: "Java 异常体系是怎么设计的？checked 和 unchecked 怎么选？",
    link: "/java/basis/java-basis-exception.html",
  }
next:
  {
    text: "反射是什么？注解又是怎么靠反射工作的？",
    link: "/java/basis/java-basis-reflection-annotation.html",
  }
---

# 泛型是什么？类型擦除会带来哪些坑？

> 泛型让编译器帮你把关类型，代价是运行期它其实"什么都不知道"——这道认知落差，正是一堆面试坑的源头。

## 没有泛型的年代，代码有多难受？

泛型是 JDK 5 才加进来的。在那之前，集合里装的一律是 `Object`，取出来必须自己强转。问题是：编译器根本不知道你往里塞了什么，出错只能等到运行期才暴露。

```java
// JDK 5 之前：List 只认 Object
List list = new ArrayList();
list.add("hello");
list.add(42);                 // 编译器不拦，随便塞

String s = (String) list.get(0);   // 手动强转，OK
String x = (String) list.get(1);   // 编译通过，运行时 ClassCastException！
```

第二行的 `42` 是个 `Integer`，强转成 `String` 会在**运行期**抛 `ClassCastException`。这类 bug 最烦的地方在于：代码看着没毛病，编译也过，非得跑到那一行才炸。

有了泛型，同样的错误被提前到了**编译期**：

```java
List<String> list = new ArrayList<>();   // 声明：这个 List 只装 String
list.add("hello");
list.add(42);                            // 编译不过，红线直接标出来

String s = list.get(0);                  // 无需强转，编译器自动帮你转
```

所以泛型解决的核心问题就两条：

1. **编译期类型检查**——把「类型放错」这类错误从运行期提前到编译期，早发现早修。
2. **免去手动强转**——`get()` 直接拿到 `String`，代码更干净，也少了一处出错的机会。

一句话：泛型把 `ClassCastException` 从「运行时才炸」变成「写代码时就飘红」。

## 泛型的三种用法：类、接口、方法

泛型的落地形式有三种，`T`、`E`、`K`、`V` 这些只是约定俗成的类型参数名，随便起也行。

**泛型类**——把类型参数写在类名后面，实例化时再定死：

```java
public class Box<T> {
    private T value;
    public Box(T value) { this.value = value; }
    public T get() { return value; }
}

Box<Integer> box = new Box<>(123);   // JDK 7 起可用菱形语法 <>，编译器自动推断
```

**泛型接口**——实现时可以继续保留泛型，也可以指定成具体类型：

```java
public interface Generator<T> {
    T next();
}

// 实现时保留泛型
class ListGenerator<T> implements Generator<T> { public T next() { return null; } }

// 实现时指定成 String
class StringGenerator implements Generator<String> { public String next() { return "hi"; } }
```

**泛型方法**——类型参数写在返回值前面，作用域仅限这个方法，跟类上有没有泛型无关：

```java
public static <E> void printArray(E[] arr) {
    for (E e : arr) System.out.print(e + " ");
}
```

这里要点破一个高频细节：**静态方法用不了类上声明的泛型**。因为类的类型参数是在 `new` 出对象时才确定的，而静态方法不依赖实例、加载更早，那会儿类型参数还是空的。所以静态方法要用泛型，只能像上面这样自己在方法上声明 `<E>`。

## 类型擦除：Java 泛型其实是编译期的语法糖

这是泛型最核心、也最能考的一点。

Java 的泛型常被叫做「伪泛型」，因为**所有泛型信息只活在编译期，编译完成后类型参数就被"擦掉"了**——这就是类型擦除（type erasure）。擦除规则很简单：

- **无界的 `T`** 擦除成 `Object`；
- **有界的 `T extends Number`** 擦除成边界类型 `Number`。

编译器为什么要这么干？为了兼容。JDK 5 之前已经有海量不带泛型的代码在跑了，如果泛型生成全新的类型，老代码就没法和新代码互通。擦除的思路是：泛型只在编译期做类型检查和自动插入强转，编译后退回成老的原始类型，字节码层面和没有泛型时长得一样，JVM 不需要为泛型改动，也不会多出运行期开销。

最直观的证据——运行期两个不同泛型实参的 `getClass()` 完全相等：

```java
List<String>  ls = new ArrayList<>();
List<Integer> li = new ArrayList<>();
System.out.println(ls.getClass() == li.getClass());   // true
System.out.println(ls.getClass());                     // class java.util.ArrayList
```

`List<String>` 和 `List<Integer>` 编译后都变成了裸的 `ArrayList`，运行期根本区分不出来。再看一个更"离谱"的例子，用反射能往 `List<Integer>` 里塞字符串：

```java
List<Integer> list = new ArrayList<>();
list.add(12);
// list.add("a");                       // 编译不过
Method add = list.getClass().getMethod("add", Object.class);
add.invoke(list, "kl");                  // 运行期竟然成功了
System.out.println(list);                // [12, kl]
```

因为擦除后 `add` 的真实签名就是 `add(Object)`，反射绕过了编译期检查。这也反过来说明：泛型的类型安全**只是编译器给的承诺**，运行期没人替你兜底。

> 顺带对比一下：C# 的泛型是"真泛型"（reified，运行期保留类型信息，`List<int>` 和 `List<string>` 是两个不同的类型）。Java 走擦除路线，本质是历史包袱下的兼容性妥协。

## 擦除埋下的那些坑

类型擦除带来一连串限制，它们看着零散，根子都是同一个：**运行期拿不到 `T` 到底是什么**。逐个看：

| 写法                                        | 能不能？ | 为什么                                                       |
| ------------------------------------------- | -------- | ------------------------------------------------------------ |
| `new T()`                                   | 不能     | 擦除后 `T` 是 `Object`，`new` 谁不知道，也无法调用具体构造器 |
| `new T[10]`                                 | 不能     | 同上，运行期不知道要创建哪种类型的数组                       |
| `List<int>`                                 | 不能     | 基本类型不是 `Object` 子类，只能用包装类 `List<Integer>`     |
| `x instanceof T`                            | 不能     | 擦除后没有 `T` 可比，运行期无从判断                          |
| `x instanceof List<String>`                 | 不能     | 同理，只能写 `x instanceof List<?>` 或 `x instanceof List`   |
| `static T field;`                           | 不能     | 静态成员属于类、先于实例存在，那会儿 `T` 还没定              |
| 重载 `f(List<String>)` / `f(List<Integer>)` | 不能     | 擦除后两个签名都变成 `f(List)`，冲突                         |

几个容易混的地方多说两句：

**基本类型不能当类型参数**。`List<int>` 直接编译不过，必须写 `List<Integer>`。至今（截至主流 JDK 版本）依然如此，泛型只接受引用类型。

**`instanceof` 的边界**。不是完全不能用 `instanceof`——`obj instanceof ArrayList<?>` 和 `obj instanceof ArrayList` 是合法的，因为它们不依赖具体的类型实参；不合法的是 `obj instanceof T` 和 `obj instanceof ArrayList<String>` 这种要在运行期区分泛型实参的写法。

**重载冲突**。下面这段编译不过，很多人第一眼觉得没问题：

```java
public void print(List<String> list)  { }
public void print(List<Integer> list) { }   // 编译错误：擦除后签名相同
```

擦除后两个方法都是 `print(List)`，JVM 眼里就是同一个方法，自然冲突。

## 通配符：让泛型能"变通"

泛型有个反直觉的地方：`List<Integer>` **不是** `List<Number>` 的子类，哪怕 `Integer` 是 `Number` 的子类。也就是说泛型默认不"协变"。原因也是类型安全——假如允许 `List<Number> nums = intList`，那 `nums.add(3.14)` 就能往一个本该只装 `Integer` 的列表里塞 `Double`，破坏约束。

通配符 `?` 就是用来在需要灵活性时松一下绑的。

**无界通配符 `<?>`**——表示"某个未知但固定的类型"，用于不关心具体类型的场景：

```java
void printSize(List<?> list) { System.out.println(list.size()); }   // 任何 List 都能传
```

注意 `List<?>` 和裸 `List` 不是一回事：`List<?>` 编译器**不允许写入除 `null` 外的任何元素**（因为它不知道那个未知类型是什么，写什么都可能不安全）；裸 `List` 则啥都能塞，但会给未检查警告。

**上界通配符 `<? extends T>`**——"T 或 T 的某个子类"。它是**只读**的（生产者）：

```java
List<? extends Number> nums = new ArrayList<Integer>();
Number n = nums.get(0);   // 读：拿出来一定是 Number，OK
nums.add(1);              // 写：编译不过——它到底是 Integer 还是 Double 的 List？不敢写
```

能读是因为里面装的不管是啥子类，都能当 `Number` 用；不能写是因为编译器无法确定那个具体子类型，塞任何东西都有风险。

**下界通配符 `<? super T>`**——"T 或 T 的某个父类"。它主要是**只写**的（消费者）：

```java
List<? super Integer> sink = new ArrayList<Number>();
sink.add(1);              // 写：Integer 一定能放进"Integer 或其父类"的 List，OK
sink.add(2);
Object o = sink.get(0);   // 读：只能当 Object 收，因为不知道确切是哪个父类型
```

能写 `Integer` 是因为无论它是 `Integer`、`Number` 还是 `Object` 的 List，放 `Integer` 都合法；读却只能拿到 `Object`，因为具体类型未知。

把这两条合起来就是 **PECS 原则**——**Producer Extends, Consumer Super**：

- 一个集合是**给你提供数据的（生产者），用 `extends`**——你只从里面读；
- 一个集合是**用来接收数据的（消费者），用 `super`**——你只往里面写。

JDK 里 `Collections.copy` 就是教科书式的例子：

```java
public static <T> void copy(List<? super T> dest, List<? extends T> src)
```

`src` 是数据来源（生产者，`extends`），`dest` 是数据去处（消费者，`super`），从 `src` 读、往 `dest` 写，签名把方向表达得清清楚楚。

## 桥接方法：擦除后编译器怎么保住多态

最后简单提一下桥接方法（bridge method），它是擦除的一个副产物。看这段：

```java
class Node<T> {
    public void set(T data) { /* ... */ }
}
class IntNode extends Node<Integer> {
    @Override
    public void set(Integer data) { /* ... */ }
}
```

`Node<T>` 擦除后，父类的方法变成 `set(Object)`；而子类想重写的是 `set(Integer)`。签名对不上，按理说构不成重写，多态就断了。为了补上这个缺口，**编译器会在 `IntNode` 里自动生成一个 `set(Object)` 的桥接方法**，内部把参数转成 `Integer` 再转调 `set(Integer)`。这样通过 `Node` 引用调用 `set` 时依然能正确分派到子类实现。桥接方法是编译器生成的，不用你手写，知道它是为了"擦除后仍保住多态"而存在就够了。

## 容易踩的坑

- 把「泛型 `List<String>` 和 `List<Integer>` 运行期是不同类型」当真——它们 `getClass()` 相等，运行期都是 `List`。
- 以为 `List<Integer>` 是 `List<Number>` 的子类——泛型默认不协变，需要协变得靠通配符。
- 记反 PECS：读用 `super`、写用 `extends`。正确是**读 extends、写 super**。
- 认为 `<? extends T>` 能随便 `add`——它是只读的，除了 `null` 什么都写不进去。
- 想当然 `new T[]` / `new T()` 能编译——擦除后 `T` 是 `Object`，运行期不知道真实类型，都不行。
- 用基本类型做类型参数（`List<int>`）——只能用包装类。

## 小结

1. 泛型是 JDK 5 引入的编译期特性，作用是**编译期类型检查 + 自动强转**，把 `ClassCastException` 从运行期提前到编译期。
2. 三种用法：泛型类、泛型接口、泛型方法；静态方法用不了类上的泛型，得自己声明。
3. **类型擦除**是核心——泛型是语法糖，编译后 `T` 擦成 `Object`（有界擦成边界类型），运行期无泛型信息，`List<String>` 与 `List<Integer>` 同为 `List`。
4. 擦除带来的限制都源于「运行期不知道 `T` 是谁」：不能 `new T()` / `new T[]`、基本类型不能做类型参数、`instanceof` 受限、静态成员用不了 `T`、泛型重载会签名冲突。
5. 通配符解决灵活性：`<?>` 无界、`<? extends T>` 上界只读（生产者）、`<? super T>` 下界只写（消费者）；口诀 **PECS——读 extends、写 super**。

## 参考

- 综合自项目内泛型与高级特性资料的泛型章节，并对以下点做了核对与改写：基本类型不可做类型参数在当前主流 JDK 版本仍成立；`instanceof` 并非完全禁用，`x instanceof List<?>` 与 `x instanceof List` 合法，仅 `x instanceof T` / 带具体实参的 `instanceof` 不可用；补充了 Java 擦除式泛型与 C# reified 泛型的对比。
- Java 官方文档 Generics 教程：<https://docs.oracle.com/javase/tutorial/java/generics/index.html>
