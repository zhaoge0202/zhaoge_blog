---
title: "ConfigMap、Secret 和资源限制怎么配才不出事？"
description: "从配置注入的更新差异到 requests/limits 与 QoS，讲清配置、密钥与资源治理的坑。"
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
  text: "Service 和 Ingress 怎么把流量送进集群？为什么长连接总钉在一台？"
  link: "/tools/kubernetes/kubernetes-service-ingress.html"
next:
  text: "Pod 起不来、被杀、上不了线，按什么顺序查？"
  link: "/tools/kubernetes/kubernetes-troubleshooting.html"
---

# ConfigMap、Secret 和资源限制怎么配才不出事？

> 这三样东西配错的代价都不是"编译不过"，而是线上事故：改了配置没生效、密钥以为加密其实没有、内存超一点进程直接被杀。它们的共同点是——**默认行为看着合理，出问题时又不报错**。

对象选型与调度依据在 [Pod、Deployment、StatefulSet 该用哪个](/tools/kubernetes/kubernetes-core-objects.html) 里讲过，这篇往下走一层：Pod 已经跑起来了，**配置从哪来、密钥算不算被保护、资源该给多少**。三件事放一篇里，是因为它们在 Java 服务上是同一道算术题的三个面：ConfigMap 决定应用读到什么，Secret 决定谁读得到密码，requests/limits 决定 JVM 有多少内存可活。

| 事         | 谁在管                               | 配错的典型现象                                                   |
| ---------- | ------------------------------------ | ---------------------------------------------------------------- |
| 配置注入   | kubelet 把 ConfigMap 塞进容器        | 改了值要重启才行；或反过来，以为要重启结果被原地覆盖了           |
| 密钥存储   | API Server + etcd                    | 以为 Secret 是加密的，结果 `-o yaml` 解个 base64 就到手          |
| 资源与 QoS | 调度器（requests）+ cgroup（limits） | CPU 被节流成延迟毛刺；内存超一点直接 `OOMKilled`，堆 dump 都没有 |

记住这条主线：**requests 决定"能不能被调度上来"和"出事先杀谁"，limits 决定"运行时被 cgroup 怎么卡"**。两者不是一回事，配错的姿势也不同。

## ConfigMap 的两种注入方式，行为完全不同

这是本篇第一个硬点：同样是引用一个 ConfigMap，`env` 系列和 volume 挂载对"改完会不会变"给出两种答案，而很多人只记住了其中一种。

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-config
data:
  LOG_LEVEL: "INFO"
  TZ: "Asia/Shanghai"
  application.yaml: |
    order:
      timeout-ms: 800
---
# 同一个容器上，两种引用方式长这样
spec:
  containers:
    - name: app
      envFrom: # 方式 A：整份 ConfigMap → 环境变量
        - configMapRef: { name: order-config }
      env:
        - name: SPRING_PROFILES_ACTIVE
          valueFrom:
            configMapKeyRef: { name: order-config, key: LOG_LEVEL }
      volumeMounts: # 方式 B：投影成文件
        - name: config
          mountPath: /etc/app
          # subPath: application.yaml   ← 别这么写，见下
  volumes:
    - name: config
      configMap:
        name: order-config
        items: [{ key: application.yaml, path: application.yaml }]
```

**方式 A 的机制**：kubelet 在**创建容器之前**把键值算好，交给运行时写进进程的环境变量。进程起来之后那就是一份内存副本，ConfigMap 后面改成什么都传不进去——**必须重建 Pod 才会读到新值**。两个副作用：环境变量对容器内所有进程可见（`/proc/1/environ`、崩溃 dump 都能带出来），密码类的值就别走 env；带点的键（`application.yaml`）当环境变量时经常被运行时改写或忽略。

**方式 B 的机制**：内容被投影成目录里的文件，ConfigMap 更新后 kubelet 按自己的同步周期核对挂载内容，**分钟级**才生效（同步周期 + API Server 侧缓存/传播延迟，两分钟左右是常见量级，具体以集群 kubelet 配置为准）。两条硬边界：

- **`subPath` 挂载永远不更新**。用 `subPath` 把单个文件钉进容器时，这个挂载点是死的，ConfigMap 改了也不变，这是官方明确的限制。要更新就挂整个目录。
- **文件变了不等于进程读了**。Spring 的 `@ConfigurationProperties`、`@Value` 都不盯文件；`spring.config.import=optional:configtree:...` 也只在启动期读一次。文件更新和配置生效是两件事。

| 注入方式                | 什么时候读到      | 改 ConfigMap 之后                      | 适合放什么                        |
| ----------------------- | ----------------- | -------------------------------------- | --------------------------------- |
| `env` / `envFrom`       | 容器启动前        | 不变，必须重启/重建 Pod                | 启动期就要用的少量标量（profile） |
| volume 挂载（整目录）   | 启动期 + 周期同步 | 文件更新（分钟级），进程要不要重读另说 | 整份配置文件、证书、模板          |
| volume 挂载 + `subPath` | 启动期            | **永远不更新**                         | 只读静态文件，别指望它热更新      |

合起来看，结论很硬：**K8s 的 ConfigMap 是"配置分发"，不是"配置热更新"**。

- 要"改了就生效"，走配置中心那条链路（[Nacos 配置动态刷新为什么有时候不生效](/system-design/spring-cloud/spring-cloud-nacos-config-refresh.html)），ConfigMap 只放启动引导类的东西（Nacos 地址、namespace、初始日志级别）。
- 要"改了配置顺便滚动一次"，得自己做——**改 ConfigMap 不会触发 Deployment 滚动**。常规做法是把配置内容 hash 写进 Pod 模板的 annotation（Helm 的 `checksum/config` 就是这个思路），或显式 `kubectl rollout restart deployment/order-service`。
- 还有两条限制：单个 ConfigMap 有 1MiB 量级上限（受 etcd 请求大小约束），塞整个大 yml 会踩到；确认不再改的可以加 `immutable: true`，省 watch 开销，也防手改。

## 多环境配置：隔离靠 namespace，差异交给 Kustomize/Helm

同一套服务跑 dev / staging / prod，差异无非是地址、副本数、资源量、日志级别、外部依赖凭据。**这些差异一行都不该进镜像**——进了镜像，"同一份镜像在不同环境跑的是不同东西"，排查时连线上跑的是哪个版本都说不清。

| 手段              | 管什么                                     | 边界与代价                                                             |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 按 namespace 隔离 | 同名资源分区、RBAC 授权粒度、ResourceQuota | **逻辑隔离**：网络默认可通（要隔开靠 NetworkPolicy），控制面还是同一个 |
| Kustomize overlay | base + 各环境 patch                        | 差异用 YAML patch 表达，`kustomize build` 能直接看合成结果             |
| Helm values       | 一个 chart + 每环境一份 values             | 灵活，但模板里的 `if` 一多就没人看得懂合成结果                         |

再往上是发布链路：**一份镜像（最好按 digest 固定）从 dev → staging → prod 逐级晋级，配置随环境换，镜像不重建**，这样"prod 上跑的就是 staging 验过的那一份"才是可验证的事实。镜像晋级与回滚怎么串成流水线，见 [CI/CD 流水线怎么设计？制品怎么晋级、怎么回滚？](/engineering/engineering-cicd-pipeline.html)，这里只强调：**镜像不可变，配置可变**，两件事混在一起，回滚就变成猜谜。

## Secret：本质只是 base64，不是加密

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credential
type: Opaque
data:
  password: cEBzc3cwcmQ= # base64，仅此而已；stringData 可直接写明文
```

`base64` 是编码不是加密，`echo cEBzc3cwcmQ= | base64 -d` 一行还原。它的真实价值是**把"谁能读"收敛成权限问题**（RBAC），以及让明文不出现在清单、日志和备份里，而不是"内容看不见"。

| 泄露路径                                        | 为什么可行                                                     |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `kubectl get secret -o yaml` / `-o jsonpath`    | 有 `get secret` 权限就能取到 base64，解一下就是明文            |
| 能 `exec` 进 Pod，或能在同 namespace 里创建 Pod | 把 Secret 挂进去再读出来，等于间接读到（K8s 默认不拦这个）     |
| 应用把环境变量/启动参数整个打进日志             | `System.getenv()` 全量 dump、启动 banner、配置回显都能带出密码 |
| etcd 备份、快照、控制面主机                     | 没开静态加密时 etcd 里就是 base64；备份流出一次就够            |
| 进了 Git                                        | 提交历史删不掉，只能按"已泄露"处理并轮换                       |

顺手纠一个常见说法：**`kubectl describe secret` 不会打出明文**，它只显示 key 名和字节数。真正一行到手的路径是 `-o yaml` 加 `base64 -d`——把力气花在"禁 describe"上没用，得管权限和日志。

对应的四层保护，缺一层就等于没有：

1. **etcd 静态加密**：`EncryptionConfiguration` 配 `aescbc` / `secretbox` / `kms` 提供者（默认 `identity`，也就是不加密）。它护的是磁盘上的 etcd 数据，挡备份泄露和磁盘镜像，挡不住拿到 API Server 权限的人。
2. **RBAC 收紧**：`get/list/watch secret` 等价于"知道所有密码"，只给真正需要的组件（外部密钥控制器、备份任务）。别给开发一个 `edit` 了事——`edit` 在命名空间内基本等于能读 Secret。
3. **外部密钥管理**：Vault、External Secrets Operator、云 KMS/Secrets Manager，让完整密钥不落在 etcd 里，同时获得轮换、审计、吊销。
4. **不进 Git + 能轮换**：清单只引用外部密钥，且必须答得出"这个密码怎么在 10 分钟内换掉"。

还有一个容易忽略的推理：**能读 Pod、能 exec、或能在同 namespace 创建 Pod 的人，基本等价于能读它引用的 Secret**。所以 Secret 的权限要和 Pod/exec 的权限一起收紧，单给 Secret 加一条 `get` 限制不解决问题。

## 资源模型：requests 是承诺，limits 是闸门

| 字段              | 谁在用                         | 语义                                                          |
| ----------------- | ------------------------------ | ------------------------------------------------------------- |
| `requests.cpu`    | 调度器、HPA、QoS、`cpu.shares` | "我至少要这么多"，节点按它分账；HPA 的利用率百分比以它为分母  |
| `requests.memory` | 调度器、QoS、驱逐排序          | 同上，但内存是**不可压缩**资源，超了只能杀进程                |
| `limits.cpu`      | cgroup `cpu.cfs_quota`         | 硬上限，按 100ms 周期发配额，用完等下一周期 → **节流**        |
| `limits.memory`   | cgroup `memory.max`            | 硬上限，超了触发内核 OOM killer → **`OOMKilled`（exit 137）** |

一句话区分：**CPU 是压缩型资源，超了只是变慢；内存是不可压缩资源，超了就是死**。所以对 CPU 的担心是"延迟毛刺"，对内存的担心是"进程没了"。

**CPU 超 limit 表现为节流，不是被杀**。`limits.cpu: 500m` 会翻译成 `cpu.cfs_quota_us=50000`、`cpu.cfs_period_us=100000`：每 100ms 最多用 50ms。Java 启动时几十个线程一起抢，配额几毫秒就见底，剩下时间只能等下个周期——于是**启动慢、GC 停顿被拉长、P99 出现规律性毛刺**，而进程一直活着。这地方最阴：它不报错，CPU 使用率还"很健康"（永远贴着 limit），只有延迟曲线在抖。确认要看 cgroup 的 `cpu.stat` 里 `nr_throttled` / `throttled_time`，或 `container_cpu_cfs_throttled_periods_total` 这类指标。

**内存超 limit 是 `OOMKilled`，不是 Java 的 OOM 异常**。内核 OOM killer 直接 `SIGKILL`，状态变 `OOMKilled`，退出码 137（128 + 9）。此时：不会有 `java.lang.OutOfMemoryError` 异常栈（那是 JVM 自己抛的，得堆先满到 `-Xmx`）；不会有堆 dump（`-XX:+HeapDumpOnOutOfMemoryError` 只在 JVM 抛 OOM 时触发，被内核杀掉没有任何机会写文件）。能拿到的只有 `Last State: Terminated, Reason: OOMKilled`、节点 `dmesg` 和 RSS 曲线。两类 OOM 的分辨与取证顺序见 [OOM 怎么排查](/java/jvm/jvm-oom-troubleshooting.html)。

## Java 在容器里的经典错配：`-Xmx` 和 limit 打架

最常见的事故：镜像里写死 `-Xmx2g`，Deployment 的 `limits.memory` 是 `1Gi`。启动没问题，压测几分钟开始周期性重启，`kubectl describe` 显示 `OOMKilled`，日志干干净净，dump 目录是空的。原因就是那笔账没算——**limit 是给整个进程（RSS）设的，堆只是其中一块**。

正确姿势是让 JVM 按 limit 自己算堆：

```yaml
env:
  - name: JAVA_TOOL_OPTIONS
    value: >-
      -XX:MaxRAMPercentage=65 -XX:InitialRAMPercentage=65
      -XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError
resources:
  limits: { memory: 4Gi, cpu: "2" }
  requests: { memory: 4Gi, cpu: "2" }
```

- **别写死 `-Xmx`**，用 `-XX:MaxRAMPercentage`（或 `-XX:MaxRAM=`）跟 limit 联动；`InitialRAMPercentage` 建议与它一致，否则堆一路扩容，前几分钟 GC 曲线没法看。
- 容器感知不是永远默认开着：JDK 10+ 默认开启，8u191+ 已带上，更早的 8u131~8u190 要 `-XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap`。别背结论，在镜像里跑 `java -XX:+PrintFlagsFinal -version | grep -i -E "MaxRAMPercentage|UseContainerSupport"` 验一遍。参数体系见 [JVM 参数怎么调](/java/jvm/jvm-parameters-tuning.html)。
- **`MaxRAMPercentage` 别给到 90 以上**：堆外那部分不是小数，尤其有 Netty 直接内存、大量线程池、动态生成类的服务。

以 `limits.memory: 4Gi`、堆占约 62% 为例，这笔账大致是：

| 组成               | 估算值          | 说明                                                   |
| ------------------ | --------------- | ------------------------------------------------------ |
| Java 堆            | 2.5GiB          | `-XX:MaxRAMPercentage=62` 左右，主战场                 |
| Metaspace          | 256MiB          | 类数量、动态代理、脚本引擎会推高                       |
| 直接内存           | 256MiB          | Netty / NIO / 堆外缓存，`-XX:MaxDirectMemorySize` 兜底 |
| 线程栈             | 200 线程 × 1MiB | 线程数 × `-Xss`，线程池一多就不是小数                  |
| Code Cache         | 128~240MiB      | JIT 产物，`-XX:ReservedCodeCacheSize` 可控             |
| JVM native / glibc | 150~300MiB      | GC 数据结构、JNI、malloc arena，最容易漏算             |
| 安全余量           | 200~300MiB      | 探针、临时大对象、内核记账                             |

加起来约 3.9GiB，刚好压在 4Gi 以内。这张表不用精确到 MB，但**必须把非堆算进去**——按"堆 = limit"去配，一定会被 kill。

## CPU limit 的隐性代价：到底要不要设

除了节流，还有一个更隐蔽的联动：**JVM 按 limits 推断可用核数**。设了 `limits.cpu: "2"`，JVM 看到的 `ActiveProcessorCount` 就是 2，于是 GC 线程数、`ForkJoinPool.commonPool` 并行度、`Runtime.availableProcessors()` 派生的线程池默认值全按 2 核算。**你改的是资源限制，动的却是 JVM 内部的并行度。**

| 立场                          | 做法                                                      | 好处                             | 代价                                                                                                |
| ----------------------------- | --------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| 不设 CPU limit                | 只给 `requests.cpu`，Pod 可借用节点空闲 CPU               | 无 CFS 节流，突发和启动期跑得开  | 吵闹邻居；且 JVM 会按**节点核数**推断，64 核节点上 GC 线程开得离谱，得配 `-XX:ActiveProcessorCount` |
| 设 limit（`limits=requests`） | 追求可预测、可进 Guaranteed QoS                           | 行为确定，便于容量规划与成本核算 | 严格节流：启动、Full GC、批量任务都会被 quota 卡出毛刺                                              |
| 折中                          | limit 给到 requests 的 1.5~2 倍，延迟敏感服务放独立节点池 | 兼顾突发与可预测                 | 需要更细的容量管理与节点规划                                                                        |

怎么选看延迟敏感度：离线批处理、后台任务适合严格 limit；在线 API 尤其启动期吃 CPU 的 JVM 服务，宁可放宽 limit 或用节点池隔离，也别让它每 100ms 撞一次墙。无论选哪派，**显式声明 `-XX:ActiveProcessorCount`**（JDK 10+ 的开关，8u 看是否回移）都能少一类玄学问题。

## QoS 三类与驱逐顺序

节点内存紧张时 kubelet 要挑 Pod 驱逐（eviction），挑谁按 QoS 等级来：

| QoS 等级     | 判定条件（每个容器都要满足）                                           | 内存紧张时的位置                 |
| ------------ | ---------------------------------------------------------------------- | -------------------------------- |
| `Guaranteed` | 每个容器都设了 requests 和 limits，且 **CPU、内存的 request == limit** | 最后被杀                         |
| `Burstable`  | 至少一个容器设了 request 或 limit，但不满足 Guaranteed                 | 中间；超出 requests 越多越先被杀 |
| `BestEffort` | 所有容器都没设 requests / limits                                       | 最先被杀                         |

三条实践结论：① 想进 Guaranteed 就得 `requests == limits`，**包括 CPU**（只有内存相等不算），代价是失去突发能力，适合资源需求稳定的组件；② 什么都没配的 Pod 是 BestEffort，排第一顺位，而且调度器按 0 需求算账，会把它塞到已经很满的节点上——这类 Pod 平时看不出问题，节点一紧张就成批消失；③ **Guaranteed 不等于免疫**，系统组件吃满内存或驱逐不及时引出内核 OOM killer 时它一样会死，只是排队排在最后。

还要注意：驱逐看节点层面信号（`memory.available`、`nodefs.available`），跟单个 Pod 的 limit 不完全对应——**Pod 自己没超 limit，也可能因为节点整体紧张被驱逐**。

## LimitRange 与 ResourceQuota：给团队装护栏

上面那些"该怎么配"，靠人自觉守不住，命名空间层面要装两道护栏：

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-order
spec:
  limits:
    - type: Container
      default: { cpu: "1", memory: 2Gi } # 没写 limits 时的默认值
      defaultRequest: { cpu: 200m, memory: 512Mi }
      max: { cpu: "4", memory: 8Gi } # 单容器不许超过
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-order-quota
  namespace: team-order
spec:
  hard:
    requests.cpu: "32"
    requests.memory: 64Gi
    limits.memory: 96Gi
```

`LimitRange` 兜住"忘了写 resources"的人，顺带防止谁申请 64 核；`ResourceQuota` 限制整个命名空间的总量，防止一个团队把集群吃满。配额怎么算直接决定能开几个副本：**CPU/内存配额按 requests 累计**（`limits.*` 是另一组独立统计）。所以 `requests.memory: 64Gi` 的命名空间，单副本 `requests.memory: 2Gi` 就只能跑 32 个副本——这个数要在压测前算出来，而不是等扩容时才发现"节点还有空余，但 quota 满了，Pod 一直 Pending"。

## 配置与密钥治理清单

1. **配置按环境分层**：与环境无关的默认值进镜像/base；环境差异走 ConfigMap + Kustomize/Helm；要热更新的开关走配置中心，别指望 ConfigMap。
2. **敏感项只走 Secret 或外部密钥**：不进 Git、不进镜像、不进日志；能轮换的才叫可控。
3. **配置变更要审计**：谁改的、改了什么、何时生效——GitOps 里改配置就是一次提交，天然留痕；手改 `kubectl edit` 的事后没人解释得清。
4. **JVM 参数与资源配比写进交付文档**：`limits.memory` 和 `MaxRAMPercentage` 是一对，改一个必须复核另一个；这对参数要和"怎么启动、怎么扩容、怎么回滚"一起交给运维，见 [交付文档到底要交哪些？](/engineering/engineering-delivery-docs.html)。
5. **上线前用 quota 反算容量**：单副本 requests × 最大副本数 ≤ quota，且节点池装得下，两个条件同时满足才算过。

## 容易踩的坑

- **把整个 `application.yml` 塞进一个 ConfigMap**。一个超时参数从 800 改到 1000 也得滚动重启，更糟的是没人敢改——说不清这份文件里还有什么。
- **指望 `subPath` 热更新**。官方明确限制：`subPath` 的挂载点收不到更新。典型现象是别的 Pod 文件变了，这个 Pod 里万年不变。
- **以为 Secret 是加密的**。base64 复制出来 `-d` 一下就完事；真正起作用的是 etcd 静态加密、RBAC 收紧和外部密钥管理。
- **把 Secret 打进日志**。启动时打印全部环境变量"方便排查"，等于把密码写进日志系统——日志的访问面比 Secret 宽得多。
- **limit 比 requests 大很多就以为不会 OOM**。内存 limit 是硬上限，超了照样杀；requests 只影响调度和"出事先杀谁"，救不了越界的 RSS。
- **不配 requests，被塞到快满的节点**。调度器按 0 算需求，账面不占地方，于是排到没余量的节点；节点一紧张它又是 BestEffort，第一个被驱逐（状态与事件怎么读，见 [Pod 起不来、被杀怎么查](/tools/kubernetes/kubernetes-troubleshooting.html)）。
- **时区、编码靠进容器手改**。基础镜像默认 UTC，`date` 差 8 小时、导出文件名乱码；正确做法是把 `TZ=Asia/Shanghai`、`-Dfile.encoding=UTF-8` 写进 ConfigMap 或镜像默认值，而不是 `kubectl exec` 里 `export` 一下——那只在当次会话有效。

## 小结

1. ConfigMap 两种注入方式行为不同：`env`/`envFrom` 只在容器启动时注入一次，改了必须重启；volume 挂载由 kubelet 周期同步、分钟级生效，但 **`subPath` 永远不更新**。改 ConfigMap 也不会自动触发滚动，要 `rollout restart` 或用配置 hash 做模板注解。
2. ConfigMap 是配置分发而非配置中心：要热更新走配置中心（Nacos）；镜像不可变、配置随环境换，一份镜像按 digest 逐环境晋级。
3. Secret 只是 base64。真正的保护是 etcd 静态加密 + RBAC 收紧 `get secret` + 外部密钥管理（Vault/ESO/KMS），外加不进 Git、能轮换；能 exec 进 Pod 或能建 Pod 的人基本等价于能读 Secret。
4. `requests` 定调度、HPA 基数和 QoS，`limits` 定 cgroup 上限：CPU 超 limit 是**节流**（延迟毛刺、GC 变慢），内存超 limit 是 **OOMKilled（exit 137）**，拿不到异常栈也拿不到堆 dump。
5. Java 按"limit = 堆 + 元空间 + 直接内存 + 线程栈 + CodeCache + 余量"配，堆用 `-XX:MaxRAMPercentage`（约 60~70%）而不是写死 `-Xmx`；要进 Guaranteed 必须 `requests == limits`，否则节点内存压力下按 BestEffort → Burstable → Guaranteed 依次被驱逐。

## 参考

综合 Kubernetes 官方文档（ConfigMap、Secret、Managing Resources for Containers、Pod QoS Classes、Limit Ranges、Resource Quotas、Encryption at Rest、kubelet 驱逐章节）、JDK 容器支持相关文档（`UseContainerSupport`、`MaxRAMPercentage`、`ActiveProcessorCount`），以及站内 [Nacos 配置动态刷新为什么有时候不生效](/system-design/spring-cloud/spring-cloud-nacos-config-refresh.html)、[JVM 参数怎么调](/java/jvm/jvm-parameters-tuning.html)、[OOM 怎么排查](/java/jvm/jvm-oom-troubleshooting.html) 的既有口径，交叉验证后重写。几处特意核对、也容易讲错的地方：

- **Volume 挂载的更新延迟**：官方说法是"kubelet 同步周期 + 缓存传播延迟"，量级在分钟；具体取决于 kubelet 配置与 API Server 缓存策略，别把"两分钟"当保证值写进 SLA。
- **`kubectl describe secret` 不打明文**：它只列 key 名和字节数，一行还原靠的是 `-o yaml` 加 `base64 -d`。
- **容器内存感知有版本差异**：`UseContainerSupport` 在 JDK 10+ 默认开启、8u191+ 已回移，更早版本要用实验性参数；`MaxRAMPercentage` 的可用性也随版本变化，以镜像内 `PrintFlagsFinal` 实际输出为准。

- [Kubernetes: ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes: Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Kubernetes: Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Kubernetes: Pod Quality of Service Classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/)
