---
title: "大模型流式输出怎么落到后端？SSE 为什么会卡住不出字？"
description: "从 SSE 协议、两种 Spring 实现到六层缓冲的排障顺序，讲清流式输出的落地与坑。"
breadcrumb: true
article: true
editLink: false
category:
  - "AI 应用开发"
tag:
  - "排障"
  - "项目实战"
  - "原理深入"
prev:
  {
    text: "Spring AI 的请求怎样经过 Advisor、记忆和工具调用？",
    link: "/ai/ai-spring-ai-call-chain.html",
  }
next:
  { text: "两个模型都说兼容，网关切流量为什么会失败？", link: "/ai/ai-llm-provider-contracts.html" }
---

# 大模型流式输出怎么落到后端？SSE 为什么会卡住不出字？

> 流式把已经产生的有效输出尽早交给用户，实际体验还取决于模型、排队、传输和前端缓冲，需要分段测量。

上一篇 [Java 后端怎么接大模型](/ai/ai-java-integration-stack.html) 把选型讲完，最后落在一个窄接口 `LlmGateway.stream(...)` 上：业务侧只拿一条增量流，不关心底下是 Spring AI、LangChain4j 还是手写 OkHttp。这篇从这条流往回看——增量怎么变成浏览器上一行行蹦出来的字，以及「连上了、但一个字都没有」到底卡在哪一层。

## 先算一笔账：首个可见输出与总耗时要分别观察

假设同一生成过程共输出 800 Token，首个有效 Token 在第 1 秒形成，此后 799 个间隔均为 50ms，忽略额外传输和展示开销。
模型生成结束约在 `1 + 799 × 0.05 = 40.95` 秒。以下是教学假设，不是压测结果。

| 指标         | 同步返回                  | 流式返回                          |
| ------------ | ------------------------- | --------------------------------- |
| 首字延迟     | ≈ 41 秒（等完整回答返回） | ≈ 1 秒（首个有效 Token 可展示）   |
| 端到端总耗时 | ≈ 41 秒                   | 本例中同样 ≈ 41 秒                |
| 用户感知     | 转圈，不知道死没死        | 立刻出字，能判断方向对不对        |
| 后端复杂度   | 拿完整字符串再处理        | 增量事件、取消、断流、半成品 JSON |

本文把用户端 TTFT 定义为请求发出到首个可展示文本到达的时间。响应头、心跳、角色标识和空分片不计入这个终点。
同样的生成路径下，流式本身不减少输出所需的计算量；缓冲、背压、额外处理或提前取消也会改变总时长与实际用量，费用需要按真实计量解释。

两个指标必须分开盯：TTFT 和总时长 / token 速率。TTFT 涨，通常是排队、上下文太长、供应商抖动；总时长涨，可能只是这次回答本来就长。混成一个「接口耗时」告警，你永远不知道该怪谁。这和 [慢请求证据链怎么查](/high-availability/high-availability-slow-request-tracing.html) 同一套思路——先把总耗时切段再决定看哪类证据，只是刀口落在「第一个 token 之前 / 之后」。

## SSE 到底是什么：一份用空行分隔的 UTF-8 文本

SSE 在 HTTP 响应中持续传递文本事件。下面展示 HTTP/1.1 下的一种响应，`Content-Type` 指明事件流，后续数据可以逐步发送。

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream;charset=UTF-8
Cache-Control: no-cache
Transfer-Encoding: chunked
X-Accel-Buffering: no
```

本例使用 HTTP/1.1 chunked 传输，HTTP/2 则不用这个传输头。TCP 读取块、HTTP 数据帧和 SSE 事件没有固定的一一对应关系。
SSE 按行解释 UTF-8 文本，以空行触发事件派发。单个行尾只结束当前字段行，不能直接当作完整事件。

```text
id: 17
event: token
data: 你好，我是

: ping

id: 18
event: done
data: [DONE]
```

最后一个事件也要输出终止空行。这里的 `token`、`done` 和 `[DONE]` 是应用约定，不是 SSE 规范内置的结束语义。

| 字段     | 作用                                | 实践要点                                           |
| -------- | ----------------------------------- | -------------------------------------------------- |
| `data`   | 多个 `data:` 字段用换行拼成事件数据 | 正文含换行时正确编码每行，或约定 JSON 载荷         |
| `event`  | 事件名，浏览器默认 `message`        | 用 `token` / `done` / `error` 区分语义，别让前端猜 |
| `id`     | 事件标识                            | 服务端保留可重放事件时，可据此处理续传             |
| `retry`  | 建议重连间隔（毫秒）                | 服务端给一次即可；LLM 场景要小心自动重连           |
| `: 注释` | 冒号开头的行是注释                  | **当心跳用**，前端收不到事件，但能把连接喂活       |

### EventSource 的四个限制，反过来决定了接口长什么样

1. **不能自定义请求头**。原生 `EventSource` 可结合合适的 Cookie 策略，或由已认证接口签发短时、限定用途的流票据。长期 Bearer Token 不应放进 URL，URL 仍可能进入访问日志等记录；需要 `Authorization` 时可用 fetch 流。
2. **只能 GET、只能文本**。二进制要自己编码。
3. **自动重连由客户端协议规则决定**。已设置的事件 ID 可作为 `Last-Event-ID` 发送，服务端仍要实现事件保留、权限和去重。
4. **HTTP/1.1 的连接上限会限制同源长连接数量**。常见浏览器约为 6 条，实际限制依浏览器而定，HTTP/2 还需看协商的并发流限制。

要自定义 header 就换 `fetch` + `ReadableStream` 自己解析事件（社区有 `fetch-event-source` 一类封装），代价是重连和 `Last-Event-ID` 都得自己实现——不是哪个更高级，只是谁承担复杂度。

## SSE 还是 WebSocket？

| 维度         | SSE                                       | WebSocket                            |
| ------------ | ----------------------------------------- | ------------------------------------ |
| 方向         | 服务端 → 客户端单向                       | 全双工                               |
| 载体         | 普通 HTTP 响应                            | HTTP Upgrade（101）后走独立协议帧    |
| 重连 / 鉴权  | 原生重连；Cookie、短时票据或 fetch 请求头 | 重连自己写；按握手与客户端能力认证   |
| 过代理 / CDN | 就是 HTTP，配好缓冲即可                   | 要求代理支持 Upgrade，老网关常挂     |
| HTTP/2       | 天然受益（一条连接多个流）                | 需要 RFC 8441 扩展，支持度看代理     |
| 实现成本     | Controller 返回一个流就行                 | 端点管理、会话表、心跳、重连全自己写 |

结论：**只要「服务端持续往下推、客户端偶尔发个新请求」能表达清楚，就用 SSE**——对话、报告生成、日志跟读都是这一类。真需要双向高频交互（语音对话要边说边打断、多人协同）才上 WebSocket。

## Spring 侧两种写法

以下代码展示发送路径，省略了完整认证、订阅句柄管理和资源清理实现，不是可直接上线的完整 Controller。

### Servlet 栈：`SseEmitter`

```java
@RestController
@RequestMapping("/api/chat")
public class ChatStreamController {                    // 字段：llmGateway、emitters 注册表、seq 序号
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam String cid, @RequestParam String q) {
        SseEmitter emitter = new SseEmitter(5 * 60_000L);      // 超时显式给，别吃默认值
        emitters.put(cid, emitter);
        emitter.onCompletion(() -> emitters.remove(cid));
        emitter.onError(e -> emitters.remove(cid));
        emitter.onTimeout(() -> { emitters.remove(cid); emitter.complete(); });
        llmGateway.stream(q).subscribe(chunk -> {
            try {
                emitter.send(SseEmitter.event()
                    .id(String.valueOf(seq.incrementAndGet()))
                    .name("token")
                    .data(chunk, MediaType.TEXT_PLAIN));       // 纯文本，别让 JSON 加引号
            } catch (IOException e) {
                emitter.completeWithError(e);                  // 写失败需记录，并释放上游订阅
            }
        }, emitter::completeWithError, emitter::complete);     // 正常结束必须 complete
        return emitter;   // 立即返回，容器请求线程被释放
    }
}
```

- **用完一定要 `complete()`**，否则 emitter 一直挂在注册表里，async 上下文和连接都释放不掉；三个回调里都要清注册表，不然一次压测下来「并发数只涨不跌」。
- **核对实际超时层次**：显式设置异步与代理超时，再用受控事件流验证。未配置时依赖框架与容器默认值，固定时刻断开只是排查线索，不能据此直接认定是某个 Tomcat 参数。

```yaml
spring:
  mvc:
    async:
      request-timeout: 300000 # 毫秒，按单流最长时长给；0 的语义依赖容器，别乱写
```

### WebFlux 栈：直接返回 `Flux<ServerSentEvent<String>>`

```java
@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<String>> stream(@RequestParam String q) {
    Flux<ServerSentEvent<String>> events = llmGateway.stream(q)
        .subscribeOn(Schedulers.boundedElastic())     // 底层是阻塞 SDK 就别占 event loop
        .map(t -> ServerSentEvent.builder(t).event("token").build())
        .concatWithValues(ServerSentEvent.builder("[DONE]").event("done").build())
        .doOnCancel(() -> log.info("client gone, cancel upstream"));   // 关页面走这里
    Sinks.Empty<Void> done = Sinks.empty();           // 心跳必须有终止条件，否则流永不收尾
    Flux<ServerSentEvent<String>> heartbeat = Flux.interval(Duration.ofSeconds(15))
        .map(i -> ServerSentEvent.<String>builder().comment("ping").build())
        .takeUntilOther(done.asMono());
    return Flux.merge(events.doFinally(s -> done.tryEmitEmpty()), heartbeat);
}
```

响应式链可以向上游传播取消与背压，底层 HTTP 客户端或 SDK 仍要实际响应取消，不能仅凭 `doOnCancel` 日志断言模型已停止。
阻塞 SDK、JDBC 和文件读不能占住事件循环，调度与并发需要单独设计。MVC 返回 `Flux` 时仍受 Servlet 生命周期管理，网络流控也不等同于端到端业务背压。
Servlet 示例还需保存并释放上游订阅，在完成、错误、超时与显式取消入口统一清理，不能只删除注册表条目。

## 卡住不出字：按六层往下排

顺序永远**从最外层往里**，因为外层最便宜：先 `curl -N` 直连后端，再逐层把反代、网关、CDN 加上去，谁加上去就复现，谁就是嫌疑人。

### 1. Nginx 反代缓冲：最常见的一层

**现象**：等三五秒，然后「刷」一下整段出来；后端日志显示分片是实时发的，`curl` 直连也正常。
**机制**：`proxy_buffering` 默认开，Nginx 把上游响应攒到缓冲区再转发；`gzip` 同理，压缩器要攒够才吐。
**验证**：同一台机器直连后端正常、加上 Nginx 变批量，直接锁定。

```nginx
location /api/chat/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;          # 核心：不攒包
    proxy_cache off;
    gzip off;                     # 本例排障时禁用压缩，排除额外缓冲
    proxy_read_timeout 300s;      # 必须大于最长静默时间
}
```

两个容易漏的点：`X-Accel-Buffering: no` 是**响应头**，必须由**上游（后端）**在响应里写出来才生效——在 Nginx 自己的 location 里写 `add_header X-Accel-Buffering no;` 对它**没用**，那一行只会把响应头带给下游（比如 CDN）。改不动 Nginx 配置时，靠后端加这个头救急；`proxy_read_timeout` 默认 60 秒，模型想 90 秒才吐第一个字，连接先被代理切了——现场看就像「模型挂了」。

### 2. 网关的超时与缓冲

**现象**：前几秒有字，然后连接被切；或网关报 504、`DataBufferLimitException`。
**机制**：网关的超时策略或聚合响应正文的过滤器可能截断、缓存流式输出。应确认处理的是请求体还是响应体，不能仅凭过滤器名称推断影响，具体实现与版本需要单独验证。细节见[Spring Cloud Gateway 的路由和过滤器](/system-design/spring-cloud/spring-cloud-gateway-filter-limit.html)。

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        response-timeout: 60s # 全局，别小于单流最长时长
      routes:
        - id: chat-stream
          uri: lb://ai-app
          predicates: ["Path=/api/chat/**"]
          metadata: { response-timeout: -1 } # 单位毫秒；负值关掉全局超时
```

**别照抄网上的数字**：不同版本的超时语义不一样（等响应头 / 等每次读 / 等整个响应），先做一个「每 2 秒发一个事件、持续 60 秒」的假接口压一遍，看它到底第几秒被切。

### 3. 框架 / 容器没有及时流式写出

**现象**：上游已产生有效事件，经过应用后却整段到达。检查 Controller 是否一次性序列化完整字符串、响应包装器是否聚合正文、写出是否及时 flush。HTTP/2 没有 chunked 属于正常情况，不能拿这个头单独判断流是否生效。优先使用正确的 SSE 编解码器，并以实际事件时间核查。

### 4. HTTP/2 与 CDN 的聚合

**现象**：经某个代理或网络才批量显示，直连正常。分别比较 HTTP/1.1、HTTP/2 与源站路径的首个有效事件时间，核对缓存、压缩、流控及中间组件的写出行为。传输协议本身不保证每个应用事件立即显示，关闭某项配置是否有效要由相同输入的对照确认。

### 5. 线程被占死

**现象**：并发提高后，新流排队很久。`SseEmitter` 返回后会释放初始请求线程；如果上游采用阻塞迭代，消费任务仍可能长期占用工作线程，非阻塞客户端则不必一流绑定一线程。要按实际 SDK、调度器与写出行为测量，限制并发并保护普通接口；虚拟线程也不能扩大供应商配额或连接池。参数取舍见[线程池](/java/concurrent/java-concurrency-thread-pool.html)。

### 6. 上游模型本身慢

**现象**：直连后端时，首个有效文本也晚到。记录网关发出请求、上游首个有效文本、后端首个文本 flush 与前端首次展示的时刻，再检查排队、输入量、模型与重试。心跳或角色事件的首分片时间不能替代这些点，具体定义见[推理延迟](./ai-llm-inference-latency.html)。

## 断线和续传：别指望连接一直活着

`EventSource` 具备重连机制，使用事件 ID 恢复还要求服务端保存对应事件并重新鉴权。补发时需定义缺口、重复和保留期限，不能仅凭一次重连宣称续传完整。

| 方案            | 做法                                                      | 适用             | 代价                   |
| --------------- | --------------------------------------------------------- | ---------------- | ---------------------- |
| 事件缓存补齐    | 每条流缓存最近 N 个事件（如 200 条 / 5 分钟），按 id 补发 | 短问答、即时对话 | 缓存有上限，超时补不齐 |
| 任务化 + 增量读 | 生成过程落库（或 Redis Stream），流只读已生成部分         | 长报告、批量任务 | 多一张表 + 一个状态机  |

需要跨连接恢复、长时间执行或回查结果时，可以采用任务与增量事件存储。供应商是否支持恢复生成取决于具体 API；本地事件重放只恢复已保存的输出，不等于恢复供应商计算。任务化设计见[模型很慢，长任务怎么设计](/ai/ai-async-task-pipeline.html)。

应用自定义的 `done` 不会自动关闭原生 `EventSource`，客户端应按协议调用 `close()`，也可以由后续连接的 HTTP 204 响应阻止继续重连。读取事件的接口不应每次连接都重新创建生成任务，否则重连可能重复生成和计费。

用户可通过显式取消接口停止任务，写失败、连接生命周期回调和响应式取消也可能暴露断开。检测可能延迟，应统一触发上游取消与资源回收，并核查实际是否停止。
按供应商适配器确认的终态区分完整、用户取消和中断，不能把所有 API 都归结为 `finish_reason`。用量在断流时可能不完整，Chat Completions 的 `stream_options.include_usage` 也不能保证断开后拿到最终记录。估算必须标注，后续以实际用量对账；已提交业务副作用另行查询。

## 连接治理与观测

| 项           | 建议                                        | 为什么                                    |
| ------------ | ------------------------------------------- | ----------------------------------------- |
| 并发流上限   | 压测定，如 200/实例，信号量卡住             | 超了要排队，别拖垮普通接口                |
| 单流最长时长 | 3~10 分钟，到点主动 `complete`              | 挂死的流比失败请求更难查                  |
| 心跳间隔     | 15~30 秒，注释行 `: ping`                   | 必须小于反代 `proxy_read_timeout`         |
| 优雅下线     | 先摘流量（readiness 置 DOWN），等在途流结束 | 宽限期要大于最长流时长，否则被 SIGKILL 切 |
| 多实例路由   | 区分当前连接与后续恢复                      | 当前连接固定，重连要能访问正确任务与事件  |

跨实例恢复可以使用共享事件存储，也可以采用明确的路由策略，并不必然要求粘性会话。SSE 连接的生命周期和[HTTP 长连接保活](/cs-basics/network/network-http-keepalive-tcp-keepalive.html)需分开理解，空闲连接复用设置不能替代应用心跳。

分开记录用户端 TTFT、上游首文本耗时、后端首次文本写出、总时长、有效输出量和中断率。各观测点要明确起止范围，SSE 分片可以包含多个 Token，不能用分片数量冒充模型 Token 用量。`traceId` 与受权限保护的任务标识用于串联各阶段。

## 面试怎么答

1. **先说明观测范围**：流式通常让有效输出更早可见，仍要分别测用户端 TTFT 和总时长，不能将心跳算成出字。
2. **再说协议**：SSE 是 HTTP 上的纯文本事件流，`\n\n` 分事件，`id` 配 `Last-Event-ID` 做续传；单向推送用它，双向交互才上 WebSocket。
3. **再给实现**：Servlet 栈 `SseEmitter` + 显式超时 + 必 `complete`；WebFlux 返回 `Flux<ServerSentEvent>`，取消天然传播但别混阻塞调用。
4. **排障顺序**：客户端 → 反代 → 网关 → 框架 → 容器 → 上游，靠 `curl -N` 逐层加、加谁复现谁。
5. **最后说断线**：长任务任务化、流只读增量；用户断开要取消上游并标 `INTERRUPTED`。

## 容易踩的坑

- **以为异步自动解决并发**。初始请求线程释放后，阻塞上游仍可能占工作线程，非阻塞链路也受连接、写出和供应商限额约束。
- **超时只猜默认值**。应用、容器、代理与供应商可能分别限制不同阶段，需要读取配置并用受控流定位。
- **把单个换行或 TCP 块当成事件边界**。单个换行结束一行，空行才派发事件。手拼含换行的正文还可能丢掉未加 `data:` 前缀的行，应使用正确编解码器或明确的 JSON 载荷。
- **只查一层缓冲**。压缩、代理和应用聚合都可能影响写出，排障可先关闭相关处理做对照，不能只凭响应是否压缩判定延迟来源。
- **心跳流不写终止条件**。`Flux.interval` 永不结束，`merge` 之后响应永远不收尾，前端等不到 `done`；更隐蔽的是 `tokens.mergeWith(heartbeat.takeUntilOther(tokens.ignoreElements()))` 这种写法会把冷流订阅两次，模型被调两遍、账单双份。
- **前端收完 `done` 不 `close()`、拿 `EventSource` 传自定义 header、觉得流式省钱**。第一个触发重连重放，第二个根本不支持（走 Cookie 或 fetch 流），最后一个纯属误解：token 一分不少，还多出断流、取消、续传的工程量。

## 小结

1. 用户端 TTFT 以首个有效可见文本为终点，同步、流式和引擎指标要注明各自的计时范围。
2. SSE 以空行派发事件，多行 `data:` 用换行拼接，网络分片与事件边界相互独立。
3. Spring 发送片段之外还需管理认证、取消与订阅清理，底层 SDK 必须实际响应相应信号。
4. 不出字按「客户端 → 反代 → 网关 → 框架 → 容器 → 上游」六层排，靠 `curl -N` 逐层加和分片时间戳日志定位，别一上来翻模型代码。
5. 断线恢复要有保存的任务和事件，终态与供应商完成规则对应，未知用量和副作用分别核查。

## 参考

- 综合仓库资料《大模型 API 调用工程实践：流式输出、重试、限流与结构化返回》与《Web 消息推送》两篇，交叉验证后用自己的话重写；SSE 事件以空行分隔、多行 `data:` 由客户端拼接、`EventSource` 不支持自定义请求头且自动重连带 `Last-Event-ID`、Nginx 需关 `proxy_buffering` 等点两篇表述一致，并已与协议行为对齐。
- 主动纠偏：阻塞上游可能长期占工作线程，非阻塞客户端不必一流绑定一线程；HTTP/2 无 chunked 不代表不流式；单个换行不代表事件结束。取消、用量和完成标志均按真实适配器处理。

2026-11-20 另核对 [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) 的事件解析、重连与 HTTP 204 规则。本文为协议和发送片段说明，未实测所列全部 Spring、网关、CDN 组合，也未据示意代码承诺取消后上游不再计费。
