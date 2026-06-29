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

排查可以看：

```bash
jcmd <pid> VM.classloader_stats
```

观察类加载/卸载日志：

```bash
# JDK 9+
java -Xlog:class+load=info,class+unload=info -jar app.jar

# JDK 8
java -XX:+TraceClassLoading -XX:+TraceClassUnloading -jar app.jar
```

## 容易踩的坑

1. 自定义 ClassLoader 不等于破坏双亲委派，普通场景重写 `findClass` 即可。
2. 要破坏委派才重写 `loadClass`，并且要控制范围。
3. 类名相同不代表类型相同，还要看 ClassLoader。
4. 热部署不只是替换 class 文件，旧加载器必须能被 GC。
5. JDK 9+ 的 PlatformClassLoader 和模块系统让 JDK 8 的 ExtClassLoader 口径不再完全适用。

## 小结

- 自定义 ClassLoader 主要用于插件化、热部署、类隔离和特殊字节码来源。
- 不破坏双亲委派时优先重写 `findClass`。
- JVM 的类身份由类名和 ClassLoader 共同决定。
- 线程上下文类加载器解决了高层框架加载低层实现的问题。
- 类加载器泄漏是热部署和容器场景的高频坑，排查要看引用链和加载器统计。

## 参考

综合自《类加载器详解》《类加载过程详解》《Class 文件结构总结》，并结合 Tomcat、SPI、线程上下文类加载器和 `jcmd VM.classloader_stats` 排查方式做了工程化整理。
