---
title: "线程飙高、CPU 打满、死锁怎么标准排查？"
description: "给出 CPU 高、线程堆积和死锁的标准排查顺序与证据链。"
breadcrumb: true
article: true
editLink: false
category:
  - "高可用"
tag:
  - "高频"
  - "排障"
  - "进阶"
prev:
  text: "Arthas 怎么做线上诊断？"
  link: "/high-availability/high-availability-arthas-diagnostics.html"
next:
  text: "工具实践"
  link: "/tools/"
---

# 线程飙高、CPU 打满、死锁怎么标准排查？

> 这三类问题表面都是“机器不行了”，证据链却完全不同。先分类，再取样，最后对照栈。

## 先分类，不要一上来 jstack

| 现象                    | 更像什么问题               | 第一刀看什么             |
| ----------------------- | -------------------------- | ------------------------ |
| CPU 接近 100%，负载很高 | 热点计算 / GC / 死循环     | `top`、GC、火焰图        |
| CPU 不高，但 RT 很高    | 锁等待、IO 阻塞、池耗尽    | 线程状态、连接池、下游   |
| 线程数持续上涨          | 阻塞堆积、创建无线程、泄漏 | 线程命名、栈顶、拒绝策略 |
| 日志出现 deadlock       | 循环等待锁                 | jstack 死锁段落          |

CPU 打满和“线程很多”经常被混谈。线程多不等于 CPU 高：大量线程可以都在 `WAITING` 等锁或等 IO。

## CPU 打满：先分用户态还是 GC

### 1. 确认是谁吃 CPU

```bash
top -H -p <pid>
```

看：

- 是业务线程高，还是 `GC` 相关线程高
- 是单核打满还是多核一起高

也可以：

```bash
pidstat -t -p <pid> 1
```

### 2. 线程 ID 转十六进制，对齐 jstack

`top -Hp` 里的轻量线程 ID 是十进制，jstack 里是十六进制 `nid`。

```bash
printf "%x\n" 12345
# 例如输出 3039，去 jstack 里搜 nid=0x3039
```

连续抓 2～3 次栈，间隔 3～5 秒：

```bash
jstack <pid> > /tmp/jstack.1
sleep 3
jstack <pid> > /tmp/jstack.2
```

如果同一个业务方法栈反复出现在高 CPU 线程上，基本就锁定热点了。

### 3. 常见 CPU 热点

| 类型          | 典型栈味道                    | 处理方向                |
| ------------- | ----------------------------- | ----------------------- |
| 业务热点循环  | 应用包名方法长时间占据栈顶    | 算法、批处理、缓存结果  |
| 正则 / 序列化 | `Pattern`、JSON、XML 相关帧多 | 预编译、换库、减字段    |
| 频繁年轻 GC   | GC 线程高，分配速率高         | 降分配、看 JFR alloc    |
| Full GC 抖动  | 老年代涨、停顿日志异常        | 见 Full GC 排查专题     |
| 压缩 / 加解密 | codec、crypto 帧占比高        | 降级压缩、硬件/算法调整 |

GC 与 OOM 细节见：

- [频繁 Full GC 怎么排查](/java/jvm/jvm-full-gc-troubleshooting.html)
- [线上 OOM 怎么定位](/java/jvm/jvm-oom-troubleshooting.html)

只靠 jstack 不够看清分配器热点时，上 JFR / async-profiler / Arthas profiler。

## 线程飙高：看状态分布，不看总数焦虑

线程多本身不一定是事故。先问：

1. 增长是突发还是缓慢泄漏
2. 新线程叫什么名字
3. 它们的状态是 `RUNNABLE`、`BLOCKED` 还是 `WAITING`

| 状态          | 含义概要             | 常见原因                 |
| ------------- | -------------------- | ------------------------ |
| RUNNABLE      | 在跑或等 CPU/部分 IO | 热点代码、网络读写       |
| BLOCKED       | 等 Java monitor 锁   | synchronized 竞争        |
| WAITING       | 无限期等待           | `park`、锁条件队列、join |
| TIMED_WAITING | 限时等待             | sleep、带超时的 get/poll |

### 典型模式

**1. 下游变慢导致线程堆积**

Tomcat / RPC 工作线程都堵在下游调用栈上，线程数顶到池上限，新请求开始排队或拒绝。

处理：降超时、熔断、舱壁隔离、扩下游或限流入口，而不是只把线程池调大。

**2. 无界任务提交**

`Executors.newCachedThreadPool()` 或无界队列 + 任务暴涨，线程或任务堆积。

处理：有界队列、拒绝策略、调用方背压。

**3. 线程泄漏**

自定义线程 / 定时器不关，或线程池每次请求新建。

处理：看线程名是否带请求特征、是否只增不减，定位创建点。

## 死锁：把“互相等待”读成人话

`jstack` 发现死锁时会直接给出类似：

```text
Found one Java-level deadlock:
"thread-A":
  waiting to lock monitor 0x... (object 0x..., a Object),
  which is held by "thread-B"
"thread-B":
  waiting to lock monitor 0x... (object 0x..., a Object),
  which is held by "thread-A"
```

你要能说明白：

1. 谁持有哪把锁
2. 谁在等哪把锁
3. 业务上这两段临界区为什么会交叉

工程上预防比死后分析重要：

- 全局统一加锁顺序
- 尽量缩小锁范围
- 能用并发容器/原子类就不要嵌套多把锁
- 跨远程调用绝不持着本地锁

数据库死锁是另一条线，看 InnoDB 死锁日志，不要和 JVM monitor 死锁混为一谈。

## 标准作业：8 步

```text
1. 确认现象：CPU / RT / 错误率 / 线程数，哪个先坏
2. 确认范围：单实例还是集群，是否刚发布或流量峰
3. 抓系统画像：top、负载、GC 日志、连接池指标
4. 采样线程：jstack 2～3 次，或 Arthas thread
5. 对齐热点：十进制 tid ↔ nid，或直接 profiler
6. 归类：计算热点 / 锁竞争 / IO 阻塞 / 池耗尽 / 死锁
7. 做最小动作：限流、扩容、回滚、杀热点任务、调超时
8. 固化：线程池命名与边界、告警、回归压测
```

生产上优先保命，再追求根因完美。先止血（限流、摘流、回滚），再留证。

## 和 Arthas / JFR 怎么配合

| 手段         | 擅长                         | 不擅长             |
| ------------ | ---------------------------- | ------------------ |
| jstack       | 锁、死锁、线程状态快照       | 精确 CPU 占比      |
| top/pidstat  | 哪个线程吃 CPU               | 业务语义           |
| Arthas       | 不重启看方法耗时、条件 watch | 替代完整指标系统   |
| JFR/profiler | CPU/alloc/锁火焰图           | 临时权限与导入成本 |

经验顺序：

1. 指标判断类别
2. jstack / thread 看阻塞与死锁
3. 仍像计算热点再上 profiler

详见 [Arthas 诊断](./high-availability-arthas-diagnostics.html) 与 [可观测三支柱](./high-availability-observability-pillars.html)。

## 面试里怎么答

可以这样收口：

> CPU 高先区分业务热点还是 GC，用 top 找线程再对齐 jstack 或上火焰图；线程多先看状态分布和线程池边界，很多是下游慢导致的堆积；死锁直接看 jstack 的互相持锁信息，并回到加锁顺序。排查一定先分类再取样，不先改参数碰运气。

## 小结

1. CPU 打满、线程飙高、死锁是三类问题，证据不同。
2. CPU 问题核心是“谁在跑”：tid 对齐栈或火焰图。
3. 线程问题核心是“它们在等什么”：状态分布比总数重要。
4. 死锁要读懂持锁与等待环，并用统一加锁顺序预防。
5. 先止血再根因，工具服务于证据链，而不是反过来。

## 参考

综合自仓库内 JVM 监控工具、Full GC/OOM 排查与高可用稳定性相关笔记，并结合 `jstack`、线程采样和 CPU 热点定位的常见生产实践整理；强调分类与标准作业，而不是命令背诵。
