---
title: "为什么需要自定义 ClassLoader？会带来什么风险？"
description: "从插件化、类隔离、热部署到类加载器泄漏讲清自定义 ClassLoader。"
breadcrumb: true
article: true
editLink: false
category:
  - "JVM"
tag:
  - "进阶"
  - "项目实战"
  - "细节题"
prev:
  text: "类加载过程和双亲委派模型怎么理解？"
  link: "/java/jvm/jvm-class-loading.html"
next:
  text: "如何判断对象可以被回收？"
  link: "/java/jvm/jvm-object-recycling.html"
---

# 为什么需要自定义 ClassLoader？会带来什么风险？

> 自定义 ClassLoader 的价值是动态加载和类隔离，风险则是类冲突、类加载器泄漏和诊断复杂度上升。

## 什么时候需要自定义 ClassLoader？

普通业务系统很少需要自己写 ClassLoader，但很多框架和容器离不开它：

| 场景     | 为什么需要                                    |
| -------- | --------------------------------------------- |
| 插件系统 | 插件 Jar 不在主应用 classpath，需要运行时加载 |
| 热部署   | 新版本类用新加载器加载，旧加载器可被回收      |
| 类隔离   | 不同应用或插件可以使用同名不同版本依赖        |
| 加密类   | 从加密字节码中读取并解密后定义类              |
| 容器     | Tomcat 等容器要隔离不同 Web 应用              |

例如 Tomcat 会为每个 Web 应用创建独立的 WebAppClassLoader，让应用 A 和应用 B 可以使用不同版本的业务依赖。

但自定义 ClassLoader 不是普通业务代码的默认选择。它适合框架、容器、插件平台这类“类来源和隔离边界本身就是需求”的场景。如果只是想按配置创建不同实现，优先考虑接口、工厂、依赖注入或 SPI，而不是自己管理字节码加载。

## 自定义加载器该重写哪个方法？

如果不想破坏双亲委派，通常重写 `findClass`：

```java
class PluginClassLoader extends ClassLoader {
    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        byte[] bytes = loadBytesFromPluginDir(name);
        return defineClass(name, bytes, 0, bytes.length);
    }
}
```

`loadClass` 里已经实现了双亲委派。父加载器找不到时，才会调用你的 `findClass`。

如果你要改变加载优先级，比如“先从插件目录找，再委派父加载器”，才需要重写 `loadClass`。但这要非常谨慎，通常要对白名单和基础包做保护，避免把 JDK 类、日志门面、框架核心类也加载出多份。

一个更稳的规则是：

| 需求                        | 推荐做法                     | 风险                       |
| --------------------------- | ---------------------------- | -------------------------- |
| 只补充父加载器找不到的类    | 重写 `findClass`             | 风险较低，保留委派模型     |
| 插件优先加载自己的依赖      | 谨慎重写 `loadClass`         | 容易造成类冲突和类型不兼容 |
| 保护 JDK / 框架基础类唯一性 | 对包名前缀做父优先白名单     | 白名单漏掉会出现重复类     |
| 动态卸载插件                | 每个插件独立加载器并清理引用 | 容易发生 ClassLoader 泄漏  |

## 为什么同名类可能不是同一个类？

JVM 判断两个类是否相同，看的是：

```text
类的全限定名 + 定义它的 ClassLoader
```

所以两个 ClassLoader 分别加载同一个 `com.example.User`，它们在 JVM 里是两个不同类型。

这会带来典型问题：

```text
java.lang.ClassCastException:
com.example.User cannot be cast to com.example.User
```

看起来名字一模一样，实际由两个不同加载器定义。

排查时不要只看类名，还要打印：

```java
obj.getClass().getClassLoader()
```

也可以同时打印接口类和实现类的加载器：

```java
System.out.println(Api.class.getClassLoader());
System.out.println(impl.getClass().getClassLoader());
```

如果接口由父加载器加载，实现类由子加载器加载，这是正常隔离；如果同一个 API 在父子加载器里各有一份，就很容易出现“明明实现了接口却无法强转”的问题。

## SPI 为什么会绕开普通委派？

SPI 的接口在 JDK 或框架上层，具体实现却在应用 classpath 或插件里。

例如 JDBC：

- `java.sql.Driver` 是平台提供的接口。
- MySQL Driver 是应用依赖里的实现。

高层加载器按双亲委派找不到低层应用里的实现，于是需要线程上下文类加载器：

```java
Thread.currentThread().getContextClassLoader()
```

这让框架可以用当前线程上下文里的应用加载器去找实现类。Spring、JDBC、日志框架等场景都能看到这种思路。

线程上下文类加载器本质上是“把类加载选择权交给当前执行线程”。它解决了高层框架要发现低层业务实现的问题，但也带来两个边界：

1. 线程池复用线程时，要避免把旧应用的上下文加载器一直留在线程上。
2. 框架临时切换上下文加载器后，要在 `finally` 里恢复原值。

```java
ClassLoader old = Thread.currentThread().getContextClassLoader();
try {
    Thread.currentThread().setContextClassLoader(pluginLoader);
    runPlugin();
} finally {
    Thread.currentThread().setContextClassLoader(old);
}
```

## 类加载器泄漏怎么发生？

热部署要成功，旧 ClassLoader 必须没人引用。否则旧类、旧静态变量、旧对象都卸载不了。

常见引用链：

```text
全局线程池线程
  → ThreadLocal
  → 业务对象
  → Class
  → WebAppClassLoader
```

或者：

- 静态集合缓存了插件对象。
- 线程没有停止，线程上下文类加载器还是旧 WebAppClassLoader。
- JDBC Driver、日志框架、定时任务没有注销。
- MBean、ShutdownHook、全局监听器还引用旧应用对象。
- 线程池、Timer、异步回调还在运行旧版本代码。

排查可以看：

```bash
jstat -class <pid> 1000 5
jcmd <pid> VM.classloader_stats
```

观察类加载/卸载日志：

```bash
# JDK 9+
java -Xlog:class+load=info,class+unload=info -jar app.jar

# JDK 8
java -XX:+TraceClassLoading -XX:+TraceClassUnloading -jar app.jar
```

如果是热部署或插件卸载问题，排查时要看两件事：

1. 类数量是否只增不减。
2. 旧 ClassLoader 是否仍被某条 GC Roots 路径持有。

heap dump 里看到旧加载器还活着时，继续追引用链，通常能定位到线程、静态字段、注册表或全局单例。

## 打破委派时怎么控制边界？

可以把加载策略拆成三层：

```text
JDK / 基础 API       → 永远父优先
框架公共 API         → 通常父优先，保证类型统一
插件私有实现和依赖   → 可插件优先，实现隔离
```

如果插件和主应用共享某个接口，接口必须由双方共同可见的父加载器加载。否则插件返回的对象即使类名相同，主应用也可能无法识别它实现了哪个接口。

这就是插件系统里常见的“API 包放公共层，实现包放插件层”的原因。

## 容易踩的坑

1. 自定义 ClassLoader 不等于破坏双亲委派，普通场景重写 `findClass` 即可。
2. 要破坏委派才重写 `loadClass`，并且要控制范围。
3. 类名相同不代表类型相同，还要看 ClassLoader。
4. 热部署不只是替换 class 文件，旧加载器必须能被 GC。
5. JDK 9+ 的 PlatformClassLoader 和模块系统让 JDK 8 的 ExtClassLoader 口径不再完全适用。
6. 使用线程上下文类加载器后要恢复原值，尤其在线程池场景。

## 小结

- 自定义 ClassLoader 主要用于插件化、热部署、类隔离和特殊字节码来源。
- 不破坏双亲委派时优先重写 `findClass`。
- JVM 的类身份由类名和 ClassLoader 共同决定。
- 线程上下文类加载器解决了高层框架加载低层实现的问题。
- 类加载器泄漏是热部署和容器场景的高频坑，排查要看引用链和加载器统计。

## 参考

基于 Oracle Java SE Documentation、OpenJDK JEP、HotSpot VM 文档与 JDK 工具官方文档中 JVM、GC、类加载、监控与诊断相关内容整理。
