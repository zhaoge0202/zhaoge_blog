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
  text: "Java 后端怎么接大模型？Spring AI、LangChain4j 和直连 HTTP 怎么选？"
  link: "/ai/ai-java-integration-stack.html"
next:
  text: "Function Calling 调内部接口要注意什么？写操作怎么防止被模型乱调？"
  link: "/ai/ai-tool-calling-business-api.html"
---

# 大模型流式输出怎么落到后端？SSE 为什么会卡住不出字？

> 流式不缩短总时长，它只是把「等 20 秒」换成「第 1 秒就开始出字」；卡住不出字，九成是链路上有一层在攒包。

上一篇 [Java 后端怎么接大模型](/ai/ai-java-integration-stack.html) 把选型讲完，最后落在一个窄接口 `LlmGateway.stream(...)` 上：业务侧只拿一条增量流，不关心底下是 Spring AI、LangChain4j 还是手写 OkHttp。这篇从这条流往回看——增量怎么变成浏览器上一行行蹦出来的字，以及「连上了、但一个字都没有」到底卡在哪一层。

## 先算一笔账：流式改的是 TTFT，不是总耗时

假设一次回答 800 token、每 token 50ms（预填充约 1 秒），链路开销先忽略：

| 指标         | 同步返回                     | 流式返回                          |
| ------------ | ---------------------------- | --------------------------------- |
| 首字延迟     | ≈ 40 秒（等 800 个都生成完） | ≈ 1 秒（第一个 token 就能渲染）   |
| 端到端总耗时 | ≈ 40 秒                      | 仍然 ≈ 40 秒                      |
| 用户感知     | 转圈，不知道死没死           | 立刻出字，能判断方向对不对        |
| 后端复杂度   | 拿完整字符串再处理           | 增量事件、取消、断流、半成品 JSON |

**TTFT 就是「请求发出到第一个可展示片段」的时间**：同步接口里它等于总耗时，流式接口里它被单独拎了出来，用户体感的改善全在这里——模型该算的 token 一个没少，钱也一分没省。

两个指标必须分开盯：TTFT 和总时长 / token 速率。TTFT 涨，通常是排队、上下文太长、供应商抖动；总时长涨，可能只是这次回答本来就长。混成一个「接口耗时」告警，你永远不知道该怪谁。这和 [慢请求证据链怎么查](/high-availability/high-availability-slow-request-tracing.html) 同一套思路——先把总耗时切段再决定看哪类证据，只是刀口落在「第一个 token 之前 / 之后」。

## SSE 到底是什么：一份用空行分隔的 UTF-8 文本

SSE 不是为大模型发明的，它进 HTML5 草案时是推股票行情、站内信用的。大模型只是把它用到极致：**响应不结束，边算边写**。传输层仍是 HTTP，变化全在响应头：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream;charset=UTF-8
Cache-Control: no-cache
Transfer-Encoding: chunked
X-Accel-Buffering: no
```

没有 `Content-Length`（长度事先不知道），`chunked` 让服务端想写就写；应用层是纯文本，靠**空行** `\n\n` 切事件：

```text
id: 17
event: token
data: 你好，我是

: ping

id: 18
event: done
data: [DONE]
```

| 字段     | 作用                                    | 实践要点                                           |
| -------- | --------------------------------------- | -------------------------------------------------- |
| `data`   | 业务载荷；多行 `data:` 会被拼成一行内容 | 正文有真换行时，拆多行 `data:` 或在应用层转义      |
| `event`  | 事件名，浏览器默认 `message`            | 用 `token` / `done` / `error` 区分语义，别让前端猜 |
| `id`     | 事件序号                                | 重连时浏览器带 `Last-Event-ID`，续传靠它           |
| `retry`  | 建议重连间隔（毫秒）                    | 服务端给一次即可；LLM 场景要小心自动重连           |
| `: 注释` | 冒号开头的行是注释                      | **当心跳用**，前端收不到事件，但能把连接喂活       |

### EventSource 的四个限制，反过来决定了接口长什么样

1. **不能自定义请求头**。`new EventSource(url)` 发不出 `Authorization`，鉴权只能走 Cookie，或把 token 放 query（日志记得脱敏）。
2. **只能 GET、只能文本**。二进制要自己编码。
3. **断线自动重连**，并自动带上 `Last-Event-ID`——这是它比 WebSocket 省事的地方。
4. **HTTP/1.1 下浏览器每域名只开 6 条连接**，EventSource 也占名额；多开两个标签页就把连接池占满，页面上别的请求全排队。

要自定义 header 就换 `fetch` + `ReadableStream` 自己解析事件（社区有 `fetch-event-source` 一类封装），代价是重连和 `Last-Event-ID` 都得自己实现——不是哪个更高级，只是谁承担复杂度。

## SSE 还是 WebSocket？

| 维度         | SSE                                           | WebSocket                            |
| ------------ | --------------------------------------------- | ------------------------------------ |
| 方向         | 服务端 → 客户端单向                           | 全双工                               |
| 载体         | 普通 HTTP 响应                                | HTTP Upgrade（101）后走独立协议帧    |
| 重连 / 鉴权  | `EventSource` 自带重连；鉴权靠 Cookie / query | 重连自己写；握手可带 token           |
| 过代理 / CDN | 就是 HTTP，配好缓冲即可                       | 要求代理支持 Upgrade，老网关常挂     |
| HTTP/2       | 天然受益（一条连接多个流）                    | 需要 RFC 8441 扩展，支持度看代理     |
| 实现成本     | Controller 返回一个流就行                     | 端点管理、会话表、心跳、重连全自己写 |

结论：**只要「服务端持续往下推、客户端偶尔发个新请求」能表达清楚，就用 SSE**——对话、报告生成、日志跟读都是这一类。真需要双向高频交互（语音对话要边说边打断、多人协同）才上 WebSocket。

## Spring 侧两种写法

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
                emitter.completeWithError(e);                  // 客户端断了，就这一个信号
            }
        }, emitter::completeWithError, emitter::complete);     // 正常结束必须 complete
        return emitter;   // 立即返回，容器请求线程被释放
    }
}
```

- **用完一定要 `complete()`**，否则 emitter 一直挂在注册表里，async 上下文和连接都释放不掉；三个回调里都要清注册表，不然一次压测下来「并发数只涨不跌」。
- **默认超时是坑**：`spring.mvc.async.request-timeout` 不配就取底层默认值（Tomcat 连接器 `asyncTimeout` 默认 30 秒，Spring Boot 文档提到的默认值还随 Servlet 版本变）。症状好认——**每次都在第 30 秒整齐断开**。

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

收益是取消与背压天然贯通：浏览器断开 → `cancel` 沿 `Flux` 传回上游 → 模型调用被取消，不用手写「探测断开」。代价是**这条链上不能混阻塞调用**：`block()` 跑在 Netty event loop 上直接抛 `IllegalStateException`，JDBC、`RestTemplate`、文件读都要挪到 `boundedElastic`。另外 MVC 侧返回响应式类型只是出口用了 `Flux`，容器、超时、线程仍按 Servlet 那套治理，且 HTTP/1.1 没有背压协商，写多快算多快。

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
    gzip off;                     # SSE 不能压
    proxy_read_timeout 300s;      # 必须大于最长静默时间
}
```

两个容易漏的点：`X-Accel-Buffering: no` 是**响应头**，必须由**上游（后端）**在响应里写出来才生效——在 Nginx 自己的 location 里写 `add_header X-Accel-Buffering no;` 对它**没用**，那一行只会把响应头带给下游（比如 CDN）。改不动 Nginx 配置时，靠后端加这个头救急；`proxy_read_timeout` 默认 60 秒，模型想 90 秒才吐第一个字，连接先被代理切了——现场看就像「模型挂了」。

### 2. 网关的超时与缓冲

**现象**：前几秒有字，然后连接被切；或网关报 504、`DataBufferLimitException`。
**机制**：Spring Cloud Gateway 的 `response-timeout` 到点就断；一旦挂上读 body 的过滤器（`ModifyResponseBody`、`CacheRequestBody`），整个响应被攒进内存，受 `max-in-memory-size` 约束。细节见 [Spring Cloud Gateway 的路由和过滤器](/system-design/spring-cloud/spring-cloud-gateway-filter-limit.html)。

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

### 3. 框架 / 容器没走 chunked

**现象**：响应头里出现 `Content-Length`，或传输编码根本不是 chunked。**机制**：Controller 返回 `String` 被 `@ResponseBody` 一次性序列化；手写 `HttpServletResponse` 拿 `PrintWriter` 写完不 `flush()`，数据全躺在容器（Tomcat 默认 8KB）响应缓冲里；过滤器包装了响应对象却没把 `flush` 透传。**修复**：交给 `SseEmitter` / `Flux` 管，别自己拼 `data:`。

### 4. HTTP/2 与 CDN 的聚合

**现象**：换个网络就复现、只在某个 CDN 节点复现，直连后端正常。**机制**：部分 CDN 默认对小响应做聚合或压缩；HTTP/2 流控窗口偏小也让小块数据延迟。HTTP/2 本身不缓冲，它前面那层会。**验证**：同机对比 `curl --http2` 与 `curl --http1.1`，再绑源站 IP 加 `Host` 头绕过 CDN；修法是让对方关缓存关压缩，或让流式接口单独走一个域名。

### 5. 线程被占死

**现象**：并发一高，新流「连不上」或很久才开始转，而不是「慢」。**机制**：`SseEmitter` 返回后容器请求线程确实释放了，但**每条活跃流仍需要一个线程消费上游**——模型 SDK 多是阻塞迭代，一段流钉一个线程；用 `StreamingResponseBody` 更直接，写响应的任务本身就在 `AsyncTaskExecutor` 里跑完整条流，池子打满后请求排队，表现就是「连不上」。**修复**：信号量限单实例并发流数 + Java 21 虚拟线程承载「纯等上游」+ 流式链路独立线程池。参数怎么调看 [线程池](/java/concurrent/java-concurrency-thread-pool.html)。

### 6. 上游模型本身慢

**现象**：直连后端也慢，第一个分片就要 8 秒。**机制**：上下文太长、模型排队、供应商抖动，和你的代码无关。**区分方法**：后端给每个分片打时间戳——`upstream_first_chunk=8123ms our_first_flush=8140ms chunks=214`，前一个数接近 8000 就是上游不给，前一个数 200 而后一个 6000 就是有层在攒包，回第 1~4 层继续查。

## 断线和续传：别指望连接一直活着

`EventSource` 会自动重连并带上 `Last-Event-ID`，服务端只要做到「按 id 把后来的事件补上」：

| 方案            | 做法                                                      | 适用             | 代价                   |
| --------------- | --------------------------------------------------------- | ---------------- | ---------------------- |
| 事件缓存补齐    | 每条流缓存最近 N 个事件（如 200 条 / 5 分钟），按 id 补发 | 短问答、即时对话 | 缓存有上限，超时补不齐 |
| 任务化 + 增量读 | 生成过程落库（或 Redis Stream），流只读已生成部分         | 长报告、批量任务 | 多一张表 + 一个状态机  |

结论很直白：**长回答一律走「任务 + 增量读取」**。供应商侧一旦断流，你根本没法从 token 级别续上，能续的只有自己存下来的文本；任务化怎么设计在 [模型很慢，长任务怎么设计](/ai/ai-async-task-pipeline.html) 里展开。

还有个反直觉的点：浏览器**正常收到结束事件后仍会自动重连**（它只看到 TCP 关了，除非服务端用 204 收尾）。前端收到 `done` 必须立刻 `es.close()`，否则一次对话被重放三遍，账单也翻三倍。

用户关页、点停止、切会话，后端能拿到的唯一信号是**写响应失败**：`send()` 抛 `IOException`（`Broken pipe`），或 WebFlux 的 `doOnCancel` 被触发。拿到信号要做三件事：取消上游（`disposable.dispose()`，只在前端停止展示是纯烧钱）、落状态（没收到 `finish_reason` 的流标 `INTERRUPTED`，别当完整答案入库）、记用量（`usage` 通常只在最后一个 chunk 返回，断开时拿不到——开 `stream_options.include_usage` 尽力拿，或按已下发 chunk 估算）。

## 连接治理与观测

| 项           | 建议                                        | 为什么                                    |
| ------------ | ------------------------------------------- | ----------------------------------------- |
| 并发流上限   | 压测定，如 200/实例，信号量卡住             | 超了要排队，别拖垮普通接口                |
| 单流最长时长 | 3~10 分钟，到点主动 `complete`              | 挂死的流比失败请求更难查                  |
| 心跳间隔     | 15~30 秒，注释行 `: ping`                   | 必须小于反代 `proxy_read_timeout`         |
| 优雅下线     | 先摘流量（readiness 置 DOWN），等在途流结束 | 宽限期要大于最长流时长，否则被 SIGKILL 切 |
| 多实例粘性   | 不需要                                      | 一条流在单实例内跑完，TCP 天然钉住        |

只有做「跨实例续传」才需要粘性，而一旦要靠粘性，说明你的流本该任务化。顺带一句：SSE 连接的生命周期和 [HTTP 长连接怎么保活](/cs-basics/network/network-http-keepalive-tcp-keepalive.html) 是两码事，`keepalive_timeout` 管空闲连接复用，代替不了应用层心跳。

要盯的指标分两列看：**TTFT**（请求进来到第一个分片 flush）指向排队、上下文过长、供应商抖动；**总时长 / token per second / 中断率**指向回答变长、模型降速、超时配太短。日志至少带 `traceId` 和 `conversationId`（前端也带一份），否则用户说「刚才那条卡住了」你连哪条流都找不着。

## 面试怎么答

1. **先纠正前提**：流式不改总耗时，只改 TTFT，所以监控要拆成 TTFT 和总时长两个指标。
2. **再说协议**：SSE 是 HTTP 上的纯文本事件流，`\n\n` 分事件，`id` 配 `Last-Event-ID` 做续传；单向推送用它，双向交互才上 WebSocket。
3. **再给实现**：Servlet 栈 `SseEmitter` + 显式超时 + 必 `complete`；WebFlux 返回 `Flux<ServerSentEvent>`，取消天然传播但别混阻塞调用。
4. **排障顺序**：客户端 → 反代 → 网关 → 框架 → 容器 → 上游，靠 `curl -N` 逐层加、加谁复现谁。
5. **最后说断线**：长任务任务化、流只读增量；用户断开要取消上游并标 `INTERRUPTED`。

## 容易踩的坑

- **以为 `SseEmitter` 一定不占线程**。返回后容器线程释放了，但每条活跃流还要一个线程消费上游；`StreamingResponseBody` 则整条流都占着池线程。并发上限不是靠「异步」自动解决的。
- **超时吃默认值**。`spring.mvc.async.request-timeout` 不配就用容器默认，30 秒整齐断开，看着像模型问题。
- **正文里的裸 `\n` 撕裂事件**。直接把模型增量塞进 `data:`，遇到列表、代码块就出现裸换行，前端解析立刻错位——要么拆多行 `data:`，要么出站转义、前端还原。
- **只关 `proxy_buffering`，忘了 `gzip`**。压缩器要攒够才吐，TTFT 原地倒退；`gzip_types` 没列 `text/event-stream` 时其实不压，但 CDN 可能替你压，所以显式关。
- **心跳流不写终止条件**。`Flux.interval` 永不结束，`merge` 之后响应永远不收尾，前端等不到 `done`；更隐蔽的是 `tokens.mergeWith(heartbeat.takeUntilOther(tokens.ignoreElements()))` 这种写法会把冷流订阅两次，模型被调两遍、账单双份。
- **前端收完 `done` 不 `close()`、拿 `EventSource` 传自定义 header、觉得流式省钱**。第一个触发重连重放，第二个根本不支持（走 Cookie 或 fetch 流），最后一个纯属误解：token 一分不少，还多出断流、取消、续传的工程量。

## 小结

1. 流式只降低 **TTFT**，不降低总耗时、也不省 token；监控必须把首字延迟和总时长拆成两个指标。
2. SSE 是 HTTP 上的 UTF-8 文本事件流，`\n\n` 分事件，`id` + `Last-Event-ID` 是重连续传的唯一抓手；单向推送选它，双向交互才上 WebSocket。
3. Servlet 栈 `SseEmitter` 要显式超时 + 必 `complete` + 回调里清注册表；WebFlux 返回 `Flux<ServerSentEvent>`，取消天然传播但不能混阻塞调用。
4. 不出字按「客户端 → 反代 → 网关 → 框架 → 容器 → 上游」六层排，靠 `curl -N` 逐层加和分片时间戳日志定位，别一上来翻模型代码。
5. 断线一律任务化 + 增量读；用户断开要取消上游、标 `INTERRUPTED`、记用量，否则就是替用户的白屏买单。

## 参考

- 综合仓库资料《大模型 API 调用工程实践：流式输出、重试、限流与结构化返回》与《Web 消息推送》两篇，交叉验证后用自己的话重写；SSE 事件以空行分隔、多行 `data:` 由客户端拼接、`EventSource` 不支持自定义请求头且自动重连带 `Last-Event-ID`、Nginx 需关 `proxy_buffering` 等点两篇表述一致，并已与协议行为对齐。
- 主动纠偏：资料里「流式占一个请求线程直到结束」只说对一半——`SseEmitter` 返回后容器线程是释放的，占用来自消费上游的线程和连接本身；`SseEmitter` 并非「默认永不超时」，不配就吃容器默认值；网关 `response-timeout` 的语义随版本变化，本文只给排查方法，不钉死数字。
