---
title: "新版本 Java 的模式匹配、记录类、密封类适合哪些场景？"
description: "用数据载体、类型分支和领域模型讲清现代 Java 语法。"
breadcrumb: true
article: true
editLink: false
category:
  - "Java"
tag:
  - "进阶"
  - "细节题"
  - "项目实战"
prev:
  text: "Java 21 虚拟线程对传统线程池有什么影响？"
  link: "/java/new-features/java-new-features-java21-virtual-threads.html"
next:
  text: "计算机基础"
  link: "/cs-basics/"
---

# 新版本 Java 的模式匹配、记录类、密封类适合哪些场景？

> 现代 Java 语法的价值，是把“数据长什么样、类型有哪些可能、分支怎么处理”表达得更直接。

## 先把版本边界说清楚

现代 Java 语法经常被混在一起讲，但面试时要先区分“哪个版本正式可用”：

| 特性                     | 正式版本 | 主要解决的问题                            |
| ------------------------ | -------- | ----------------------------------------- |
| switch 表达式            | Java 14  | 让 `switch` 可以返回值，减少 `break` 样板 |
| 文本块                   | Java 15  | 多行 SQL、JSON、HTML 更可读               |
| `instanceof` 模式匹配    | Java 16  | 类型判断后自动绑定变量                    |
| `record`                 | Java 16  | 声明透明的数据载体                        |
| `sealed class/interface` | Java 17  | 限定继承或实现范围                        |
| record patterns          | Java 21  | 在模式匹配里解构 record                   |
| switch 模式匹配          | Java 21  | 在 `switch` 里按类型和模式分发            |

注意：Java 17 里的 switch 模式匹配仍是预览，Java 21 才转正；Java 14 的 switch 表达式和 Java 21 的 switch 模式匹配不是同一个边界。

## record 适合什么？

`record` 适合不可变数据载体，比如查询结果、接口 DTO、配置快照和消息事件。

```java
public record UserSummary(Long id, String name, String mobile) {}
```

它会自动生成构造器、访问器、`equals`、`hashCode` 和 `toString`。这类代码以前经常靠 IDE 或 Lombok 生成，record 把“这是一个透明数据载体”直接写进语言。

但 record 不是所有 `@Data` 类的替代品。它的边界要说清楚：

- record 组件引用不能重新赋值，但不代表引用对象内部深度不可变；
- 如果组件是 `List`、`Map` 这类可变对象，必要时要做防御性拷贝；
- 不适合 JPA 实体、需要懒加载代理的对象；
- 不适合有复杂生命周期、状态变更和领域行为的聚合根。

可以在紧凑构造器里做校验：

```java
public record PageRequest(int pageNo, int pageSize) {
    public PageRequest {
        if (pageNo < 1) {
            throw new IllegalArgumentException("pageNo must start from 1");
        }
        if (pageSize <= 0 || pageSize > 100) {
            throw new IllegalArgumentException("invalid pageSize");
        }
    }
}
```

这种写法适合把参数校验贴近数据结构本身，但不要把复杂业务流程塞进 record。

## sealed class 适合什么？

密封类适合限定子类型集合，比如支付结果、订单状态事件、规则表达式。

```java
public sealed interface PayResult permits Success, Failed, Processing {}
```

它不是“不能继承”，而是“只能被指定类型继承或实现”。直接子类型还必须继续声明自己的扩展策略：

```java
public record Success(String tradeNo) implements PayResult {}
public record Failed(String code, String message) implements PayResult {}
public non-sealed interface Processing extends PayResult {}
```

`final` 表示到此为止，`sealed` 表示继续限制下一层子类型，`non-sealed` 表示从这里重新开放扩展。

sealed 适合封闭领域模型：

- 支付结果：成功、失败、处理中；
- 订单事件：已创建、已支付、已取消、已退款；
- 规则表达式：与、或、非、比较；
- 解释器或编译器里的 AST 节点。

不适合插件 SPI、开放 SDK、第三方扩展点。因为这些场景需要外部类型自由接入，强行 sealed 会把扩展能力封死。

## 模式匹配解决什么？

模式匹配让类型判断和变量绑定合在一起，减少样板代码。

```java
if (event instanceof OrderPaid paid) {
    handlePaid(paid.orderId());
}
```

模式变量只在确定匹配成功的路径里可用：

```java
if (event instanceof OrderPaid paid && paid.amount().signum() > 0) {
    handlePaid(paid.orderId());
}
```

这解决的是“判断类型 + 强转 + 绑定变量”的样板代码，不是鼓励在 service 里写一长串类型判断。分支背后如果是复杂策略，仍然应该用多态、策略模式或明确的领域服务承载。

## switch 模式匹配适合怎么用？

Java 21 让 `switch` 可以直接按类型模式分发。它和 sealed、record 搭配时，表达力会更完整。

```java
sealed interface PayResult permits Success, Failed, Processing {}

record Success(String tradeNo) implements PayResult {}
record Failed(String code, String message) implements PayResult {}
record Processing(String requestId) implements PayResult {}

String text = switch (result) {
    case Success s -> "支付成功：" + s.tradeNo();
    case Failed f -> "支付失败：" + f.code();
    case Processing p -> "处理中：" + p.requestId();
};
```

因为 `PayResult` 是 sealed，编译器知道所有可能的子类型，更容易检查分支是否穷尽。这样比 `if-else instanceof` 更集中，也更不容易漏掉状态。

但它也有边界：

- `case` 顺序会影响匹配，父类型放前面可能遮住子类型；
- `case null` 可以显式处理空值，不写时要清楚空值行为；
- `switch` 适合做分发，不适合承载复杂业务流程；
- 分支逻辑一旦变长，应抽成方法或交给领域对象。

## record patterns 解决什么？

record patterns 是对 record 的结构化拆解。它可以在 `instanceof` 或 `switch` 里直接拿到 record 组件值。

```java
record Point(int x, int y) {}

String format(Object obj) {
    if (obj instanceof Point(int x, int y)) {
        return x + "," + y;
    }
    return "unknown";
}
```

和 switch 搭配时，可以少写一层访问器：

```java
sealed interface Shape permits Circle, Rectangle {}

record Circle(double radius) implements Shape {}
record Rectangle(double width, double height) implements Shape {}

double area(Shape shape) {
    return switch (shape) {
        case Circle(double radius) -> Math.PI * radius * radius;
        case Rectangle(double width, double height) -> width * height;
    };
}
```

注意几个边界：

- record patterns 只解构 record，不是普通 JavaBean 通用解构；
- 深层嵌套可以写，但不要为了炫技牺牲可读性；
- 未命名模式和变量在不同版本里有预览边界，不要和 Java 21 已转正的 record patterns 混着说。

## 文本块适合什么？

文本块适合多行 SQL、JSON、HTML、测试样例，让字符串接近原始文本。

```java
String sql = """
    select id, name, mobile
    from user
    where status = ?
    order by id desc
    """;
```

它只是多行字符串，不是字符串插值，也不会自动格式化 SQL/JSON，更不会自动防 SQL 注入。动态 SQL 仍然要参数化，不要把用户输入拼进去。

使用时要注意：

- 文本块会处理公共缩进；
- 末尾换行是否保留要看闭合引号位置；
- 行尾 `\` 可以避免引入换行；
- `\s` 可以显式保留尾随空格。

## 新语法能替代设计模式吗？

不能。现代语法的作用是让模型和分支更清楚，不是替代建模。

一个实用判断是：

- 数据只是透明载体：考虑 record；
- 子类型天然有限：考虑 sealed；
- 分支只是按类型分发：考虑 switch 模式匹配；
- 分支内部是复杂业务策略：仍然需要多态、策略模式或领域服务；
- 多行文本影响可读性：考虑文本块，但 SQL 安全仍靠参数化。

语法越强，越要克制。好的代码不是把所有新语法堆上去，而是让读者更容易看懂领域约束。

## 小结

1. record 适合透明数据载体，但只是浅层不可变，不适合复杂可变实体和 JPA 聚合根。
2. sealed class/interface 适合封闭类型集合，子类型必须声明 `final`、`sealed` 或 `non-sealed`。
3. `instanceof` 模式匹配减少类型判断和强转样板，switch 模式匹配适合封闭类型分发。
4. record patterns 在 Java 21 转正，只能解构 record，不是普通 JavaBean 通用解构。
5. 文本块提升 SQL/JSON/HTML 可读性，但不负责字符串插值、格式化或安全参数化。

## 参考

综合 Java SE 官方文档、OpenJDK JEP 与相关工程实践整理，并对 record、sealed class、模式匹配、record patterns 和文本块的版本边界及适用场景做了交叉验证。
