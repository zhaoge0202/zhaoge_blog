---
title: "RabbitMQ 怎么保证消息不丢、不重复？"
description: "按生产者、Broker、消费者三段拆解 RabbitMQ 的可靠性组合，讲清确认、持久化与重投的边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "高性能"
tag:
  - "高频"
  - "进阶"
  - "体系化"
prev:
  text: "RabbitMQ 的 Exchange 路由和 AMQP 模型是怎么回事？"
  link: "/high-performance/high-performance-rabbitmq-routing-model.html"
next:
  text: "RabbitMQ 延迟消息和死信队列怎么落地？"
  link: "/high-performance/high-performance-rabbitmq-delay-and-dlq.html"
---

# RabbitMQ 怎么保证消息不丢、不重复？

> RabbitMQ 的可靠性不是“开持久化”一个开关，而是生产者确认、队列类型、消费确认三者叠加出来的组合契约。

通用篇已经讲过消息可靠性的三段链路，这篇只回答一个问题：

**具体到 RabbitMQ，每一段的开关叫什么、什么时候算真的成功、哪里还有洞。**

先把三段和 RabbitMQ 的对应关系摆出来，后面逐段展开：

| 阶段            | 关键机制                                         | 成功语义                                      |
| --------------- | ------------------------------------------------ | --------------------------------------------- |
| 生产者 → Broker | Publisher Confirm、mandatory + return、AE        | Broker 承接并落到当前队列类型要求的持久化程度 |
| Broker 存储     | durable 队列、persistent 消息、quorum queue 复制 | 重启或节点故障后消息仍在                      |
| Broker → 消费者 | manual ack、prefetch、delivery-limit、DLX        | 业务处理完成后才从队列移除                    |

## 第一段：生产者怎么知道消息真的进去了

### 为什么要用 Confirm，而不是“发送成功”

`basicPublish` 是异步 API，方法返回时消息通常只在客户端的发送缓冲区里。TCP 也不保证对端已处理。所以“发送没抛异常”只说明写 socket 没失败，什么都证明不了。

RabbitMQ 提供了一个 AMQP 扩展叫 **Publisher Confirm**：`confirmSelect()` 之后，每条消息会被分配一个从 1 开始自增的序号（sequence number），Broker 处理后通过 `basic.ack`（确认）或 `basic.nack`（失败）回调告知，回调里带 `multiple` 标志表示“到此序号为止全部确认”。

```java
channel.confirmSelect();
channel.addConfirmListener(
    (seqNo, multiple) -> { /* 已确认：multiple 为 true 表示到 seqNo 为止都确认了 */ },
    (seqNo, multiple) -> { /* 未确认：落盘日志、走补偿或重发 */ }
);
```

### “确认”到底确认了什么

这是最容易被含糊带过的一句。不同队列类型、不同消息属性下，ack 的含义不同：

| 场景                                  | Broker 返回 confirm 的时机                         |
| ------------------------------------- | -------------------------------------------------- |
| 消息投递到持久化队列、persistent 消息 | Broker 已经把消息写入磁盘（经典队列）              |
| 消息投递到 quorum queue               | 消息已被复制到多数派成员（`(N/2)+1`），Raft 提交后 |
| 消息投递到瞬时队列、transient 消息    | 消息进入队列内存即可，重启会丢                     |

所以“confirm 收到就等于不丢”这句话只在第三种情况之外成立。判断标准应该写成：**confirm 确认的是“Broker 按当前配置承接了消息”，而不是“业务一定不会丢”。**

顺带一个高频追问：**事务机制（`txSelect`/`txCommit`）行不行？** 行，但它是同步阻塞的，一条消息要等一次完整的协议往返，吞吐会明显下降；而且它和 Confirm 模式互斥，不能同时开。生产上基本只用 Confirm。

### Confirm 之后还有第二个洞：路由失败

Confirm 只覆盖“消息是否被 Broker 承接”。如果消息到了 Exchange 却没有匹配到任何队列，Broker 依然会返回 confirm——因为对它来说这个操作完成了，只是没人要。

这就是“消息黑洞”：配置漂移（队列被误删、绑定被改）时，生产者看到全绿，消息静悄悄消失。

补法是上一篇讲的两个机制，二选一：

- `mandatory=true` + `addReturnListener`，捕获这条消息的退回；
- 给 Exchange 配 `alternate-exchange`，整类路由失败转发到兜底队列。

工程上的判断标准很简单：**如果你的 confirm 回调和 return 回调没有同时接上监控，可靠性就是没做完。**

## 第二段：Broker 端，队列类型决定了可靠性上限

### 三个属性必须同时对上

很多人只记住“持久化”三个字，实际上 RabbitMQ 里要三个属性一起配置才成立：

| 对象     | 属性                            | 缺了会怎样                   |
| -------- | ------------------------------- | ---------------------------- |
| Exchange | durable（声明时）               | Broker 重启后 Exchange 消失  |
| Queue    | durable（声明时）               | 重启后队列和其中消息一起消失 |
| Message  | delivery_mode = 2（persistent） | 队列还在，消息被丢弃         |

一个非常常见的误解：**队列 durable 不等于消息持久化**。持久化队列里照样可以放 transient 消息，重启时这些消息会被丢掉——官方文档的原话是“transient 消息在恢复时被丢弃，即使它存放在持久化队列里”。

### 经典队列的复制方案已经退场

早期的高可用做法是**镜像队列**（Classic Queue Mirroring）：主节点收消息同步给镜像节点，主挂掉由最老的镜像顶上。它的问题是本质为主从复制、不是共识协议，网络分区时容易分裂、切换时容易丢尾部消息。

版本演进必须说清楚，否则答案直接过时：

| 版本   | 状态                                                    |
| ------ | ------------------------------------------------------- |
| 3.8 前 | 镜像队列是主流高可用方案                                |
| 3.8+   | 引入 quorum queue，镜像队列标记 deprecated              |
| 4.0+   | 镜像队列被**移除**，需要复制就用 quorum queue 或 stream |

### Quorum Queue 的适用边界

quorum queue 基于 Raft，靠多数派确认保证一致性，是现在“需要复制的高可靠队列”的默认选择。但它不是万能替换，能力矩阵有必要记住几条：

| 特性               | classic queue    | quorum queue                          |
| ------------------ | ---------------- | ------------------------------------- |
| 非持久化队列       | 支持             | 不支持（必须 durable）                |
| 排他队列           | 支持             | 不支持                                |
| server-named       | 支持             | 不支持                                |
| 消息持久化         | 按消息属性       | **始终落盘**，transient 也落盘        |
| 消息优先级         | `x-max-priority` | 4.3 起支持严格优先级（0-31）          |
| 单个消费者全局 QoS | 支持             | 不支持（只能按 consumer 设 prefetch） |
| 投递次数上限       | 无               | 有 `delivery-limit`，4.x 默认 20      |
| 单队列堆积能力     | 中               | 弱于 stream（百万级以上建议 stream）  |

第 4 条经常被忽略：**quorum queue 会把所有消息都写盘，包括你标成 transient 的消息**。这意味着它在低延迟、纯内存吞吐的场景里天然吃亏。另外一个实践边界是队列数量——官方建议如果单个集群需要几千个 quorum queue，就该重新审视拓扑了。

一句话总结取舍：**要复制和高可靠选 quorum queue；要高吞吐、可回放、海量堆积选 stream；单机、低频、追求最低延迟用 classic。**

## 第三段：消费端，ack 才是“处理完成”的信号

### auto-ack 是可靠性杀手

订阅时把 `autoAck` 设为 `true`，Broker 会在消息写入 socket 后立即认为投递成功。消费者进程崩溃、业务抛异常、处理到一半断电，这条消息都不会回来——它已经从队列里消失了。

官方对这个模式的评价是“应被视为不安全（unsafe）”，只适合“能稳定高速处理、丢了也无所谓”的场景（典型如监控指标上报）。业务消息一律 `autoAck=false` + 手动 ack。

### ack / nack / reject 的语义差别

| 方法          | 方向     | 批量   | 语义                             |
| ------------- | -------- | ------ | -------------------------------- |
| `basicAck`    | 肯定确认 | 支持   | 处理成功，可以删除               |
| `basicNack`   | 否定确认 | 支持   | 处理失败，可 requeue 或丢弃/死信 |
| `basicReject` | 否定确认 | 不支持 | 单个拒绝，功能上被 nack 覆盖     |

`delivery_tag` 是 Channel 内自增的编号，**必须在收到消息的同一个 Channel 上 ack**，否则会抛 “unknown delivery tag” 并关闭 Channel。这是“每个消费者一个 Channel”的另一个理由。

### requeue 的真实语义：不是回到队尾

这里必须点出一个流传很广的错误说法。不少资料写“nack 且 requeue=true 时消息重回队列尾部”，**这在 RabbitMQ 上是错的**。

官方文档的表述是：消息被 requeue 时，会**尽量放回它在队列中的原始位置**；如果做不到（多个消费者并发投递和确认导致位置已经变化），就放到**靠近队头**的位置。quorum queue 的文档写得更直白：设置 `delivery-limit` 的作用之一就是保证被 requeue 的消息回到队头。

这个差别有实际后果：

- **队头阻塞**：放回队头意味着后面所有消息都要等这条重试完，吞吐会被一条坏消息拖住。
- **死循环**：如果所有消费者都因为同一个瞬时故障 requeue，就会形成 requeue/redelivery 循环，狂烧 CPU 和带宽，消息还堵在最前面。

所以正确做法不是“失败就 requeue”，而是：

1. 可判定的临时故障 → nack + requeue，但要计数（`redelivered` 标志或业务侧计数），超限就转死信。
2. 不可恢复的业务错误 → nack + `requeue=false`，直接进 DLX 人工处理。
3. quorum queue → 依赖 `delivery-limit`（4.x 默认 20）兜住投递计数，超限丢进 DLX。

### prefetch：消费端的限流阀

`basicQos(prefetchCount)` 控制“一个消费者手上最多有多少条未确认消息”。这个值决定了并发度和内存风险：

| prefetch | 效果                                                          |
| -------- | ------------------------------------------------------------- |
| 0        | 不限制，Broker 会尽可能多地推送（默认行为）                   |
| 1        | 严格轮询，最公平但吞吐最低                                    |
| 10-50    | 大多数业务的安全区间                                          |
| 数百以上 | 本地缓冲风险上升，处理慢时会看到 unacked 堆积、消费者内存暴涨 |

有个容易忽略的机制：prefetch 设得太大，Broker 侧看起来队列是空的、消费速率也正常，但消息全都卡在“已投递未确认”状态，**别的消费者接不了盘**，扩容实例也分不到消息。排查积压时“队列深度正常但业务没进展”，十有八九栽在这里。

quorum queue 还有个额外上限：即使你写 prefetch=0，它也会把消费者 prefetch 限制在 2000 左右，防止 Raft 日志无上限增长。

## 重复消费从哪来：来源清单

“不丢”和“不重复”是两件事，而且天然冲突：**要保证不丢，就必须允许重发；一允许重发，就一定会有重复**。RabbitMQ 的语义是至少一次（at-least-once），重复来源至少有五种：

1. **confirm 超时后重发**：生产者没等到 ack 就重试，Broker 实际已经收到了第一条。
2. **消费端 ack 前崩溃**：消息被重新投递，业务可能已经处理了一半。
3. **requeue 重投**：nack/reject 且 requeue=true，或 Channel/连接异常关闭导致未确认消息归还队列。
4. **DLX 重投**：死信转发到新队列被再次消费。
5. **at-least-once 死信**：quorum queue 开启 `dead-letter-strategy: at-least-once` 后，源队列在目标队列确认前保留消息，失败重试会产生重复副本。

结论只有一句：**幂等必须做在业务侧，靠业务唯一键，而不是靠 MQ 的消息 ID。** 消息 ID 在重发、补偿、重新发布会变，只有订单号、支付流水号这种业务键才稳定。具体方案（唯一索引、状态机条件更新、消费记录表、Redis 去重）和通用幂等篇是同一套，这里不重复展开。

## 一份能落地的配置清单

把上面的结论拼成可直接对照的清单（Spring Boot 风格，原生 Java 客户端同理）：

```yaml
spring:
  rabbitmq:
    publisher-confirm-type: correlated # 开启生产者确认
    publisher-returns: true # 开启 return 回调，配合 mandatory
    template:
      mandatory: true
    listener:
      simple:
        acknowledge-mode: manual # 手动 ack
        prefetch: 20 # 按处理耗时调，别设 0
        default-requeue-rejected: false # 关键：默认是 true，会无限 requeue
        retry:
          enabled: true
          max-attempts: 3
          initial-interval: 1000ms
          multiplier: 2.0
```

两个容易踩的默认值：

- `default-requeue-rejected` 在 Spring Boot 里默认是 `true`，也就是监听器抛异常时消息会被反复 requeue，本地看起来是“一直在重试”，实际是死循环空转。生产上要么改成 `false` 走 DLX，要么关掉容器重试、自己在业务里控制重试次数。
- `publisher-returns` 不开，`mandatory` 设了也拿不到退回通知。

再补一条不在配置里但同样重要的：**队列类型要在声明时定死**。`x-queue-type` 必须由客户端在 `queueDeclare` 时提供，Policy 改不了；一旦队列建错类型，只能删了重建。

## 小结

- 生产者端要同时拿到 confirm 和 return：confirm 证明 Broker 承接了消息，return/AE 证明消息真的进了队列，缺一个就有消息黑洞。
- confirm 的成功语义随队列类型变化：quorum queue 是多数派复制后确认，classic 持久化队列是落盘后确认，瞬时队列只是进内存。
- 持久化要三件套齐全：durable Exchange + durable Queue + persistent 消息；队列 durable 不代表消息持久化。
- 镜像队列在 4.0 被移除，需要复制的队列用 quorum queue，但它是“始终落盘、必须 durable、不支持排他队列”的一套新约束。
- 消费端必须手动 ack；requeue 会把消息放回原位或靠近队头（不是队尾），会导致队头阻塞和重投循环，要靠 delivery-limit 或业务计数兜住。
- prefetch=0 是无限制，设太大只会把消息堆在 unacked；重复消费来源有五种，幂等只能做在业务侧。

## 参考

综合自仓库内高性能消息队列与接口幂等参考材料，并结合 RabbitMQ 官方文档（Publisher Confirms、Consumer Acknowledgements、Queues、Quorum Queues、Dead Letter Exchanges、Reliability 章节）关于确认语义、持久化、队列类型矩阵、requeue 位置、prefetch 上限与 delivery-limit 的说明整理；其中“requeue 回到队尾”的说法按官方文档核对后做了纠正，“prefetch=0 即无限制”“quorum queue 4.x 投递上限默认 20”“镜像队列 4.0 移除”等均按 4.x 版本事实确认。
