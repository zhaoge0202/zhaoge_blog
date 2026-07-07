---
title: "JDK 动态代理和 CGLIB 有什么区别？"
description: "从静态代理到 JDK 动态代理与 CGLIB，讲清两种动态代理的原理与选型。"
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
    text: "反射是什么？注解又是怎么靠反射工作的？",
    link: "/java/basis/java-basis-reflection-annotation.html",
  }
next:
  {
    text: "Lambda 和方法引用底层是怎么实现的？",
    link: "/java/basis/java-basis-lambda-invokedynamic.html",
  }
---

# JDK 动态代理和 CGLIB 有什么区别？

> 一句话：两者都是"运行时给目标方法套一层壳"，区别只在于套壳的手段——JDK 靠实现接口，CGLIB 靠继承子类。

## 代理到底在解决什么问题

先别急着背 API，想清楚代理这个模式是干嘛的：**在不改动原对象源码的前提下，给它的方法前后插入额外逻辑，或者干脆拦下来做点别的事情。**

现实里这类需求非常多：

- 方法调用前后打日志、记录耗时；
- 进方法前开事务、出方法时提交或回滚；
- 调用前做权限校验，没权限直接拒绝；
- RPC 里，本地调一个"接口方法"，代理帮你把参数序列化、发网络、拿结果——你以为在调本地方法，其实调的是远程服务。

这些逻辑有个共同点：它们和具体业务无关，却散落在一大堆方法里。如果每个方法都手写一遍，既啰嗦又容易漏。代理的价值就是把这层"横切逻辑"抽出来，统一挂到目标方法外面。

代理有两种实现思路：**静态代理**（写死在代码里，编译期就定了）和**动态代理**（运行时才生成代理类）。理解了静态代理的痛点，就明白动态代理为什么会出现。

## 静态代理：能用，但不好用

静态代理的做法很朴素：手写一个代理类，让它和目标类实现同一个接口，内部持有目标对象，在转发调用的前后加自己的逻辑。

```java
public interface SmsService {
    String send(String message);
}

public class SmsServiceImpl implements SmsService {
    public String send(String message) {
        System.out.println("send message: " + message);
        return message;
    }
}

// 手写的代理类，和目标类实现同一个接口
public class SmsProxy implements SmsService {
    private final SmsService target;

    public SmsProxy(SmsService target) {
        this.target = target;
    }

    @Override
    public String send(String message) {
        System.out.println("before send()");
        String result = target.send(message); // 转发给真实对象
        System.out.println("after send()");
        return result; // 记得把真实返回值透传出去
    }
}
```

用起来就是拿代理对象顶替真实对象：

```java
SmsService proxy = new SmsProxy(new SmsServiceImpl());
proxy.send("java");
// 输出：before send() / send message: java / after send()
```

看着挺清爽，问题在于**不可扩展**：

- **一个目标类要配一个代理类。** 有 100 个 Service 需要打日志，就得手写 100 个代理类，全是复制粘贴。
- **接口一变，代理跟着改。** 接口新增一个方法，目标类和代理类都得同步实现，漏一个就编译不过。
- **增强逻辑重复。** "before/after 打日志"这段代码在每个代理类里都要抄一遍。

所以静态代理在日常开发里几乎见不到，它更多是帮你理解代理思想。真正好用的是动态代理——**代理类不再手写，而是运行时动态生成。**

## JDK 动态代理：面向接口的运行时生成

JDK 动态代理是 JDK 自带的，不需要引任何依赖。它的核心是两样东西：`Proxy` 类和 `InvocationHandler` 接口。

思路是这样：你不再手写代理类，而是告诉 JDK "我要一个实现了这些接口的代理对象，所有方法调用都交给我的 `InvocationHandler` 处理"。JDK 就在运行时动态拼出一个实现了这些接口的类，加载进 JVM，返回它的实例。这个类没有 `.java` 也没有落地的 `.class` 文件，是内存里现生成的。

关键约定是：**调代理对象的任何一个接口方法，都会被转发到 `InvocationHandler.invoke()`。** 你在 `invoke` 里想干什么都行，通常是"加点料 + 用反射调真实方法 + 再加点料"。

完整跑一遍：

```java
// 1. 接口 + 实现（同上面的 SmsService / SmsServiceImpl）

// 2. 自定义 InvocationHandler
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

public class DebugInvocationHandler implements InvocationHandler {
    private final Object target; // 真实对象

    public DebugInvocationHandler(Object target) {
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("before method " + method.getName());
        Object result = method.invoke(target, args); // 反射调真实方法
        System.out.println("after method " + method.getName());
        return result;
    }
}

// 3. 生成代理对象
public class JdkProxyFactory {
    public static Object getProxy(Object target) {
        return Proxy.newProxyInstance(
                target.getClass().getClassLoader(),  // 类加载器
                target.getClass().getInterfaces(),   // 目标类实现的接口
                new DebugInvocationHandler(target)); // 处理逻辑
    }
}

// 4. 使用
SmsService smsService = (SmsService) JdkProxyFactory.getProxy(new SmsServiceImpl());
smsService.send("java");
// 输出：before method send / send message: java / after method send
```

`newProxyInstance` 的三个参数一句话记住：**用哪个类加载器、代理哪些接口、调用交给哪个 handler。**

这里有个绕不开的硬限制：**JDK 动态代理只能基于接口。** 生成的代理类本质是 `implements` 了你给的接口，所以：

- 目标类必须实现至少一个接口，否则没法代理；
- 拿到的代理对象只能转型成接口类型，**不能转成目标实现类**（它和 `SmsServiceImpl` 之间没有继承关系）；
- 只有接口里声明的方法会被代理，实现类里那些"接口没定义的方法"代理不到。

那目标类压根没接口怎么办？CGLIB 登场。

## CGLIB：面向继承，不挑接口

CGLIB 是个第三方字节码生成库，底层用 ASM 直接操作字节码。它的思路和 JDK 完全相反：**不实现接口，而是在运行时生成目标类的子类**，重写父类方法，在重写的方法里插增强逻辑。

因为走的是继承，所以**目标类不需要实现任何接口**，这正好补上了 JDK 动态代理的短板。核心是 `MethodInterceptor` 接口和 `Enhancer` 类。

```java
// 1. 一个没有实现接口的普通类
public class AliSmsService {
    public String send(String message) {
        System.out.println("send message: " + message);
        return message;
    }
}

// 2. 自定义 MethodInterceptor
import net.sf.cglib.proxy.MethodInterceptor;
import net.sf.cglib.proxy.MethodProxy;
import java.lang.reflect.Method;

public class DebugMethodInterceptor implements MethodInterceptor {
    @Override
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy)
            throws Throwable {
        System.out.println("before method " + method.getName());
        // 注意用 invokeSuper 调父类（真实）方法，不能用 method.invoke(obj, ...) 否则死循环
        Object result = proxy.invokeSuper(obj, args);
        System.out.println("after method " + method.getName());
        return result;
    }
}

// 3. 用 Enhancer 生成子类代理
import net.sf.cglib.proxy.Enhancer;

public class CglibProxyFactory {
    public static Object getProxy(Class<?> clazz) {
        Enhancer enhancer = new Enhancer();
        enhancer.setClassLoader(clazz.getClassLoader());
        enhancer.setSuperclass(clazz);                     // 设置父类 = 被代理类
        enhancer.setCallback(new DebugMethodInterceptor());
        return enhancer.create();
    }
}

// 4. 使用
AliSmsService service = (AliSmsService) CglibProxyFactory.getProxy(AliSmsService.class);
service.send("java");
```

一个容易写错的细节：`intercept` 里的第一个参数 `obj` 是**代理对象本身**，不是原始对象。想调真实方法要用 `MethodProxy.invokeSuper(obj, args)` 走父类逻辑；如果误写成 `method.invoke(obj, args)`，等于又调回代理对象，直接无限递归栈溢出。

代价也来自"继承"这个机制：**子类没法重写父类里 `final`、`private`、`static` 的方法**，所以 CGLIB **不能代理 `final` 类，也代理不了 `final`/`private`/`static` 方法**——它们要么不能被继承，要么不能被重写，增强逻辑自然插不进去。另外 CGLIB 需要单独引依赖。

## JDK vs CGLIB 怎么选

| 对比维度        | JDK 动态代理                   | CGLIB 动态代理                                       |
| --------------- | ------------------------------ | ---------------------------------------------------- |
| 实现原理        | 运行时生成**实现接口**的代理类 | 运行时生成**继承目标类**的子类                       |
| 是否需要接口    | 必须，目标类要实现接口         | 不需要，普通类也能代理                               |
| 对 final 的限制 | 无（本来就走接口）             | 不能代理 `final` 类、`final`/`private`/`static` 方法 |
| 依赖            | JDK 内置，无需引入             | 需引入 CGLIB（Spring 已把它重打包进 `spring-core`）  |
| 代理对象类型    | 只能当成接口用                 | 是目标类的子类，可当目标类型用                       |
| 性能            | 见下方说明                     | 见下方说明                                           |

关于性能，网上常见的说法是"JDK 动态代理更快，且随版本升级优势越明显"，这个结论**要拆开看，不能一概而论**：

- **创建代理对象**：JDK 一般更快，CGLIB 要生成子类字节码，开销更大——但代理对象通常只建一次，影响有限。
- **方法调用**：早年 CGLIB 靠 `FastClass` 用索引直接定位方法，避开反射，单次调用比早期 JDK 反射式调用更快；后来 JDK 各版本对 `Proxy` 的调用路径持续优化，两者差距已经很小。

所以实际选型基本不看这点性能差，而是看**有没有接口、目标能不能被继承**。真正拍板的往往是框架，而不是你手写。

## 框架里的动态代理：Spring AOP

Spring AOP 是动态代理最典型的落地场景。事务（`@Transactional`）、日志、权限这些横切逻辑，Spring 都是靠给 Bean 生成代理对象来织入的。

Spring 的选择策略很直接：

- 目标类**实现了接口** → 默认用 **JDK 动态代理**；
- 目标类**没有接口** → 用 **CGLIB**；
- 想强制全部走 CGLIB → 设置 `proxyTargetClass=true`（注解式为 `@EnableAspectJAutoProxy(proxyTargetClass = true)`）。

需要留意版本差异：**Spring Boot 从 2.x 起，AOP 默认就用 CGLIB**（`spring.aop.proxy-target-class` 默认为 `true`）。这样做的好处是即便某个类同时实现了接口，也能拿到"目标类本身类型"的代理，避免只能按接口注入带来的一些坑。所以在 Spring Boot 项目里，别想当然认为"有接口就一定是 JDK 代理"。

Spring AOP 具体怎么把切面织入代理链、和 AspectJ 有什么区别，属于框架层的话题，在 system-design/framework 的 Spring AOP 专篇里展开。

## 容易踩的坑

- **JDK 代理只认接口方法。** 目标类里没在接口声明的方法代理不到，拿到的代理也不能强转成实现类，只能按接口用。
- **CGLIB 碰 final 就失效。** `final` 类、`final`/`private`/`static` 方法无法被子类重写，增强逻辑加不上去，还容易让人误以为"代理没生效"。
- **自调用（this 调用）不走代理，AOP 会失效。** 这是最隐蔽的一个：Spring 增强的是**代理对象**，只有从外部经代理对象进来的调用才会被拦截。如果一个方法内部用 `this.otherMethod()` 调本类的另一个 `@Transactional` 方法，走的是原始对象的引用，绕过了代理，事务/切面直接不生效。绕开办法：把方法拆到另一个 Bean、注入自身代理再调、或用 `AopContext.currentProxy()` 拿到当前代理对象。
- **CGLIB 的 `intercept` 里别用 `method.invoke(obj, args)`。** `obj` 是代理对象，这么调会无限递归，必须用 `proxy.invokeSuper(obj, args)`。

## 小结

- 代理的本质是"不改源码给方法套壳"，静态代理手写、动态代理运行时生成，日常用的都是动态代理。
- JDK 动态代理基于**接口**，用 `Proxy.newProxyInstance` + `InvocationHandler`，无需额外依赖，但目标类必须实现接口。
- CGLIB 基于**继承**，用 `Enhancer` + `MethodInterceptor` 生成子类，不挑接口，但代理不了 `final` 类和 `final`/`private`/`static` 方法。
- 选型主要看"有没有接口、能不能被继承"，性能差异在现代 JDK 下已很小，不必纠结。
- Spring AOP 有接口默认 JDK、无接口用 CGLIB；Spring Boot 2.x 起默认 CGLIB。最常见的暗坑是自调用绕过代理导致 AOP 失效。

## 参考

- Oracle 官方文档：Dynamic Proxy Classes（`java.lang.reflect.Proxy` / `InvocationHandler`）
- CGLIB 项目主页与 ASM 字节码库文档
- Spring Framework 官方文档：Aspect Oriented Programming with Spring（代理机制章节）
