---
title: "MCP 的 Tools、Resources、Prompts 应该怎么区分？"
description: "用订单助手理解 MCP 三类原语、输入输出契约与上下文边界。"
breadcrumb: true
article: true
editLink: false
category:
  - "AI 应用开发"
tag:
  - "基础"
  - "细节题"
prev:
  {
    text: "MCP 解决什么问题，和 Function Calling、Agent、Skill 有什么关系？",
    link: "/ai/ai-mcp-architecture.html",
  }
next: { text: "MCP 如何发现能力、处理请求，并兼容新旧协议？", link: "/ai/ai-mcp-lifecycle.html" }
---

# MCP 的 Tools、Resources、Prompts 应该怎么区分？

> Tools 提供可调用的能力，Resources 提供可读取的上下文，Prompts 提供可选择的消息模板；分类看交互契约，而不是后端有没有执行代码。

## 同一个订单助手，为什么需要三种能力？

用户问：“订单 O202611200001 还没发货，帮我分析一下。”助手需要的东西并不相同：

- **实时状态**：调用 `query_order_status`，查询这笔订单当前走到哪一步，适合 Tool。
- **背景证据**：读取 `policy://orders/shipping`，取得发货时效政策，适合 Resource。
- **任务组织方式**：用户选择“订单异常分析”模板，要求按“事实、原因、建议”展开，适合 Prompt。

Tool 的结果和 Resource 的内容都可能是订单 JSON，Prompt 里也能嵌入资源。
不能因为“返回的是文本”就把它叫 Prompt，也不能因为“读取时查了数据库”就认定它只能是 Tool。

**本文按 2026-11-20 核对的 `2026-07-28` 规范讲解。** 能力与版本发现见[协议生命周期](./ai-mcp-lifecycle.html)，这里专注三类原语的用法。

## 模型控制、应用控制、用户控制，分别是什么意思？

官方用三种控制方式描述典型交互意图：

| 原语      | 典型控制方式 | 谁通常决定何时使用                                    | 不代表什么                           |
| --------- | ------------ | ----------------------------------------------------- | ------------------------------------ |
| Tools     | 模型控制     | 模型根据任务提出调用，Host 决定是否执行               | 模型有权绕过业务授权                 |
| Resources | 应用控制     | Host 决定把哪些资源放进上下文，也可结合用户或模型选择 | 资源会自动全部进入模型上下文         |
| Prompts   | 用户控制     | 用户显式选择模板，再由客户端取得消息                  | 模板由用户编写，或享有系统指令优先级 |

这是交互设计，不是强制 UI。Host 可以用菜单选择 Tool，也可以自动附加 Resource，协议没有规定必须画哪个按钮。
“控制方式”也不是权限模型：用户选了退款模板，不等于拿到了退款权限；模型选中了只读工具，也仍要验证订单归属。

## Tools：先发现契约，再发起调用

客户端通过 `tools/list` 发现工具，通过 `tools/call` 发起调用。
Server 声明支持 `tools`，不代表一定返回非空列表；列表可以随请求携带的授权变化。

下面是 `tools/list` 中**单个工具定义的节选**，不是完整请求或列表响应：

```json
{
  "name": "query_order_status",
  "description": "按订单号查询当前用户可见的订单状态。用于确认是否发货；不用于申请退款，不返回支付明细。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "orderNo": {
        "type": "string",
        "pattern": "^O\\d{12}$",
        "description": "O 加 12 位数字的订单号"
      }
    },
    "required": ["orderNo"],
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "orderNo": { "type": "string" },
      "status": { "type": "string", "enum": ["CREATED", "SHIPPED", "CLOSED"] },
      "asOf": { "type": "string", "format": "date-time" }
    },
    "required": ["orderNo", "status", "asOf"],
    "additionalProperties": false
  }
}
```

`inputSchema` 是必需的，`outputSchema` 是可选的。前者描述工具参数，后者约束 `structuredContent`，并不约束整个 JSON-RPC 响应外壳。
没有参数的工具也应给出合法 Schema，例如只接受空对象的 `{"type":"object","additionalProperties":false}`，不能写成 `null`。

Schema 只能解释“订单号长什么样”，不能证明“订单属于谁”。
当前用户和租户应由服务端可信身份上下文取得，不能让模型填一个 `userId` 就据此授权。
工具描述则要说清用途、禁用场景、单位和返回边界，让模型少猜。

一次成功调用的完整 JSON-RPC 响应可以是：

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "result": {
    "resultType": "complete",
    "content": [
      {
        "type": "text",
        "text": "{\"orderNo\":\"O202611200001\",\"status\":\"CREATED\",\"asOf\":\"2026-11-20T09:00:00+08:00\"}"
      }
    ],
    "structuredContent": {
      "orderNo": "O202611200001",
      "status": "CREATED",
      "asOf": "2026-11-20T09:00:00+08:00"
    },
    "isError": false
  }
}
```

`content` 可以包含文本、图像、音频、资源链接等内容块；`structuredContent` 是服务端生成的结构化结果，不是模型的结构化输出功能。
本例同时返回 JSON 文本与结构化值，便于兼容不同客户端。声明了 `outputSchema`，服务端就必须按该 Schema 提供结构化结果，客户端也应验证。
`2026-07-28` 允许 `structuredContent` 为任意 JSON 值；数组、数字等是否合适，应由业务输出契约决定，不能笼统说“必须是对象”。

### HTTP 成功，为什么仍可能是工具失败？

两层错误需要分开：

| 情况                     | 应看什么                      | 订单场景                                         |
| ------------------------ | ----------------------------- | ------------------------------------------------ |
| 请求结构或协议处理失败   | JSON-RPC `error`              | 工具名不存在、请求不满足调用报文结构             |
| 工具已被调用，但执行失败 | `result` 内的 `isError: true` | 订单接口不可用、业务参数超出范围、状态不允许操作 |

所以 `resultType: "complete"` 表示本次协议结果已完成，不代表业务成功；HTTP 200 同样不能代替业务状态。
Host 应把可纠正的工具错误反馈给模型，同时限制重试，不能把异常堆栈、SQL 或内部地址直接塞回上下文。

## Resources：读取上下文，不等于静态文件下载

Resource 用 URI 标识上下文。常用方法是 `resources/list` 列举资源、`resources/templates/list` 发现参数化 URI 模板、`resources/read` 读取内容。

例如，Server 可以公开两类资源：

- `policy://orders/shipping`：发货政策，适合稳定复用。
- `order://orders/{orderNo}/summary`：订单只读视图模板，读取时实时查询并生成内容。

后者内部执行数据库查询，仍然可以是 Resource。选择 Tool 还是 Resource，要看希望暴露“执行一项查询动作”，还是“按 URI 读取一个业务对象视图”。
不要为同一份数据机械暴露两套入口；只有发现方式和使用场景确实不同，才值得同时提供。

下面只展示 `resources/read` 的**响应 `result` 部分**：

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "policy://orders/shipping",
      "mimeType": "text/markdown",
      "text": "标准商品通常在付款后 48 小时内发货；预售商品按订单约定日期处理。"
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

这里的政策内容是教学示例，不代表真实业务规则。资源可以是文本，也可以通过 `blob` 返回 Base64 编码的二进制数据；一次读取还可能返回多个内容项。
资源不存在时不能拿空 `contents` 冒充成功；本版本规定返回 JSON-RPC `-32602`，兼容旧实现的客户端还应识别历史上的 `-32002`。

URI 是标识，不是“替我抓取任意地址”的授权。
`file://` 可以是服务端的虚拟文件视图，不代表 Host 本地的同名路径；`https://` 资源也可以由客户端直接获取，但仍要遵守目标校验和凭据使用边界。
服务端必须校验 URI 与文件路径，防止通过 `../`、重定向或自定义地址越过访问范围。

Tool 返回的 `resource_link` 也可能提供一个可读取 URI，它不一定出现在 `resources/list` 中。
客户端要结合模板、工具返回的引用和授权理解资源集合，不能把“列表没找到”直接等同于“资源不存在”。

## Prompts：发现的是模板，取回的是消息

客户端先用 `prompts/list` 查看模板名称、描述和参数，再用 `prompts/get` 传入参数，取得消息内容。
例如，用户选择“订单异常分析”，传入 `orderNo`，Server 返回一组要求核实状态、对照政策、说明证据缺口的消息。

下面是 `prompts/get` 的**响应 `result` 部分**：

```json
{
  "resultType": "complete",
  "description": "订单异常分析模板",
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "请分析订单 O202611200001。先取得有时间信息的订单状态，再核对发货政策；按事实、可能原因和建议组织结果，缺少证据时明确说明。"
      }
    }
  ]
}
```

模板帮助组织任务，却不会自动查订单，也不会自动赋予模型工具权限。
协议中的 Prompt 消息角色是 `user` 或 `assistant`；Host 不能因为内容来自 MCP Server，就把它抬升为系统指令。
模板参数和嵌入的资源也都需要校验，用户选择使用某个模板，并不等于信任其中所有文字或允许全部后续操作。

## 列表变长、数据变化后，怎么控制发现与缓存？

三类列表都支持分页：收到 `nextCursor` 就在下一页请求中传回对应 `cursor`，直到没有下一页。
游标是服务端生成的不透明值，客户端不要把它当页码解析，更不能只取第一页就断言“工具没注册”。

在 `2026-07-28` 中，`tools/list`、`prompts/list`、`resources/list`、`resources/templates/list` 和 `resources/read` 的结果都要求包含 `ttlMs` 与 `cacheScope`。
前者给出毫秒级新鲜度提示，后者区分 `public` 和 `private`，控制共享中间层能否缓存；这两个字段不是工具调用结果普遍必填的字段。

工程上，订单私有视图应避免跨用户复用，缓存键与失效策略也要考虑身份、租户和授权变化。
TTL 没过期不代表权限不会撤销；列表缓存有效，也不代表可以省略执行时的授权校验。
工具列表还宜保持稳定顺序，减少无意义的上下文变化。

本版本的变更订阅走 `subscriptions/listen`，不再使用旧教程里的 `resources/subscribe`。
列表变化与资源内容更新是不同通知：前者触发重新发现，后者提示重新读取相关资源。
完整订阅流和新旧兼容边界见[传输与流式响应](./ai-mcp-transports.html)。

Roots、Sampling 等是其他能力，不是三类服务端原语的必选配套。
它们在 `2026-07-28` 已进入弃用窗口，仍存在于规范中；新实现不应再围绕它们扩展，Roots 尤其不能被当成操作系统沙箱。

## 小结

1. Tools 面向调用能力，Resources 面向读取上下文，Prompts 面向选择模板；不能按“是否执行代码”或“是否返回文本”分类。
2. 模型、应用、用户控制描述典型交互方式，不授予业务权限，也不规定必须采用哪种 UI。
3. 工具输入必须声明 Schema，输出可声明 Schema；`structuredContent` 是服务端数据，`isError` 才是工具执行失败的重要信号。
4. Resource URI 不是任意抓取授权，Prompt 不是高优先级指令；三类能力的描述、内容和参数都应按不可信输入处理。
5. 发现要处理分页与授权差异，缓存要尊重新鲜度和范围，执行时仍须重新校验身份与具体资源权限。

## 参考

综合仓库 `docs/` 下 MCP 与 Agent 面试资料重写，按 2026-11-20 读取的官方 `2026-07-28` 原文交叉验证。
重点纠正“Resource 必须是静态文件”“失败都返回 JSON-RPC error”“结构化结果只能是对象”和“Roots 等于沙箱”等容易误解的说法。

- [MCP 2026-07-28：Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP 2026-07-28：Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 2026-07-28：Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP 2026-07-28：变更记录](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP 2026-07-28：弃用功能登记](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)

示例用于解释消息结构和契约边界，未对接真实订单系统，也未声称完成 Host 兼容性运行验证。
