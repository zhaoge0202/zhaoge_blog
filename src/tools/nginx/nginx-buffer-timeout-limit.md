---
title: "Nginx 缓冲、gzip 和限流怎么配？哪些默认值会把流式和大文件坑死？"
description: "从 proxy_buffering、gzip 到 limit_req 的真实语义，讲清反向代理侧的性能与保护配置。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "排障"
  - "项目实战"
  - "细节题"
prev:
  text: "Nginx 反向代理和 upstream 怎么配？为什么后端说超时了它还在等？"
  link: "/tools/nginx/nginx-reverse-proxy-upstream.html"
next:
  text: "Tomcat"
  link: "/tools/tomcat/"
---

# Nginx 缓冲、gzip 和限流怎么配？哪些默认值会把流式和大文件坑死？

> 反向代理的性能问题，八成不是「Nginx 慢」，而是它按默认值替你做了一些你没让它做的「攒」和「等」。

上一篇 [Nginx 反向代理和 upstream 怎么配](/tools/nginx/nginx-reverse-proxy-upstream.html) 把转发链路和 upstream 讲完，这篇看同一个进程的另一面：**它默认替你做的那几件事**——攒响应、压响应、卡请求体、限速率。哪些是保护、哪些是坑，取决于这条 location 上跑的是什么流量；流式被攒住的六层排障顺序在 [大模型流式输出怎么落到后端](/ai/ai-streaming-sse-backend.html) 里已经摊开，本篇只补 Nginx 这一层的机制与配置。

## 先记住三个默认值：缓冲、压缩、请求体上限

| 配置                   | 实际默认值        | 影响面                          | 什么时候必须动                |
| ---------------------- | ----------------- | ------------------------------- | ----------------------------- |
| `proxy_buffering`      | `on`              | 上游响应先进内存/临时文件再发   | 流式输出、边收边转            |
| `gzip`                 | `off`（编译默认） | 现场多数发行版配置/镜像替你开了 | 压 SSE、压已压缩格式、漏 JSON |
| `client_max_body_size` | `1m`              | 超了直接 413，请求到不了后端    | 上传、批量导入、图片          |

`gzip` 这格要纠正一句：**Nginx 自己的默认是 `off` 不是 `on`**。觉得「默认开着」，是因为发行版软件包、面板、容器基础镜像的 `nginx.conf` 早就写了 `gzip on;`。排查前先跑 `nginx -T | grep -nE 'gzip|proxy_buffering|client_max_body_size'` 看实际生效值。

## 响应缓冲：先收上游的，再发客户端

`proxy_buffering on` 一句话：**Nginx 先把上游响应读进自己的缓冲区（内存不够就落临时文件），再按客户端的消费速度发出去**。上游连接因此早早释放，慢客户端拖住的是 Nginx，不是 Tomcat。

| 指令                       | 默认值          | 管什么                                                                                              |
| -------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| `proxy_buffer_size`        | `4k` / `8k`     | 只放**响应头**；太小会报 `upstream sent too big header`（几 KB 的 Cookie / JWT 就够呛），调到 `16k` |
| `proxy_buffers`            | `8 4k` / `8 8k` | 响应体缓冲：数量 × 单块大小                                                                         |
| `proxy_busy_buffers_size`  | `8k` / `16k`    | 正在发给客户端的那部分上限                                                                          |
| `proxy_max_temp_file_size` | `1024m`         | 能落多少临时文件，`0` = 不落盘                                                                      |

| 对比项   | 缓冲开（默认）               | 缓冲关           |
| -------- | ---------------------------- | ---------------- |
| 后端连接 | 上游写完即释放，慢客户端无感 | 被客户端网速拖住 |
| 磁盘 IO  | 大响应落临时文件，读写两遍   | 不落盘           |
| 首字节   | 攒够才发，TTFT 变差          | 收到就发         |

**大文件下载的坑在临时文件**：500MB 的响应只有几十 KB 待在内存，其余全落 `proxy_temp_path`，一个下载被读写两遍。要么不落盘，要么这条 location 直接关缓冲：

```nginx
location /download/ {
    proxy_pass http://files;
    proxy_max_temp_file_size 0;   # 内存满了就停读上游，用背压代替写盘
}
```

## 流式被攒住：`proxy_buffering off` 只是第一半

现象：等三五秒然后「刷」一下整段出来，后端日志证明分片是实时写的，`curl -N` 直连后端也正常。这时就是这一层在攒。

```nginx
location /api/chat/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_buffering off;        # 不攒响应体
    proxy_cache off;            # 别缓存事件流
    gzip off;                   # 别在压缩器里再攒一层
    proxy_read_timeout 300s;    # 必须大于最长静默时间，默认 60s
}
```

**第二半是响应头 `X-Accel-Buffering: no`**：由上游在响应里写一句 `response.setHeader("X-Accel-Buffering", "no")`，Nginx 读到就关掉这条响应的缓冲——普通 JSON 照样攒，只有流式接口不攒。

`proxy_buffering off` 是**路径级**的，一个 `/api/` 下去所有接口都丢掉「慢客户端不占后端」的保护；响应头是**请求级**的，粒度更细。代价是代码里要记得写，且它会被 `proxy_ignore_headers X-Accel-Buffering;` 关掉——排查「明明关了还在攒」先搜这句。顺带纠正：在 Nginx 里 `add_header X-Accel-Buffering no;` 对自己**无效**，它只加给下游（比如 CDN），Nginx 只认上游发来的这个头。

## gzip：默认只压 `text/html`，SSE 要显式关

| 指令              | 默认值      | 说明                                    |
| ----------------- | ----------- | --------------------------------------- |
| `gzip`            | `off`       | 打开后也只压 `text/html`                |
| `gzip_types`      | `text/html` | **JSON / JS / CSS / XML 都要自己加**    |
| `gzip_min_length` | `20` 字节   | 太小的不压，压完反而更大                |
| `gzip_comp_level` | `1`         | 1 已拿到大部分收益，9 是拿 CPU 换几个点 |
| `gzip_vary`       | `off`       | 有 CDN / 多级缓存时**必须开**           |
| `gzip_proxied`    | `off`       | 请求带 `Via` 就不压，CDN 回源会被漏掉   |

```nginx
gzip on;
gzip_comp_level 5;
gzip_vary on;
gzip_proxied any;
gzip_types text/css text/plain application/json application/javascript image/svg+xml;
```

- **已压缩的格式别压**：JPEG / PNG / MP4 / ZIP / APK 再压 CPU 白烧、体积几乎不变，`gzip_types` 是白名单，别写 `*`。
- **`gzip_vary on` 是缓存正确性问题**：同一个 URL 对不同 `Accept-Encoding` 返回不同字节，中间缓存不区分就串味，缓存口径见 [CDN 怎么用](/high-performance/high-performance-cdn.html)。
- **`proxy_set_header Accept-Encoding "";` 决定谁来压**：默认透传，上游压过了 Nginx 就不重复压；清空则统一由 Nginx 压，压缩比和 CPU 归属可控，回源流量变大。

**SSE 的 location 一律写 `gzip off;`**：压缩器要有足够数据才有压缩率，天生倾向攒；而 SSE 的增量是高熵短文本，压不出多少。有个容易被说反的细节——默认 `gzip_types` 只有 `text/html`，**`text/event-stream` 不在里面**，默认根本不压，踩法是有人加了 `text/plain`、`*` 或 `text/event-stream`，或者 CDN 那层替你压了。所以那句 `gzip off;` 的定位是「防后人加类型」，不是「关掉默认行为」。

## 客户端限制：413 到底是谁挡的

| 指令                      | 默认值       | 说明                                      |
| ------------------------- | ------------ | ----------------------------------------- |
| `client_max_body_size`    | `1m`         | 超了直接 **413**，后端收不到              |
| `client_body_buffer_size` | `8k` / `16k` | 超过就写 `client_body_temp_path` 临时文件 |
| `client_body_timeout`     | `60s`        | **两次读操作之间**超时，不是上传总时长    |
| `client_header_timeout`   | `60s`        | 同上，读请求头                            |

```text
请求体字节数
  ├─▶ Nginx client_max_body_size（1m）──超了→ 413，后端无感
  ├─▶ Spring Multipart（max-file-size=1MB / max-request-size=10MB）→ 500，除非显式处理
  └─▶ Tomcat max-http-form-post-size（2MB，仅表单类）→ 参数不解析 / 400，不是 413
```

- 带 `Content-Length` 的请求读完头部就判断；**chunked 上传没有长度**，Nginx 边收边数，到线就断。413 常是「静默断」，error log 关键词是 `client intended to send too large body`；头或 Cookie 太大则是 `large_client_header_buffers`（默认 `4 8k`）→ `400` / `414`。
- 只放大 Nginx 不调 Spring / Tomcat，错误就从 413 变成 500 或「参数为空」，排查方向完全不同；容器侧见 [Tomcat 的连接器和线程模型](/tools/tomcat/tomcat-connector-thread-model.html)。
- 大文件上传再配 `proxy_request_buffering off;`：默认 Nginx 先把整个请求体收完再转上游，等于在 Nginx 上多落一次盘。

## 限流：`limit_req` 的真实语义是「漏桶 + 队列」

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        limit_req_log_level warn;
    }
}
```

`zone=api:10m` 是共享内存，**10m 大约放得下 16 万个 IPv4 来源**的计数（不够会报 `could not allocate node`）；`rate=10r/s` 是这个 key 的**持续速率**，内部按毫秒排队，相当于每 100ms 放一个；`burst=20` 是允许存下的**桶容量**；`nodelay` 让桶内请求**立即放行**，不按 `rate` 匀速排队。合起来：

| 场景                   | 结果                                                           |
| ---------------------- | -------------------------------------------------------------- |
| 同一 IP 瞬间 15 个请求 | 全部立即放行（15 < burst），用户完全无感                       |
| 一瞬间 200 个          | 约 burst 个（20 上下）立即通过，其余 429，之后按 10r/s 恢复    |
| 之后持续请求           | 约每 100ms 放一个，超出的继续 429                              |
| 去掉 `nodelay`         | 同样是这 burst 个「通过」，但除第一个外都被延迟成每 100ms 一个 |

**`nodelay` 不是「不限速」**，决定长期速率的永远是 `rate`；它只把桶内请求从「排队」改成「立即」。去掉它的风险是被延迟的请求仍占着连接，客户端超时短就直接报超时，现场像「偶发慢」。配套三件：`limit_req_status 429`（默认 503，不改分不清限流和服务挂了）、`limit_req_log_level warn`（默认 `error`，限流是正常工作不是故障）、`limit_conn`（限**并发连接数**，慢接口靠它挡、短请求靠速率挡，状态码默认也是 503）。

### key 选错，限到的是代理

`$binary_remote_addr` 是 `$remote_addr` 的二进制形式，取的是**直连 Nginx 的那一端**。前面挂了 SLB / CDN / Ingress，它就是代理 IP，全站共用一个 key，等于把所有人绑在一起限。

```nginx
set_real_ip_from 10.0.0.0/8;
set_real_ip_from 172.16.0.0/12;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

直接拿 `$http_x_forwarded_for` 当 key 有三个问题：**可被客户端伪造**、**多级代理时是一串** `client, proxy1, proxy2`（同一个人在不同链路算出不同 key）、**头为空时 key 为空**，可能压根不计入，限流形同虚设。分层上 Nginx 只做入口粗粒度防刷（单 IP 的速率与并发），租户和用户级配额在网关或应用侧；算法取舍见 [限流算法怎么选](/high-availability/high-availability-rate-limiting.html)，而且它每台机器各算各的，5 台就是 5 倍额度。

## 缓存：并发回源、旧值兜底、别缓存鉴权响应

```nginx
proxy_cache_path /data/nginx/cache levels=1:2 keys_zone=api_cache:100m max_size=10g inactive=60m use_temp_path=off;
location /api/public/ {
    proxy_cache api_cache;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    proxy_cache_valid 200 302 5m;
    proxy_cache_lock on;                    # 并发回源只放一个
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_no_cache $http_authorization $cookie_session;
    add_header X-Cache-Status $upstream_cache_status;
}
```

| 指令                    | 默认  | 要点                                                                                       |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------ |
| `proxy_cache_valid`     | 未设  | **不配就只看上游的 `Expires` / `Cache-Control` / `X-Accel-Expires`**，配了才按状态码强缓存 |
| `proxy_cache_lock`      | `off` | 同一个 key 未命中只放一个回源，其余等（默认 5s），挡住缓存击穿                             |
| `proxy_cache_use_stale` | 见上  | 回源失败或超时给**旧值**，是可用性手段；`updating` 配合后台更新，用户不等回源              |
| `proxy_no_cache`        | 未设  | 按条件**不写缓存**，如带 `Authorization` / Cookie 的响应                                   |

**缓存鉴权响应是数据泄漏事故**，但默认行为要说清：Nginx **默认不缓存带 `Set-Cookie` 的响应**，也尊重 `Cache-Control: private / no-store`。出事的三种：抄来的配置里有 `proxy_ignore_headers Set-Cookie Cache-Control;` 把保护关了；接口靠 Cookie 区分用户却不回 `Set-Cookie`，缓存键里又没 Cookie；带 `Authorization` 的接口被缓存却漏了 `proxy_no_cache`。上线前只查一句：**HIT 的响应里有没有用户私有数据**。

## 静态资源：静态给 Nginx，动态才转发

```nginx
sendfile on;          # 零拷贝，内核直接把文件送到 socket
tcp_nopush on;        # 配合 sendfile，响应头和文件开头一起发
location /assets/ {
    expires 1y;                            # 文件名带 hash，放心长缓存
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}
location /   { try_files $uri $uri/ /index.html; }   # SPA 路由回退
location /api/ { proxy_pass http://backend; }
```

分工一句话：**静态走本地文件（零拷贝 + `expires` 让浏览器干脆不再请求），动态才 `proxy_pass`**。带 hash 的资源给长缓存，`index.html` 一律 `no-cache`，否则用户永远拿不到新版本；`try_files` 末尾的 `=404` 别省。更外层的静态分发见 [CDN 怎么用](/high-performance/high-performance-cdn.html)。

## 灰度：`split_clients` 和 `map` 是最轻的分流

```nginx
split_clients "${remote_addr}${http_user_agent}" $pool {   # 按哈希固定分流
    5%  canary;
    *   prod;
}
map $cookie_gray $pool_by_cookie {    # 按 cookie / header 精确分流
    default prod;
    "1"     canary;
}
upstream prod   { server 10.0.0.11:8080; }
upstream canary { server 10.0.0.21:8080; }
location /api/ { proxy_pass http://$pool_by_cookie; }   # 变量可指向 upstream 组名
```

`split_clients` 按 key 的哈希切分百分比，**同一 key 永远落同一组**（不是每次随机），所以用户体验一致；`map` 更精确，但要有人负责种 cookie、灰度完再摘掉。这是发布策略里最轻的一档，完整取舍见 [滚动、蓝绿、金丝雀怎么选](/engineering/engineering-container-release.html)。注意 `proxy_pass` 用变量后，值是域名还得配 `resolver`，所以这里用 upstream 组名。

## 日志三件套：到底谁慢

```nginx
log_format timed '$status rt=$request_time urt=$upstream_response_time up=$upstream_addr';
access_log /var/log/nginx/access.log timed;
```

| 字段                      | 含义                                                           | 怎么用               |
| ------------------------- | -------------------------------------------------------------- | -------------------- |
| `$request_time`           | 从读到客户端首字节到发完最后一个字节，含排队、缓冲、等慢客户端 | Nginx 视角的用户耗时 |
| `$upstream_response_time` | 从连上游到收完上游响应的最后一个字节                           | 后端真实耗时         |
| `$upstream_addr`          | 实际处理请求的上游地址，**重试过就是逗号分隔的一串**           | 数量 = 重试次数      |

`rt ≈ urt` → 后端慢；`rt` 远大于 `urt` → 时间花在等客户端或攒缓冲上，回去调 `proxy_buffering`；`up` 里有多个地址 → 这个请求被重试过，别按「一次调用」算它的耗时。

## 容易踩的坑

- **开了 gzip 又上 SSE**。把 `text/event-stream` 或 `*` 加进 `gzip_types`，压缩器一攒，TTFT 直接回到同步接口的水平；SSE 的 location 里写死 `gzip off;`。
- **`limit_req` 的 `burst` 留 0 或配太小**。`burst` 默认 0，等于每个 key 只能严格按 `rate` 走，页面一次并发加载十几个静态请求就被 429，看着像 Nginx 抽风。按「一屏请求数 × 峰值页数」给。
- **把 `X-Forwarded-For` 当客户端 IP 用又不校验**。既能被伪造（绕过限流、刷脏日志），也会在多级代理下把所有人限成一个 key；用 `set_real_ip_from` + `real_ip_header`，否则别拿它当 key。
- **缓存把登录后的响应缓存给所有人**。默认不缓存带 `Set-Cookie` 的响应，但一句 `proxy_ignore_headers Set-Cookie` 或「按 Cookie 出内容却不回 Set-Cookie」就击穿它；配 `proxy_no_cache` 并盯 `$upstream_cache_status`。
- **只在 location 关了 `proxy_buffering`，上游那层还在攒**。Servlet 容器、网关、CDN 各有各的缓冲，判断依据始终是「直连后端正常、加上 Nginx 变批量」，别一层层瞎改。
- **`proxy_read_timeout` 吃默认 60s**。SSE 或长轮询静默超过 60 秒就被切，现象是「每次都整整齐齐断在第 60 秒」，很像模型或业务挂了。

## 小结

1. 三个默认值先记牢：`proxy_buffering on`（攒响应）、`client_max_body_size 1m`（413 元凶）、`gzip` 编译默认 `off` 而发行版常替你打开——排查前先 `nginx -T` 看实际生效值。
2. 缓冲是「保护后端」和「流式体验」的取舍：普通接口留着，SSE 与流式下载关掉；关要关两层——`proxy_buffering off;` 加上游响应头 `X-Accel-Buffering: no`，大文件再配 `proxy_max_temp_file_size 0;` 免落盘。
3. `gzip_types` 默认只有 `text/html`，JSON 必须显式加、已压缩格式不要加、`gzip_vary on` 是缓存正确性问题、SSE 的 location 显式 `gzip off;`。
4. `rate` 管长期速率、`burst` 是允许突发的桶、`nodelay` 让桶内立即放行而非匀速排队；key 用 `$binary_remote_addr` 并配 `set_real_ip_from` 还原真实 IP，Nginx 只做入口粗粒度防刷，业务配额在网关或应用。
5. 判断谁慢只看三个字段：`$request_time`（含缓冲和等慢客户端）、`$upstream_response_time`（后端）、`$upstream_addr`（重试痕迹）；`rt` 远大于 `urt` 就是 Nginx 侧在等或在攒。

## 参考

- 指令默认值与语义以 Nginx 官方文档的 `ngx_http_proxy_module`（buffering 与 cache 部分）、`ngx_http_gzip_module`、`ngx_http_limit_req_module`、`ngx_http_limit_conn_module`、`ngx_http_realip_module`、`ngx_http_core_module` 为准，按 1.20 之后的稳定语义整理；`4k` / `8k` 这类默认值跟随系统页大小，不同平台看到的值可能不同，以 `nginx -T` 为准。
- 与站内 [大模型流式输出怎么落到后端](/ai/ai-streaming-sse-backend.html) 交叉验证：SSE 的六层缓冲和逐层加代理的排障顺序在那篇，本文只补 Nginx 侧的配置与机制，不重复它的排障步骤；限流分层与算法口径同 [限流算法怎么选](/high-availability/high-availability-rate-limiting.html)，静态资源的缓存边界与 [CDN 怎么用](/high-performance/high-performance-cdn.html) 一致。
- 主动纠偏三处：① `gzip` 的编译默认是 `off` 而非 `on`，「默认开着」是发行版配置造成的错觉；② `add_header X-Accel-Buffering no;` 对 Nginx 自己不生效，它只影响下游，Nginx 只认上游发来的这个头；③ 「gzip 会压 SSE」要加限定——默认 `gzip_types` 不含 `text/event-stream`，常见踩法是手动加了类型或 CDN 层代压，但结论不变：SSE 的 location 仍应显式关闭。
