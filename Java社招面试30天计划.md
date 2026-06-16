# Java 社招面试 30 天学习手册

> 版本：2026-06-16
>
> 适用对象：准备 Java 后端社招面试，尤其是 0-5 年经验、想用一个月系统补齐八股和项目表达的人
>
> 核心资料：
> - [JavaGuide](https://javaguide.cn/)：负责搭框架、补全知识地图、统一术语和主线
> - [小林coding](https://xiaolincoding.com/)：负责把高频原理讲透，补足追问深度和场景理解
>
> 本手册的设计原则：
> - 不是把两个站点简单拼接，而是按面试真实顺序杂糅
> - 不是“知道有哪些知识点”，而是“每天该看什么、想什么、说什么、输出什么”
> - 不是只看八股，还要同步准备项目表述、场景题和追问链路

---

## 1. 先说清楚：这 30 天怎么用

如果你每天只有 2 小时，也能做，但建议尽量给到 3-4 小时。最理想的节奏如下：

1. `第一段 60-90 分钟`：读主资料，建立当天知识主线
2. `第二段 45-60 分钟`：读补强资料，把“为什么”补齐
3. `第三段 30-45 分钟`：合上资料，口述高频题
4. `第四段 20-30 分钟`：写错题、写回答模板、做复盘

每天都必须有输出，不能只看不说。最低输出标准：

- 8-10 个问答卡片
- 1 份当天知识导图或提纲
- 1 次 10-20 分钟脱稿口述
- 1 份错题记录

推荐你准备 4 个文档或笔记区域：

1. `01-面试问答卡片.md`
2. `02-项目回答稿.md`
3. `03-错题本.md`
4. `04-系统设计题库.md`

---

## 2. 两个站点分别怎么用

### 2.1 JavaGuide 在这份计划里的角色

JavaGuide 更适合承担这些任务：

- 帮你确定学习顺序
- 帮你快速覆盖 Java 后端全栈知识
- 帮你建立面试回答时的标准概念和标准表述
- 在你已经学过之后，作为总复习入口反复刷

尤其建议重点依赖 JavaGuide 的模块：

- [Java 后端面试通关计划](https://javaguide.cn/interview-preparation/backend-interview-plan.html)
- [Java 基础](https://javaguide.cn/java/basis/java-basic-questions-01.html)
- [Java 集合](https://javaguide.cn/java/collection/java-collection-questions-01.html)
- [Java 并发](https://javaguide.cn/java/concurrent/java-concurrent-questions-01.html)
- [JVM](https://javaguide.cn/java/jvm/)
- [Spring](https://javaguide.cn/system-design/framework/spring/spring-knowledge-and-questions-summary.html)
- [MySQL](https://javaguide.cn/database/mysql/mysql-questions-01.html)
- [Redis](https://javaguide.cn/database/redis/redis-questions-01.html)
- [分布式](https://javaguide.cn/distributed-system/distributed-system-interview-questions.html)
- [高性能](https://javaguide.cn/high-performance/high-performance-interview-questions.html)
- [计算机网络](https://javaguide.cn/cs-basics/network/other-network-questions.html)
- [操作系统](https://javaguide.cn/cs-basics/operating-system/operating-system-basic-questions-01.html)

### 2.2 小林coding 在这份计划里的角色

小林coding 更适合承担这些任务：

- 把 MySQL、Redis、网络、操作系统这些“最容易被追问”的模块讲透
- 帮你回答“为什么是这样设计”
- 帮你从概念层面走到机制层面
- 帮你练习更贴近真实面试语境的问法

尤其建议重点依赖小林coding 的模块：

- [Java 面试题汇总](https://xiaolincoding.com/interview/)
- [图解 MySQL](https://xiaolincoding.com/mysql/)
- [图解 Redis](https://xiaolincoding.com/redis/)
- [图解网络](https://xiaolincoding.com/network/)
- [图解系统](https://xiaolincoding.com/os/)
- [MySQL 面试题](https://xiaolincoding.com/interview/mysql.html)
- [Redis 面试题](https://xiaolincoding.com/interview/redis.html)
- [Spring 面试题](https://xiaolincoding.com/interview/spring.html)
- [操作系统面试题](https://xiaolincoding.com/interview/os.html)
- [计算机网络面试题](https://xiaolincoding.com/interview/network.html)
- [消息队列面试题](https://xiaolincoding.com/interview/mq.html)
- [系统设计面试题](https://xiaolincoding.com/interview/systemdesign.html)

### 2.3 杂糅方法

这份计划统一遵循一个顺序：

1. 先用 `JavaGuide` 看全貌
2. 再用 `小林coding` 看深处
3. 然后自己脱稿讲
4. 最后整理成“我在面试里会怎么答”

也就是：

`看框架 -> 补原理 -> 练口述 -> 形成回答稿`

---

## 3. 学习总目标与优先级

### 3.1 一个月后你应该达到的状态

不是每个知识点都达到“源码专家”水平，而是达到以下面试可用状态：

- `Java 基础/集合/并发/JVM`：能讲主线，能扛 2-3 层追问
- `MySQL/Redis`：能讲原理，能讲优化点，能联系项目
- `Spring`：能讲 IOC/AOP/事务/循环依赖/自动装配
- `网络/操作系统`：能讲概念，更能讲机制和实际场景
- `分布式/MQ/系统设计`：能答中型公司常见题，不至于失血
- `项目`：能从业务、技术、性能、稳定性四个角度讲深

### 3.2 优先级排序

如果时间不够，优先保这几个模块：

1. 并发
2. JVM
3. MySQL
4. Redis
5. Spring
6. 项目深挖
7. 网络
8. 操作系统
9. 分布式 / MQ / 系统设计
10. Java 基础零散语法题

---

## 4. 每天固定执行模板

后面的 Day1-Day30 全都按这个模板执行。

### 4.1 当天流程

1. `预热 10 分钟`
   - 回看昨天错题
   - 用 3 句话复述昨天核心内容

2. `主学习 60-90 分钟`
   - 先看 JavaGuide 主线文章
   - 做关键词提取

3. `补强 45-60 分钟`
   - 读小林coding 对应模块
   - 看图、看原理、看追问

4. `口述 30 分钟`
   - 至少回答 5 道题
   - 每题要求 30 秒版、2 分钟版都能说

5. `收尾 20-30 分钟`
   - 记录错题
   - 更新问答卡片
   - 给当天打分

### 4.2 每天打分标准

满分 5 分：

- `5 分`：当天题目基本能脱稿讲
- `4 分`：能讲主线，但追问会卡
- `3 分`：看懂了，但讲不出来
- `2 分`：很多内容只停留在印象
- `1 分`：基本没学完

低于 4 分的模块，必须进入下一次周复盘。

### 4.3 问答卡片建议格式

```md
## 问题
HashMap 为什么要求容量尽量是 2 的幂？

## 30 秒版回答
因为这样可以把取模运算替换成 `(n - 1) & hash`，性能更高，而且能让哈希值更均匀地分布到桶中。

## 2 分钟版回答
HashMap 计算桶下标时不是直接 `%`，而是用 `(n - 1) & hash`。这个写法成立的前提是 n 是 2 的幂...

## 追问
- 如果不是 2 的幂会怎样？
- `new HashMap(17)` 最终会变成多少？
- 扰动函数起什么作用？
```

---

## 5. 30 天详细计划

---

## Day 1：定盘子，先把项目和简历打通

### 学习目标

建立整个 30 天的面试框架，先把最容易在第一轮被问死的项目介绍准备出来。

### 主读资料

- [JavaGuide：Java 后端面试通关计划](https://javaguide.cn/interview-preparation/backend-interview-plan.html)
- [小林coding：Java 面试题汇总](https://xiaolincoding.com/interview/)

### 当天任务

1. 通读 JavaGuide 通关计划，理解大模块顺序
2. 浏览小林面试题总目录，知道后续补强入口在哪里
3. 梳理你简历里最重要的 2 个项目
4. 每个项目都写出：
   - 项目背景
   - 业务目标
   - 你负责什么
   - 系统大概架构
   - 技术难点
   - 性能/稳定性问题
   - 结果指标
   - 复盘和改进

### 必掌握内容

- 自我介绍 1 分钟版
- 项目介绍 1 分钟版
- 项目介绍 3 分钟版
- “为什么选这些技术栈” 的标准回答

### 今天必须输出

- `项目 A` 的 1 分钟版、3 分钟版
- `项目 B` 的 1 分钟版、3 分钟版
- 一张你的个人技术栈短板清单

### 自测问题

1. 介绍一下你最有成就感的项目。
2. 你在项目里真正做了什么？
3. 项目里的最大技术难点是什么？
4. 为什么用 Redis / MySQL / MQ，而不是别的方案？
5. 如果重做一次，你会怎么改？

### 复盘标准

- 不看简历，能否完整说出 2 个项目主线
- 是否能把“业务问题”和“技术方案”连接起来

---

## Day 2：Java 基础上半部分

### 学习目标

打牢所有后续模块的语言基础，解决基础语法题一问就虚的问题。

### 主读资料

- [JavaGuide：Java 基础常见面试题 01](https://javaguide.cn/java/basis/java-basic-questions-01.html)

### 补强资料

- 回看小林面试题汇总中的 Java 相关章节目录，建立问题感

### 当天重点

- 面向对象三大特性
- 重载和重写
- `==` 与 `equals`
- `hashCode`
- String、StringBuilder、StringBuffer
- 自动装箱拆箱
- 基本类型与包装类型
- `final`

### 必会讲法

- 为什么重写 `equals` 往往要重写 `hashCode`
- String 为什么不可变
- 包装类缓存池为什么面试爱问

### 今天必须输出

- 10 张基础问答卡片
- 一份“Java 基础最容易答错的 8 个点”清单

### 自测问题

1. `==` 和 `equals()` 的区别是什么？
2. 为什么重写 `equals()` 要重写 `hashCode()`？
3. String 为什么不可变？
4. `StringBuilder` 和 `StringBuffer` 有什么区别？
5. 自动装箱拆箱会带来什么问题？
6. `Integer` 缓存范围是多少？为什么常问 `127` 和 `128`？
7. `final` 可以修饰什么？分别是什么意思？

### 复盘标准

- 能否口述出 String 不可变的 3 个好处
- 能否讲清 `Integer a = 127` 和 `128` 的比较差异

---

## Day 3：Java 基础下半部分

### 主读资料

- [JavaGuide：Java 基础常见面试题 02](https://javaguide.cn/java/basis/java-basic-questions-02.html)

### 当天重点

- 深拷贝与浅拷贝
- 异常体系
- 反射
- 注解
- 泛型与类型擦除
- 代理模式基础

### 补强思路

今天不用追太多源码，重点是形成“能回答”的完整表述。

### 今天必须输出

- 8-10 张问答卡片
- 一份“泛型、反射、注解分别解决什么问题”的对比表

### 自测问题

1. 深拷贝和浅拷贝区别？
2. Checked Exception 和 Unchecked Exception 区别？
3. 反射的优缺点？
4. 注解的本质是什么？
5. 泛型为什么存在类型擦除？
6. Java 动态代理的基本原理是什么？

### 复盘标准

- 能否用 2 分钟把反射讲清楚，不只停留在“运行时获取类信息”
- 能否说出泛型的收益和代价

---

## Day 4：集合框架总览

### 主读资料

- [JavaGuide：Java 集合常见面试题 01](https://javaguide.cn/java/collection/java-collection-questions-01.html)

### 当天重点

- List / Set / Queue / Map 分类
- ArrayList vs LinkedList
- HashSet / LinkedHashSet / TreeSet
- Queue / Deque 常见实现
- Collections 工具类基础

### 补强思路

今天先建立集合地图，不立刻钻 HashMap 源码。

### 今天必须输出

- 一张集合总览脑图
- 一张各容器适用场景对比表

### 自测问题

1. Java 常见集合体系怎么分？
2. ArrayList 和 LinkedList 区别？
3. HashSet 和 TreeSet 区别？
4. Queue 和 Deque 分别适合什么场景？
5. 为什么面试官喜欢从集合问到源码？

### 复盘标准

- 是否能从“是否有序、是否可重复、查改性能、线程安全”四个维度对比集合

---

## Day 5：ArrayList、List 相关源码与细节

### 主读资料

- [JavaGuide：Java 集合常见面试题 02](https://javaguide.cn/java/collection/java-collection-questions-02.html)
- [JavaGuide：ArrayList 源码分析](https://javaguide.cn/java/collection/arraylist-source-code.html)

### 当天重点

- ArrayList 底层结构
- 默认容量
- 扩容机制
- `modCount` 和 fail-fast
- `Arrays.asList()` 陷阱
- CopyOnWriteArrayList 适用场景

### 今天必须输出

- 一份 ArrayList 扩容流程图
- 一份“List 相关 10 连问”回答模板

### 自测问题

1. ArrayList 默认容量是多少？
2. 第一次 add 时会发生什么？
3. 扩容为什么是 1.5 倍？
4. fail-fast 是怎么实现的？
5. `Arrays.asList()` 为什么不能随便 add/remove？
6. CopyOnWriteArrayList 为什么适合读多写少？

### 复盘标准

- 能否把 ArrayList 从“创建、添加、扩容、遍历删除风险”一路讲顺

---

## Day 6：HashMap 重中之重

### 主读资料

- [JavaGuide：HashMap 源码分析](https://javaguide.cn/java/collection/hashmap-source-code.html)

### 当天重点

- 数组 + 链表 + 红黑树
- 扰动函数
- 桶下标计算
- 负载因子
- 扩容机制
- 树化阈值和退化阈值
- JDK7 与 JDK8 区别
- 线程不安全问题

### 今天必须输出

- 一份 HashMap 全流程口述稿
- 一份“HashMap 高频追问链路”

### 高频追问链路建议

1. HashMap 底层结构？
2. 为什么数组长度尽量是 2 的幂？
3. 扰动函数起什么作用？
4. 为什么链表长度到 8 才树化？
5. 为什么数组长度还要求至少 64？
6. JDK7 为什么会死循环？
7. HashMap 为什么线程不安全？

### 自测问题

1. HashMap 的 put 流程是什么？
2. 扩容后元素怎么迁移？
3. 为什么 JDK8 不需要重新算全部桶位？
4. 负载因子为什么默认 0.75？
5. 红黑树什么时候退化成链表？

### 复盘标准

- 能否不看资料完整回答“HashMap 为什么这么设计”

---

## Day 7：ConcurrentHashMap 与第一周复盘

### 主读资料

- [JavaGuide：ConcurrentHashMap 源码分析](https://javaguide.cn/java/collection/concurrent-hash-map-source-code.html)

### 当天重点

- JDK7 Segment 分段锁
- JDK8 `CAS + synchronized`
- put 流程
- size 统计思路
- 为什么不允许 null

### 本周复盘任务

1. 回看 Day2-Day6 所有问答卡片
2. 至少做 1 次 45 分钟集合专题口述
3. 补齐 Java 基础与集合里讲不顺的题

### 今天必须输出

- 一份 `Java 基础 + 集合` 模块总复盘表
- 一份你的 Top 10 易错题

### 自测问题

1. ConcurrentHashMap JDK7 和 JDK8 的实现差异？
2. JDK8 为什么重新用 `synchronized`？
3. ConcurrentHashMap 和 Hashtable 有什么区别？
4. 为什么不允许 key/value 为 null？

### 复盘标准

- 你能否用 15 分钟讲完“Java 基础 + 集合”

---

## Day 8：并发基础

### 主读资料

- [JavaGuide：Java 并发常见面试题 01](https://javaguide.cn/java/concurrent/java-concurrent-questions-01.html)
- [JavaGuide：Java 并发常见面试题 02](https://javaguide.cn/java/concurrent/java-concurrent-questions-02.html)

### 当天重点

- 进程和线程
- 线程生命周期
- `start()` 和 `run()`
- `sleep()` 和 `wait()`
- 并发与并行
- JMM 基础

### 今天必须输出

- 一份线程生命周期图
- 一份并发基础问答 10 题

### 自测问题

1. 线程有几种状态？
2. `sleep()` 和 `wait()` 区别？
3. `start()` 和 `run()` 区别？
4. 什么是线程上下文切换？
5. JMM 解决什么问题？

### 复盘标准

- 能否把线程基础问题讲得不混乱

---

## Day 9：volatile 与 synchronized

### 主读资料

- [JavaGuide：Java 并发常见面试题 03](https://javaguide.cn/java/concurrent/java-concurrent-questions-03.html)
- [JavaGuide：乐观锁与悲观锁](https://javaguide.cn/java/concurrent/optimistic-lock-and-pessimistic-lock.html)

### 当天重点

- `volatile` 可见性
- 指令重排
- 内存屏障
- `volatile` 不保证原子性
- `synchronized` 的使用范围
- 锁升级
- 对象头和 Mark Word

### 今天必须输出

- 一份 `volatile vs synchronized vs Lock` 对比表
- 一份 `happens-before` 规则提纲

### 自测问题

1. `volatile` 解决什么问题？
2. 为什么 `volatile` 不能保证 `i++` 原子性？
3. `synchronized` 底层怎么实现？
4. 锁升级过程是什么？
5. `happens-before` 规则有哪些？

### 复盘标准

- 能否讲清“可见性、原子性、有序性”这三个词

---

## Day 10：CAS、AQS、ReentrantLock

### 主读资料

- [JavaGuide：AQS 原理](https://javaguide.cn/java/concurrent/aqs.html)
- [JavaGuide：ReentrantLock 详解](https://javaguide.cn/java/concurrent/reentrantlock.html)

### 当天重点

- CAS
- ABA 问题
- `Unsafe`
- AQS 核心结构
- CLH 队列
- 公平锁与非公平锁
- 可重入原理

### 今天必须输出

- 一张 AQS 结构图
- 一份 CAS/AQS/ReentrantLock 问答卡片集

### 自测问题

1. 什么是 CAS？优缺点是什么？
2. ABA 问题怎么解决？
3. AQS 的核心变量有哪些？
4. ReentrantLock 可重入是怎么做到的？
5. 公平锁和非公平锁区别？

### 复盘标准

- 能否从 “CAS 为什么快” 讲到 “AQS 为什么通用”

---

## Day 11：线程池、ThreadLocal、并发工具类

### 主读资料

- [JavaGuide：线程池详解](https://javaguide.cn/java/concurrent/java-thread-pool-summary.html)
- [JavaGuide：ThreadLocal 详解](https://javaguide.cn/java/concurrent/threadlocal.html)

### 当天重点

- 线程池 7 大参数
- 执行流程
- 4 种拒绝策略
- 为什么不建议用 Executors
- CPU 密集型与 IO 密集型线程数设置
- ThreadLocal 原理
- ThreadLocal 内存泄漏
- CountDownLatch、CyclicBarrier、Semaphore

### 今天必须输出

- 一份线程池参数速查表
- 一份 ThreadLocal 泄漏原理图

### 自测问题

1. 线程池的任务提交流程是什么？
2. 4 种拒绝策略分别适合什么情况？
3. Executors 为什么不推荐？
4. ThreadLocal 为什么会内存泄漏？
5. CountDownLatch 和 CyclicBarrier 有什么区别？

### 复盘标准

- 能否从“业务线程池如何配置”联系到你自己的项目

---

## Day 12：JVM 内存结构

### 主读资料

- [JavaGuide：Java 内存区域](https://javaguide.cn/java/jvm/memory-area.html)

### 当天重点

- 程序计数器
- 虚拟机栈
- 本地方法栈
- 堆
- 方法区 / 元空间
- 对象创建流程
- 对象访问定位

### 今天必须输出

- 一张 JVM 运行时数据区图
- 一份“各区域存什么、谁共享、会不会 OOM”的表

### 自测问题

1. JVM 运行时数据区有哪些？
2. 哪些区域线程私有，哪些共享？
3. 对象创建过程是什么？
4. JDK8 为什么改成元空间？
5. 为什么程序计数器基本不会 OOM？

### 复盘标准

- 能否不混淆“堆、栈、方法区”

---

## Day 13：GC 基础与垃圾判定

### 主读资料

- [JavaGuide：JVM 垃圾回收](https://javaguide.cn/java/jvm/jvm-garbage-collection.html)

### 当天重点

- 可达性分析
- GC Roots
- 强软弱虚引用
- 标记清除
- 复制算法
- 标记整理
- 分代回收思想

### 今天必须输出

- 一份 GC 算法对比表
- 一份“GC 高频问答 10 题”

### 自测问题

1. 如何判断对象是否可回收？
2. GC Roots 有哪些？
3. 四种引用分别是什么？
4. 为什么新生代常用复制算法？
5. 为什么老年代通常不直接用复制算法？

### 复盘标准

- 能否把算法与不同代的特点挂钩

---

## Day 14：垃圾收集器与故障排查

### 主读资料

- [JavaGuide：JDK 监控和故障处理工具](https://javaguide.cn/java/jvm/jdk-monitoring-and-troubleshooting-tools.html)
- [JavaGuide：JVM 垃圾回收](https://javaguide.cn/java/jvm/jvm-garbage-collection.html)

### 当天重点

- Serial、ParNew、Parallel、CMS、G1、ZGC
- CMS 流程与缺点
- G1 Region 思想
- 常见调优参数
- `jps`、`jstack`、`jmap`、`jstat`
- CPU 飙高 / OOM 排查思路

### 今天必须输出

- 一份常见垃圾收集器横向对比表
- 一份“线上 JVM 问题排查模板”

### 自测问题

1. CMS 的工作流程是什么？
2. G1 比 CMS 改进了什么？
3. Full GC 可能由什么触发？
4. 线上 CPU 100% 如何排查？
5. 内存泄漏怎么定位？

### 复盘标准

- 能否回答“你线上遇到 OOM 会怎么查”

---

## Day 15：类加载机制与第二周复盘

### 主读资料

- [JavaGuide：类加载过程](https://javaguide.cn/java/jvm/class-loading-process.html)
- [JavaGuide：类加载器](https://javaguide.cn/java/jvm/classloader.html)

### 当天重点

- 加载、验证、准备、解析、初始化
- 双亲委派
- 类加载器层级
- SPI、Tomcat 打破双亲委派

### 本周复盘任务

1. 用 20 分钟脱稿讲一遍 JVM 主线
2. 补齐 JVM 错题
3. 把 JVM 和并发里最容易卡壳的题单独摘出

### 今天必须输出

- 一份 JVM 总复盘清单
- 一份“JVM 15 题冲刺卡”

### 自测问题

1. 类加载过程有哪些阶段？
2. 双亲委派的好处是什么？
3. Tomcat 为什么要打破双亲委派？
4. SPI 的本质是什么？

### 复盘标准

- JVM 模块能否在 15 分钟内讲出框架

---

## Day 16：MySQL 索引原理

### 主读资料

- [JavaGuide：MySQL 索引详解](https://javaguide.cn/database/mysql/mysql-index.html)
- [JavaGuide：MySQL 常见面试题](https://javaguide.cn/database/mysql/mysql-questions-01.html)

### 补强资料

- [小林：为什么 MySQL 用 B+ 树做索引](https://xiaolincoding.com/mysql/index/why_index_chose_bpus_tree.html)
- [小林：从数据页的角度看 B+ 树](https://xiaolincoding.com/mysql/index/page.html)

### 当天重点

- B+ 树结构
- 聚簇索引与二级索引
- 回表
- 最左前缀
- 覆盖索引
- 索引下推
- 索引失效
- 自增主键

### 今天必须输出

- 一张 InnoDB 索引结构图
- 一份“索引优化口述稿”

### 自测问题

1. 为什么 MySQL 使用 B+ 树而不是 B 树、红黑树或哈希？
2. 什么是聚簇索引？什么是回表？
3. 联合索引最左前缀怎么理解？
4. 覆盖索引和索引下推分别是什么？
5. 什么情况会导致索引失效？

### 复盘标准

- 能否讲清楚“索引为什么快”和“索引为什么也可能失效”

---

## Day 17：事务、隔离级别、MVCC

### 主读资料

- [JavaGuide：MySQL 常见面试题](https://javaguide.cn/database/mysql/mysql-questions-01.html)

### 补强资料

- [小林：事务隔离级别是怎么实现的](https://xiaolincoding.com/mysql/transaction/mvcc.html)

### 当天重点

- ACID
- 四种隔离级别
- 脏读、不可重复读、幻读
- 当前读与快照读
- ReadView
- undo log 版本链
- RC 与 RR 差异

### 今天必须输出

- 一份 MVCC 原理图
- 一份隔离级别对比表

### 自测问题

1. ACID 分别靠什么保证？
2. RC 和 RR 区别是什么？
3. MVCC 是怎么工作的？
4. ReadView 什么时候生成？
5. RR 为什么还能谈到幻读？

### 复盘标准

- 能否从“事务”自然讲到“MVCC”

---

## Day 18：锁、日志、执行流程

### 主读资料

- [小林：MySQL 锁](https://xiaolincoding.com/mysql/lock/mysql_lock.html)
- [小林：redo/undo/binlog](https://xiaolincoding.com/mysql/log/how_update.html)

### 当天重点

- 表锁、行锁
- 记录锁、间隙锁、临键锁
- 共享锁、排他锁
- redo log
- undo log
- binlog
- 两阶段提交
- 一条 update 语句执行流程

### 今天必须输出

- 一份 MySQL 三大日志对比表
- 一份 update 执行流程口述稿

### 自测问题

1. redo log 和 binlog 区别？
2. 为什么需要两阶段提交？
3. 间隙锁和临键锁有什么用？
4. 一条 update 语句经历了什么？
5. 死锁怎么排查和避免？

### 复盘标准

- 能否从事务一致性讲到日志和锁

---

## Day 19：Redis 数据结构与底层实现

### 主读资料

- [JavaGuide：Redis 常见面试题 01](https://javaguide.cn/database/redis/redis-questions-01.html)

### 补强资料

- [小林：Redis 数据结构](https://xiaolincoding.com/redis/data_struct/data_struct.html)

### 当天重点

- String、List、Hash、Set、ZSet
- SDS
- quicklist
- skiplist
- hashtable
- intset
- Redis 为什么快

### 今天必须输出

- 一张 Redis 数据结构与底层编码对照表
- 一份“为什么 Redis 快”的标准回答

### 自测问题

1. Redis 常见数据类型及使用场景？
2. String 底层 SDS 有什么优势？
3. ZSet 为什么用跳表？
4. Redis 为什么快？
5. Redis 6.0 多线程做了什么？

### 复盘标准

- 能否不只背数据类型，而是能联系实际业务场景

---

## Day 20：Redis 持久化、过期、淘汰

### 主读资料

- [小林：Redis 持久化 AOF/RDB](https://xiaolincoding.com/redis/storage/aof.html)
- [小林：过期删除与内存淘汰](https://xiaolincoding.com/redis/module/strategy.html)

### 当天重点

- RDB
- AOF
- AOF 重写
- 混合持久化
- 惰性删除与定期删除
- LRU/LFU
- 淘汰策略

### 今天必须输出

- 一份 `RDB vs AOF` 对比表
- 一份 Redis 过期与淘汰总结卡

### 自测问题

1. RDB 和 AOF 区别？
2. AOF 三种刷盘策略是什么？
3. Redis 为什么不实时删除所有过期键？
4. Redis 内存淘汰策略有哪些？
5. LRU 和 LFU 区别？

### 复盘标准

- 能否回答“你会怎么选 Redis 持久化方案”

---

## Day 21：缓存问题、一致性、高可用

### 主读资料

- [JavaGuide：Redis 常见面试题 02](https://javaguide.cn/database/redis/redis-questions-02.html)
- [JavaGuide：分布式锁](https://javaguide.cn/distributed-system/distributed-lock.html)

### 补强资料

- [小林：缓存雪崩、击穿、穿透](https://xiaolincoding.com/redis/cluster/cache_problem.html)
- [小林：主从、哨兵、Cluster](https://xiaolincoding.com/redis/cluster/master_slave_replication.html)

### 当天重点

- 缓存穿透、击穿、雪崩
- 缓存与数据库一致性
- 延迟双删
- binlog 同步思路
- 主从复制
- 哨兵
- Cluster 槽位
- 分布式锁
- Redisson 看门狗

### 今天必须输出

- 一份缓存三大问题对比表
- 一份分布式锁回答模板

### 自测问题

1. 缓存穿透、击穿、雪崩怎么区分？
2. 为什么一般删除缓存而不是更新缓存？
3. 如何保证缓存和数据库一致性？
4. Redis 分布式锁有哪些坑？
5. Redisson 的看门狗做了什么？

### 复盘标准

- 能否把缓存问题和你项目里的场景挂起来

---

## Day 22：Spring IOC、AOP、Bean 生命周期

### 主读资料

- [JavaGuide：Spring 常见面试题总结](https://javaguide.cn/system-design/framework/spring/spring-knowledge-and-questions-summary.html)

### 补强资料

- [小林：Spring 面试题](https://xiaolincoding.com/interview/spring.html)

### 当天重点

- IOC
- DI
- BeanFactory / ApplicationContext
- AOP
- JDK 动态代理 / CGLIB
- Bean 生命周期
- BeanPostProcessor

### 今天必须输出

- 一张 Spring IOC/AOP 关系图
- 一份 Spring 核心 10 题卡片

### 自测问题

1. 什么是 IOC 和 DI？
2. BeanFactory 和 ApplicationContext 区别？
3. AOP 解决什么问题？
4. JDK 动态代理和 CGLIB 区别？
5. Bean 生命周期大致流程是什么？

### 复盘标准

- 能否用自己的话讲 Spring，不只背概念

---

## Day 23：事务、循环依赖、自动装配

### 主读资料

- [JavaGuide：Spring Boot 自动装配原理](https://javaguide.cn/system-design/framework/spring/spring-boot-auto-assembly-principles.html)
- [JavaGuide：Spring 常见面试题总结](https://javaguide.cn/system-design/framework/spring/spring-knowledge-and-questions-summary.html)

### 补强资料

- [小林：Spring 面试题](https://xiaolincoding.com/interview/spring.html)

### 当天重点

- `@Transactional` 原理
- 事务传播行为
- 事务失效场景
- 循环依赖
- 三级缓存
- 自动装配

### 今天必须输出

- 一张三级缓存示意图
- 一份事务失效场景清单

### 自测问题

1. `@Transactional` 为什么会失效？
2. REQUIRED 和 REQUIRES_NEW 区别？
3. Spring 为什么用三级缓存解决循环依赖？
4. 自动装配核心流程是什么？
5. 为什么有些循环依赖无法解决？

### 复盘标准

- 能否讲清“循环依赖”和“事务失效”两个高频坑

---

## Day 24：计算机网络之 TCP

### 主读资料

- [JavaGuide：计算机网络常见面试题](https://javaguide.cn/cs-basics/network/other-network-questions.html)

### 补强资料

- [小林：TCP 面试题](https://xiaolincoding.com/network/3_tcp/tcp_interview.html)
- [小林：计算机网络面试题](https://xiaolincoding.com/interview/network.html)

### 当天重点

- TCP / UDP 区别
- 三次握手
- 四次挥手
- TIME_WAIT
- 重传机制
- 流量控制
- 拥塞控制

### 今天必须输出

- 一份 TCP 主线图
- 一份“三次握手为什么不是两次”的回答稿

### 自测问题

1. TCP 为什么要三次握手？
2. 为什么挥手通常是四次？
3. TIME_WAIT 为什么存在？
4. TCP 如何保证可靠传输？
5. 流量控制和拥塞控制区别？

### 复盘标准

- 能否不背图，自己讲出 TCP 全流程

---

## Day 25：HTTP、HTTPS、浏览器到服务端

### 主读资料

- [小林：HTTP 面试题](https://xiaolincoding.com/network/2_http/http_interview.html)
- [小林：HTTP/1.1、2、3 与 HTTPS](https://xiaolincoding.com/network/2_http/http_optimize.html)

### 补强资料

- [JavaGuide：计算机网络常见面试题](https://javaguide.cn/cs-basics/network/other-network-questions.html)

### 当天重点

- HTTP 方法
- 常见状态码
- HTTP/1.0、1.1、2、3 演进
- HTTPS 加密流程
- TLS 握手
- Cookie / Session / Token
- 从输入 URL 到页面展示

### 今天必须输出

- 一份 HTTP 演进时间线
- 一份 HTTPS 握手回答模板

### 自测问题

1. HTTP 和 HTTPS 区别？
2. HTTPS 为什么要混合加密？
3. HTTP/2 相比 HTTP/1.1 的改进？
4. Cookie、Session、Token 分别适合什么场景？
5. 从输入 URL 到页面展示经历了什么？

### 复盘标准

- 能否把 HTTPS 讲到证书校验，而不是只说“更安全”

---

## Day 26：操作系统之进程、线程、内存

### 主读资料

- [JavaGuide：操作系统常见面试题 01](https://javaguide.cn/cs-basics/operating-system/operating-system-basic-questions-01.html)

### 补强资料

- [小林：进程和线程](https://xiaolincoding.com/os/4_process/process_base.html)
- [小林：虚拟内存](https://xiaolincoding.com/os/3_memory/vmem.html)
- [小林：操作系统面试题](https://xiaolincoding.com/interview/os.html)

### 当天重点

- 进程与线程
- 用户态与内核态
- 进程通信
- 虚拟内存
- 分页
- 页表
- 缺页中断
- 页面置换

### 今天必须输出

- 一张进程/线程/协程对比表
- 一份虚拟内存口述稿

### 自测问题

1. 进程和线程区别？
2. 为什么要有虚拟内存？
3. 用户态和内核态区别？
4. 常见进程间通信方式有哪些？
5. 缺页中断大致流程是什么？

### 复盘标准

- 能否把 OS 讲得不抽象，联系实际运行过程

---

## Day 27：I/O 模型、epoll、零拷贝、Linux 常见排查

### 主读资料

- [JavaGuide：操作系统常见面试题 02](https://javaguide.cn/cs-basics/operating-system/operating-system-basic-questions-02.html)

### 补强资料

- [小林：select、poll、epoll](https://xiaolincoding.com/os/8_network_system/selete_poll_epoll.html)
- [小林：死锁](https://xiaolincoding.com/os/4_process/deadlock.html)

### 当天重点

- 阻塞 / 非阻塞
- 同步 / 异步
- I/O 多路复用
- select / poll / epoll
- 水平触发 / 边缘触发
- 零拷贝
- 常见 Linux 排查命令
- 死锁四要素

### 今天必须输出

- 一张五种 I/O 模型对比表
- 一份常见 Linux 面试命令清单

### 自测问题

1. epoll 为什么比 select/poll 高效？
2. LT 和 ET 有什么区别？
3. 零拷贝是什么？
4. 怎么查看端口占用？
5. 死锁四个必要条件是什么？

### 复盘标准

- 能否把 epoll 和 Redis/Netty/Nginx 联系起来讲

---

## Day 28：分布式、MQ、系统设计基础

### 主读资料

- [JavaGuide：分布式系统理论基础](https://javaguide.cn/distributed-system/distributed-system-interview-questions.html)
- [JavaGuide：CAP 和 BASE 理论](https://javaguide.cn/distributed-system/protocol/cap-and-base-theory.html)
- [JavaGuide：分布式事务](https://javaguide.cn/distributed-system/distributed-transaction.html)
- [JavaGuide：分布式 ID](https://javaguide.cn/distributed-system/distributed-id.html)

### 补强资料

- [小林：消息队列面试题](https://xiaolincoding.com/interview/mq.html)
- [小林：系统设计面试题](https://xiaolincoding.com/interview/systemdesign.html)

### 当天重点

- CAP / BASE
- 分布式事务
- TCC / 本地消息表 / MQ 事务
- 分布式 ID
- 消息可靠性
- 重复消费
- 顺序消费
- 消息积压
- 秒杀、短链、点赞等基础场景

### 今天必须输出

- 一份分布式事务方案对比表
- 一份 MQ 高频问题回答模板

### 自测问题

1. CAP 为什么不能同时满足？
2. 常见分布式事务方案有哪些？
3. 雪花算法原理是什么？
4. MQ 怎么保证消息不丢？
5. 消息重复消费怎么做幂等？
6. 消息积压怎么处理？

### 复盘标准

- 能否答到“中型公司够用”的深度

---

## Day 29：项目深挖与全模块串联

### 学习目标

把前面学的知识，真正绑定到你的项目经历上。

### 当天任务

1. 重新梳理简历里最重要的 2 个项目
2. 给每个项目强行挂上以下模块：
   - 并发
   - JVM
   - MySQL
   - Redis
   - Spring
   - 网络
   - 稳定性
   - 性能优化
3. 准备“项目追问链”

### 项目追问链模板

1. 你们系统 QPS 大概多少？
2. 峰值流量怎么扛？
3. 数据库索引怎么设计？
4. 有没有慢查询？怎么优化？
5. Redis 怎么用？缓存一致性怎么保证？
6. 线程池怎么配？
7. 有没有遇到 Full GC 或 CPU 飙高？
8. 线上故障怎么排查？
9. 为什么不用别的方案？
10. 如果重构一次你会怎么改？

### 今天必须输出

- 一份最终版 `项目回答稿.md`
- 一份“项目能挂住哪些八股点”的映射表

### 复盘标准

- 任何一个项目，能否连续讲 10 分钟不虚

---

## Day 30：全真模拟与冲刺复盘

### 模拟安排

做 1 场完整的技术面模拟，建议顺序如下：

1. 自我介绍：3 分钟
2. 项目深挖：10-15 分钟
3. Java 基础 / 集合：10 分钟
4. 并发：10 分钟
5. JVM：10 分钟
6. MySQL：10 分钟
7. Redis：10 分钟
8. Spring：5-10 分钟
9. 网络 / 操作系统：10 分钟
10. 分布式 / MQ / 系统设计：10 分钟

### 最终任务

1. 整理所有错题
2. 整理所有“只能讲 30 秒，讲不到 2 分钟”的题
3. 形成最终冲刺清单
4. 准备 HR 面和反问问题

### HR 常见问题也要准备

1. 为什么离开上家公司？
2. 为什么考虑这份工作？
3. 你的职业规划是什么？
4. 你的优缺点是什么？
5. 你有什么想问面试官的？

### 今天必须输出

- 一份 `终极冲刺清单`
- 一份 `HR 问题回答稿`

### 复盘标准

- 你能不能在 60-90 分钟模拟里明显感觉比 Day1 稳很多

---

## 6. 每周复盘模板

每周末都建议做一次统一复盘，格式如下：

```md
## 本周完成度
- 完成天数：
- 实际投入时长：
- 口述次数：

## 本周最稳的 5 个题
-

## 本周最虚的 5 个题
-

## 本周错题
-

## 下周必须补的模块
-
```

---

## 7. 高频模块追问地图

### 7.1 并发追问地图

- synchronized 原理
- volatile 原理
- CAS 和 ABA
- AQS
- ReentrantLock
- 线程池
- ThreadLocal

### 7.2 JVM 追问地图

- 内存区域
- GC Roots
- 垃圾回收算法
- CMS / G1
- 类加载
- JVM 故障排查

### 7.3 MySQL 追问地图

- B+ 树
- 聚簇索引
- 回表
- 最左前缀
- MVCC
- ReadView
- 锁
- redo / undo / binlog

### 7.4 Redis 追问地图

- 数据结构
- 持久化
- 过期与淘汰
- 缓存三大问题
- 一致性
- 分布式锁
- 高可用

---

## 8. 这份计划怎么根据你的情况调整

### 如果你是 0-1 年经验

- 减少分布式和系统设计时间
- 加强 Java 基础、集合、并发、MySQL、Redis
- 项目表达优先级更高

### 如果你是 1-3 年经验

- 严格按本计划走
- 并发、JVM、数据库必须深挖
- 系统设计题要能答基础版

### 如果你是 3-5 年经验

- 保持前半段不变
- 额外加强：高并发、MQ、分布式事务、项目复盘
- 项目里要能讲性能和稳定性

---

## 9. 最后的使用建议

1. 每天都要开口讲，沉默学习对面试帮助很有限。
2. 每个题都准备 `30 秒版` 和 `2 分钟版`。
3. 同一个知识点尽量形成“定义 -> 原理 -> 优缺点 -> 场景 -> 项目联系”的回答结构。
4. 看到不会的题，不要急着背答案，先问自己：它在解决什么问题，为什么会这样设计。
5. JavaGuide 用来搭主线，小林coding 用来补深度，这个分工不要反过来。

如果你后面要继续细化，我建议下一步直接做两件事：

1. 把这份手册拆成 `每日打卡版`
2. 基于你的简历，再做一份 `项目深挖问答手册`
