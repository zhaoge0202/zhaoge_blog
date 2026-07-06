---
title: "Java IO 里用到了哪些设计模式？"
description: "以装饰器和适配器为主，讲清 IO 类库如何用设计模式避免类爆炸。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java IO"
tag:
  - "高频"
  - "进阶"
  - "原理深入"
prev:
  {
    text: "Java IO 流体系是怎么组织的？字节流和字符流有什么区别？",
    link: "/java/io/java-io-streams.html",
  }
next: { text: "BIO、NIO、AIO 有什么区别？分别适合什么场景？", link: "/java/io/java-io-models.html" }
---

# Java IO 里用到了哪些设计模式？

> Java IO 类库是学设计模式最好的活教材，尤其是装饰器模式——它解释了那串 `new A(new B(new C(...)))` 套娃写法到底是为了什么。

## 从一行"层层包裹"的代码说起

写 IO 的时候，你一定见过这种套娃写法：

```java
BufferedReader br = new BufferedReader(
        new InputStreamReader(
                new FileInputStream("input.txt"), "UTF-8"));
```

一个 `FileInputStream` 被 `InputStreamReader` 包住，再被 `BufferedReader` 包住。第一次见会觉得别扭：为什么不直接给我一个"带缓冲、能按字符读文件"的类，一步到位？

答案就藏在两个设计模式里——**里层那次包裹（字节转字符）是适配器，外层那次包裹（加缓冲）是装饰器**。搞懂这两个，IO 的类结构就通了。通用的设计模式原理这里只点到为止（系统讲解在设计模式专题），重点看它们在 IO 里怎么落地。

## 装饰器模式：为什么 IO 宁可组合也不用继承

装饰器模式一句话概括：**在不改变原有接口的前提下，通过一层层包裹动态地给对象加功能。**

它要解决的痛点是**类爆炸**。假设我们想给输入流增加四种能力：缓冲、加密、压缩、计数。如果走继承的老路，就得为每一种"能力组合"造一个类：

- `FileInputStream`
- `BufferedFileInputStream`
- `EncryptedFileInputStream`
- `BufferedEncryptedFileInputStream`
- `BufferedCompressedEncryptedFileInputStream`
- ……

四种能力有 2⁴ = 16 种组合，而基础流又不止 `FileInputStream` 一种（还有 `ByteArrayInputStream`、`PipedInputStream`……）。假设有 N 种基础流、k 种能力，继承方案要 N × 2ᵏ 个类，每加一种新能力类数量直接翻倍。这显然没法维护。

装饰器的思路是把每种能力做成一个**独立的装饰器类**，运行时想要哪几种就往上叠哪几种：

```java
InputStream in = new FileInputStream("data.bin");
in = new BufferedInputStream(in);   // 加缓冲
in = new GZIPInputStream(in);       // 加解压（java.util.zip 下）
// in 依然是 InputStream，接口没变，只是功能被一层层增强了
```

N 种基础流 + k 种装饰器，一共 N + k 个类就够了，能力还能自由排列组合。这就是"组合优于继承"在 IO 里最典型的体现。

关键点在于：**装饰器和被装饰的对象必须是同一个类型**。上面每包一层，结果仍然是 `InputStream`，所以才能继续往外包。这也是装饰器和"随便封装一层"的区别——它不换接口，只增强。

## 装饰器在 IO 里的家谱

IO 里装饰器的"总开关"是几个抽象类：

- 字节流：`FilterInputStream` / `FilterOutputStream`
- 字符流：`FilterReader` / `FilterWriter`

它们本身继承自 `InputStream` / `OutputStream`（或 `Reader` / `Writer`），内部持有一个同类型的引用（被装饰对象），默认把每个方法调用转发给它。真正的装饰器都是它们的子类，在转发之外加自己的料：

| 装饰器类                             | 加了什么能力                                           |
| ------------------------------------ | ------------------------------------------------------ |
| `BufferedInputStream`                | 加一块内存缓冲区，减少底层 read 系统调用次数           |
| `DataInputStream`                    | 能按 `int`/`long`/`UTF` 等基本类型读写，而不只是裸字节 |
| `PushbackInputStream`                | 支持把读出来的字节"塞回去"，方便预读判断               |
| `GZIPInputStream` / `ZipInputStream` | 边读边解压                                             |

看一眼 `BufferedInputStream` 的构造函数就明白了，它收的正是一个 `InputStream`：

```java
public BufferedInputStream(InputStream in) {
    this(in, DEFAULT_BUFFER_SIZE);
}
```

字符流那边是对称的：`BufferedReader` 装饰 `Reader`，`BufferedWriter` 装饰 `Writer`。所以你完全不用去背"哪些类是装饰器"，只要看到某个流的构造函数**收的是自己的父类型**，基本就是装饰器。

> 补充一个资料里常被一笔带过的细节：`ZipInputStream` / `GZIPInputStream` 继承自 `InflaterInputStream`，而 `InflaterInputStream` 才是 `FilterInputStream` 的直接子类。也就是说压缩流是"孙子辈"的装饰器，中间隔了一层，但不影响它照样能包在别的流外面继续叠加。

## 适配器模式：为什么字节流能无缝接到字符流

上面那串：

```java
BufferedReader br = new BufferedReader(
        new InputStreamReader(
                new FileInputStream("input.txt"), "UTF-8"));
```

其实只说了一半。`BufferedReader` 包 `InputStreamReader` 是装饰器；但 **`InputStreamReader` 把 `InputStream` 变成 `Reader`** 这一下，不再是装饰器，而是**适配器模式**。

适配器解决的问题不是“增强功能”，而是**让接口不兼容的两类对象可以协作**。在 IO 里，不兼容的双方正是：

- 字节流接口：`InputStream` / `OutputStream`
- 字符流接口：`Reader` / `Writer`

它们的抽象层级不同，方法签名也不同，不能直接混用。Java 需要一个中间层，把“读写字节”的世界翻译成“读写字符”的世界，这就是：

- `InputStreamReader`：字节输入 -> 字符输入
- `OutputStreamWriter`：字符输出 -> 字节输出

它们不是在原有接口上加缓冲、加压缩、加统计，而是**换了一套对外接口**。这正是适配器和装饰器最本质的区别。

看 `InputStreamReader` 的角色最直观：

```java
InputStreamReader reader =
        new InputStreamReader(new FileInputStream("input.txt"), "UTF-8");
```

这里：

- `FileInputStream` 是被适配者，它只懂“把字节读出来”；
- `InputStreamReader` 是适配器，它把这些字节按指定字符集解码成字符；
- 调用方最终面对的是 `Reader` 接口，而不是 `InputStream`。

也就是说，`InputStreamReader` 做的不是“增强原始读取能力”，而是“把一种接口翻译成另一种接口”。这就是适配器。

## 装饰器和适配器，别再混成一类

很多人看见“外面包了一层对象”就下意识说是装饰器。这个判断太粗了，得看**包完之后接口有没有变、目的是什么**。

| 模式   | 典型类                                    | 核心目的           | 包完后接口是否变化         |
| ------ | ----------------------------------------- | ------------------ | -------------------------- |
| 装饰器 | `BufferedInputStream`、`BufferedReader`   | 动态增强原对象能力 | 不变，还是同一父类型       |
| 适配器 | `InputStreamReader`、`OutputStreamWriter` | 协调不兼容接口     | 会变，字节接口转成字符接口 |

拿前面那个三层组合再拆一次：

```java
BufferedReader br = new BufferedReader(
        new InputStreamReader(
                new FileInputStream("input.txt"), "UTF-8"));
```

- `FileInputStream -> InputStreamReader`：适配器，把字节流适配成字符流；
- `InputStreamReader -> BufferedReader`：装饰器，在字符流之上加缓冲和按行读取能力。

这就是为什么同样是“包一层”，本质却完全不同。

## 再往外看一层：NIO 里还有工厂和观察者的影子

如果把眼光只放在 `java.io` 包，最显眼的是装饰器和适配器；但放到更大的 IO 体系，NIO 里还能看到另外两类常见模式。

### 1. 工厂模式：你要对象，不必自己 `new`

NIO 的 `Files`、`Paths` 这类工具类，大量提供了静态工厂方法。比如：

```java
InputStream in = Files.newInputStream(path);
Path path = Paths.get("/tmp/app.log");
```

调用方只表达“我要一个输入流”或“我要一个路径对象”，至于底层返回什么具体实现，由工厂方法内部决定。
这类写法的价值是把对象创建逻辑收敛起来，避免调用方直接依赖具体实现类。

### 2. 观察者模式：目录变了，通知我

NIO 的 `WatchService` 则能看到观察者模式的影子。你把目录注册给监听器后：

```java
WatchService watchService = FileSystems.getDefault().newWatchService();
Path path = Paths.get("logs");
path.register(watchService, StandardWatchEventKinds.ENTRY_CREATE);
```

后续目录里如果有创建、删除、修改事件，`WatchService` 就会把这些变化通知出来。这里：

- 被观察者是目录路径；
- 观察者是 `WatchService`；
- 事件是文件系统里的变化。

这类模式在日常手写 IO 代码里不如装饰器、适配器那么高频，但从“Java 如何组织 IO API”这个角度看，确实值得知道。

## 容易踩的坑

- **把所有“包一层”的写法都叫装饰器**。要先看接口有没有变。`InputStreamReader` 把 `InputStream` 变成 `Reader`，这是适配器，不是装饰器。
- **以为缓冲流只能包文件流**。只要父类型兼容，`BufferedInputStream` 能包 `FileInputStream`，也能继续被 `ZipInputStream` 之类的装饰器套上去。
- **把 `FileReader` / `FileWriter` 误当成“字符版文件流”就结束了**。真正关键的是 `InputStreamReader` / `OutputStreamWriter` 这对桥接类，因为编码转换发生在这里。
- **只记模式名，不记它们解决什么问题**。装饰器解决能力叠加，适配器解决接口翻译，工厂解决对象创建，观察者解决事件通知。把问题和模式对上，比背定义更重要。

## 小结

- Java IO 最经典的两个模式是装饰器和适配器：前者负责能力增强，后者负责接口转换。
- `FilterInputStream` / `FilterOutputStream` 及其子类，体现的是“在不改变接口的前提下动态叠加功能”，这就是装饰器。
- `InputStreamReader` / `OutputStreamWriter` 把字节流和字符流接起来，核心不是增强，而是把一种接口翻译成另一种接口，这是适配器。
- 同一段 IO 套娃代码里，往往会同时出现多个模式：先适配，再装饰。
- 放到更大的 IO 体系里，NIO 还常见工厂模式（`Files`、`Paths`）和观察者模式（`WatchService`）。

## 参考

- 综合自项目内 Java IO 设计模式与 IO 基础资料，并结合本仓库现有 IO 文章结构重写。
- 对资料中“看起来都像包装一层”的示例做了模式拆分，明确区分了 `InputStreamReader` 的适配器角色和 `BufferedReader` 的装饰器角色。
- 额外结合本机 JDK 17 的 IO 类层次与现有站内文章 [Java IO 流体系是怎么组织的？字节流和字符流有什么区别？](/java/io/java-io-streams.html) 做了交叉校对。
