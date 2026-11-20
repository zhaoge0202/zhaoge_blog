---
title: "两个模型都说兼容，网关切流量为什么会失败？"
description: "把供应商能力、流式切换和用量终态写成可验证的网关契约。"
breadcrumb: true
article: true
editLink: false
category:
  - "AI 应用开发"
tag:
  - "项目实战"
  - "排障"
prev:
  {
    text: "大模型流式输出怎么落到后端？SSE 为什么会卡住不出字？",
    link: "/ai/ai-streaming-sse-backend.html",
  }
next: { text: "业务模型怎么选，什么情况下值得换？", link: "/ai/ai-business-model-selection.html" }
---

# 两个模型都说兼容，网关切流量为什么会失败？

> 网关要按业务契约挑备用模型，按交付与执行状态决定能否切换，再分别确认响应终态和用量。

## 问一句工单状态，为什么不能把两个模型的输出拼起来？

工单助手先查到编号 T-104，再让模型把结构化结果解释给客服。模型 A 已经写出“工单还在处理中”，连接突然关闭。若网关在同一条流里接着转发模型 B 重新生成的“工单已经关闭”，客服会把两段当作一个回答，下游也可能把拼接文本误存成成功结果。

同样是调用失败，A 在任何业务事件送出前就返回 HTTP 429，备用模型 B 有机会完整重做这一步。还有一种情况是回答已经正常完成，供应商没有返回最终用量。这时应用可以收下答案，同时把账记录为待核对。三个场景需要不同的处理，因为网关管理的是一次逻辑请求中的多次上游调用，每次调用的响应、交付和计量状态都要有记录。流式传输和客户端补发见 [SSE 后端实现](./ai-streaming-sse-backend.html)。

## 路由之前要核对哪些能力？

把候选模型标识写成“供应商 + 接口族/API 版本 + 模型版本”。即使来自同一家，Chat Completions 和 Responses 的线协议也有区别。版本固定以后，用实际请求和回放样本确认能力，业务侧再依赖稳定的强约束，例如“流式输出 + 指定工具 + 严格输出 Schema”。机房、租户数据保留要求和可用配额也要筛过，价格和延迟只在合格候选里排序。网关入口和 Java 适配层可以沿用 [Java 模型接入](./ai-java-integration-stack.html)。

| 契约           | OpenAI Chat Completions                                            | OpenAI Responses                                                                | Anthropic Messages                                                                    |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 识别本轮终态   | 读取各 choice 的 `finish_reason`，并按流契约处理 `[DONE]`          | 按 `response.completed`、`response.incomplete`、`response.failed` 等类型处理    | 读取 `message_delta` 的 `stop_reason`，按 `message_stop` 确认消息边界                 |
| 拼装工具参数   | 按 choice 的 `index` 和 `delta.tool_calls` 内的 `index` 拼参数片段 | 用输出项标识归集 `response.function_call_arguments.delta`，核对参数和输出项终态 | 按 content block 的 `index` 归集 `input_json_delta`，到 `content_block_stop` 结束该块 |
| 严格结构化输出 | `response_format` 的 `json_schema` 配置                            | `text.format` 的 `json_schema` 配置                                             | `output_config.format` 的 `json_schema` 配置                                          |
| 读取用量       | 启用 `stream_options.include_usage` 时读取结束标记前的用量事件     | 视终态中的 Response 对象和实际返回字段提取                                      | 从 `message_start` 取初始值，按 `message_delta` 的累计值更新相应字段                  |

表里的字段由供应商 API 定义。SSE 客户端读到空行才派发事件，提前收到 EOF 时丢弃尚未结束的事件，即使最后一行含有完整的 JSON。只拿到 HTTP 200 或读完了响应体，仍需识别相应 API 定义的终态。[HTML SSE 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html#interpreting-an-event-stream)

以 `lookup_ticket` 为例，第一段带来调用 ID、工具名及 `{"ticket":`，第二段才带来 `"T-104"}`。适配器要按各自协议的索引归集，完结后把调用 ID 与工具结果一一对应。比如两路参数片段交错到达时，都追加到首个工具的缓冲区会直接拼坏 JSON。消息的终态如果是请求调用工具，下一步是校验参数、验证身份和工单归属，再由应用执行。工具参数合法也不代表调用已授权。[Agent 运行循环](./ai-agent-runtime-loop.html)

严格模式和普通 JSON 模式要在能力矩阵里分开。供应商严格模式最多支持各自的 JSON Schema 子集。即使接入端验证通过，服务也要先分流安全拒答、达到输出上限导致的截断和正常回答。正常回答再过本地 Schema 与业务校验。例如 `{"ticket":"T-104","priority":"P9"}` 可以被 JSON 解析，却违反 `priority` 只接受 P1、P2、P3 的接口契约。这一层失败应保留明确的状态，不能被 HTTP 200 或成功解析掩盖。[Prompt 与结构化输出](./ai-prompt-structured-output.html)

## 第一个业务事件发出去以后，为什么切换条件会变？

以一次模型请求为边界，网关在首个正文、结果或其他不可撤回的业务事件进入下游交付路径时，记录该尝试已提交输出。此时不能等浏览器确认看到了哪一个字才立标记，因为网络异常时往往无从确认。HTTP 响应头、心跳注释和不承诺供应商的通用进度可以提前发送。工具的真实执行另有边界。只要本次尝试可能已产生外部副作用，就需要通过业务操作号查明结果，不能把“没有收到工具回包”当成没执行。

| 实际发生的事                                              | 应用如何收尾                                 | 可以自动切备用吗                               |
| --------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| 首个业务事件前收到暂时性 HTTP 429，且这一尝试未触发副作用 | 记录主调用限流，重新核对候选的能力和独立配额 | 在总截止时间、尝试次数与预算内可以             |
| 先收到 HTTP 200，流内又出现供应商错误                     | 按错误分类和当时的交付进度处理               | 仅在尚未交付、确认没有副作用且错误可重试时考虑 |
| 正文已交付，之后断流或缺少协议终态                        | 保留可见片段并标记中断，单独提示重新生成     | 同一回答不能直接接另一模型的新文本             |
| 已请求写工具，操作结果未知                                | 按业务操作号查询结果，按工作流状态恢复       | 不因模型响应失败而重做写操作                   |
| 正常响应结束，但缺少全部或部分用量                        | 正常交付有效回答，单独挂账等待核对           | 不因补账而重新生成                             |

供应商返回可用的 `Retry-After` 时，重试同一限流范围应尊重它。切到独立配额的候选仍要受原请求的总截止时间约束。若总时限只剩 200 毫秒，备用模型也需要先完成排队和首个业务事件，通常应直接降级或返回繁忙。用户取消后停止当前链路并传播取消，不能把取消当成另一个供应商的重试信号。可关联的应用请求键负责防止重复提交同一请求。外部副作用和供应商计费各有自己的幂等或对账边界。[应用工程与网关预算](./ai-application-engineering.html) · [写工具的业务约束](./ai-tool-calling-business-api.html)

## 没有 usage，如何记录这次成功或失败？

业务请求 `requestId` 连着每次真实上游调用的 `attemptId`。每笔记录实际选中的模型、供应商请求标识、终态、计量时间、计价版本和可取得的用量。一次问答走了两个供应商，就有两笔可以独立核对的记录。第一笔未给出 `usage` 时，文档里看到的问答片段、网关估算以及第二笔的统计都不能代替第一笔的实际计量。

Chat Completions 启用 `stream_options.include_usage` 时，最后的用量事件出现在 `[DONE]` 之前，且 `choices` 为空。如果解析器遇到空 `choices` 就跳过整条事件，就会丢掉这笔用量。Anthropic Messages 在 `message_delta` 给出累计计数，适配器按字段更新最近的值，逐个事件相加会重复计量。[OpenAI Chat 流式用量参数](https://github.com/openai/openai-python/blob/main/src/openai/types/chat/chat_completion_stream_options_param.py) · [Anthropic Messages 流式用量类型](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages/messages.ts)

例如，回答完整且通过校验时，响应状态为 `COMPLETED`，用量状态可以同时是 `PENDING`。若只拿到了输入统计，保留已知值，缺失字段留空。用估算占用额度做准入，实际用量到达时按尝试记录修正。只有供应商明确返回了零，或账单核对证实为零，才填零。

## 怎样用两个本地替身复现这些边界？

下面的测试使用 Node.js 22 及以上版本的内置模块。把代码保存为 `gateway-contract.mjs`，运行 `node gateway-contract.mjs`。回环地址上两个路由模拟两种供应商，保留与本实验相关的字段。解码器处理样本所用的 LF 事件格式，每次只追踪一个候选和一个工具。示例把文本写入数组作为交付动作。结构化对象则等流正常结束才交给校验器。

```js
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

const sse = (value, event) =>
  (event ? "event: " + event + "\n" : "") +
  "data: " +
  (typeof value === "string" ? value : JSON.stringify(value)) +
  "\n\n";
const chat = (delta, reason = null) =>
  sse({ choices: [{ index: 0, delta, finish_reason: reason }] });
const messages = (type, fields = {}) => sse({ type, ...fields }, type);
const output = '{"ticket":"T-104","priority":"P2"}';
let backupCalls = 0;

const server = createServer((req, res) => {
  const [, provider, mode] = req.url.split("/");
  if (provider === "chat" && mode === "limit") {
    res.writeHead(429, { "Retry-After": "1" }).end();
    return;
  }
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const parts = ['{"ticket":', '"T-104"}'];

  if (provider === "chat") {
    if (mode === "tool") {
      for (const [i, args] of parts.entries()) {
        const first = i === 0;
        res.write(
          chat({
            tool_calls: [
              {
                index: 0,
                ...(first ? { id: "call-1", type: "function" } : {}),
                function: first ? { name: "lookup_ticket", arguments: args } : { arguments: args },
              },
            ],
          }),
        );
      }
      res.end(chat({}, "tool_calls") + sse("[DONE]"));
      return;
    }
    res.write(chat({ content: mode === "cut" ? "仍在" : output }));
    res.end(mode === "cut" ? "data: [DONE]\n" : chat({}, "stop") + sse("[DONE]"));
    return;
  }

  backupCalls++;
  res.write(messages("message_start", { message: { usage: { input_tokens: 11 } } }));
  const block =
    mode === "tool"
      ? { type: "tool_use", id: "tool-1", name: "lookup_ticket", input: {} }
      : { type: "text", text: "" };
  res.write(messages("content_block_start", { index: 0, content_block: block }));
  const deltas =
    mode === "tool"
      ? parts.map((part) => ({ type: "input_json_delta", partial_json: part }))
      : [{ type: "text_delta", text: output }];
  for (const delta of deltas) res.write(messages("content_block_delta", { index: 0, delta }));
  res.write(messages("content_block_stop", { index: 0 }));
  res.write(
    messages("message_delta", {
      delta: { stop_reason: mode === "tool" ? "tool_use" : "end_turn" },
      usage: { output_tokens: 9 },
    }),
  );
  res.end(messages("message_stop"));
});

async function* readData(body) {
  let pending = "";
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    pending += chunk;
    let boundary;
    while ((boundary = pending.indexOf("\n\n")) >= 0) {
      const lines = pending.slice(0, boundary).split("\n");
      pending = pending.slice(boundary + 2);
      const fields = lines.filter((line) => line.startsWith("data:"));
      if (fields.length) yield fields.map((line) => line.slice(5).replace(/^ /, "")).join("\n");
    }
  }
}

server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = "http://127.0.0.1:" + server.address().port;

async function attempt(provider, mode, signal, emit) {
  const response = await fetch(origin + "/" + provider + "/" + mode, { signal });
  if (response.status === 429) {
    await response.body.cancel();
    return { provider, status: "RATE_LIMITED", usage: null };
  }
  assert.ok(response.ok && response.headers.get("content-type") === "text/event-stream");

  let reason,
    ended,
    args = "",
    usage = null;
  for await (const data of readData(response.body)) {
    if (provider === "chat" && data === "[DONE]") {
      ended = true;
      break;
    }
    const event = JSON.parse(data);
    if (provider === "chat") {
      const choice = event.choices?.[0];
      if (choice?.delta?.content) emit(choice.delta.content);
      args += choice?.delta?.tool_calls?.[0]?.function?.arguments ?? "";
      reason = choice?.finish_reason ?? reason;
      usage = event.usage ?? usage;
    } else {
      if (event.type === "message_stop") {
        ended = true;
        break;
      }
      if (event.delta?.type === "text_delta") emit(event.delta.text);
      if (event.delta?.type === "input_json_delta") args += event.delta.partial_json;
      reason = event.delta?.stop_reason ?? reason;
      if (event.message?.usage) usage = event.message.usage;
      if (event.usage) usage = { ...usage, ...event.usage };
    }
  }
  if (!ended) return { provider, status: "INTERRUPTED", usage };
  if (reason === "tool_calls" || reason === "tool_use") {
    return { provider, status: "TOOL_REQUESTED", args: JSON.parse(args), usage };
  }
  const status = reason === "stop" || reason === "end_turn" ? "COMPLETE" : "UNUSABLE";
  return { provider, status, usage };
}

async function run(mode) {
  const signal = AbortSignal.timeout(3000);
  const delivered = [];
  const emit = (delta) => delivered.push(delta);
  const attempts = [await attempt("chat", mode, signal, emit)];
  if (attempts[0].status === "RATE_LIMITED" && !delivered.length && !signal.aborted) {
    attempts.push(await attempt("messages", mode, signal, emit));
  }
  return { attempts, delivered };
}

function validResult(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return false;
  }
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).sort().join(",") === "priority,ticket" &&
    typeof value.ticket === "string" &&
    /^T-\d+$/.test(value.ticket) &&
    ["P1", "P2", "P3"].includes(value.priority)
  );
}

try {
  const switched = await run("limit");
  assert.deepEqual(
    switched.attempts.map((a) => a.status),
    ["RATE_LIMITED", "COMPLETE"],
  );
  assert.deepEqual(switched.attempts[1].usage, { input_tokens: 11, output_tokens: 9 });
  assert.deepEqual(switched.delivered, [output]);
  assert.ok(validResult(switched.delivered.join("")));
  assert.equal(validResult('{"ticket":"T-104","priority":"P9"}'), false);
  assert.equal(validResult('{"ticket":["T-104"],"priority":"P2"}'), false);
  assert.equal(validResult('{"ticket":'), false);

  const interrupted = await run("cut");
  assert.deepEqual(
    interrupted.attempts.map((a) => a.status),
    ["INTERRUPTED"],
  );
  assert.deepEqual(interrupted.delivered, ["仍在"]);

  const unmetered = await run("no-usage");
  assert.deepEqual(
    unmetered.attempts.map((a) => a.status),
    ["COMPLETE"],
  );
  assert.equal(unmetered.attempts[0].usage, null);
  assert.ok(validResult(unmetered.delivered.join("")));
  assert.equal(backupCalls, 1);

  for (const provider of ["chat", "messages"]) {
    const reply = await attempt(provider, "tool", AbortSignal.timeout(3000), assert.fail);
    assert.equal(reply.status, "TOOL_REQUESTED");
    assert.deepEqual(reply.args, { ticket: "T-104" });
  }
  console.log("429 切换、断流、缺失用量、结构校验及两种工具参数分片均通过");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
```

“断流”样本让 HTTP 正常结束，但故意只发到 `data: [DONE]\n`，少一个空行。浏览器兼容的 SSE 解码应丢弃该未完成事件，已交付的“仍在”保持可见，应用状态是 `INTERRUPTED`。另一个样本有完整结束事件和可校验的正文，但没有用量事件，验收要求是回答成功、用量为 `null`。生产中还应覆盖真实网络重置、CRLF、多路工具分片、大小限制和取消传播，优先复用成熟的 SSE 解码器。

## 小结

1. 候选能力要按供应商、接口和模型版本逐项验证，尤其是工具、流式终态、Schema 子集和计量。
2. 自动切换需要可重试的故障、未交付业务事件、确认未发生外部副作用，以及剩余的总时间和预算。
3. SSE 正常关闭、模型轮次正常结束、答案通过业务校验是不同的判断。
4. 按每次上游调用记录用量，未知和估算各有状态。缺少用量不会使完整答案变成失败。

## 参考

综合仓库里的模型 API 和网关资料，按 SSE 的事件派发规则与两家官方 SDK 类型核对。使用 Node.js 24.8.0 运行本文的两个本地替身，核对限流切换、应用层断流、缺失用量、结构字段和两种工具参数分片。实测范围限于测试中的 HTTP/SSE 样本。

- [WHATWG HTML 规范中的 SSE 事件解释](https://html.spec.whatwg.org/multipage/server-sent-events.html#interpreting-an-event-stream)
- [OpenAI Chat Completions 的流式分片类型](https://github.com/openai/openai-python/blob/main/src/openai/types/chat/chat_completion_chunk.py) · [OpenAI Responses 的流式事件类型](https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_stream_event.py)
- [OpenAI Structured Outputs 的 JSON Schema 响应格式](https://github.com/openai/openai-python/blob/main/src/openai/types/shared/response_format_json_schema.py)
- [Anthropic Messages SDK 的结构化输出及流式类型](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages/messages.ts) · [Anthropic Messages SDK 的流式处理](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/lib/MessageStream.ts)
