---
title: "Gradle 构建慢怎么优化？"
description: "从配置缓存、并行与依赖下载讲清构建加速手段。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "高频"
  - "项目实战"
  - "进阶"
prev:
  text: "Gradle"
  link: "/tools/gradle/"
next:
  text: "计算机基础"
  link: "/cs-basics/"
---

# Gradle 构建慢怎么优化？

> 构建慢通常慢在依赖解析、测试和缓存没吃到，而不是“Gradle 这三个字天生慢”。先测量，再改配置。

## 先测：慢在哪一类

不要一上来把所有开关拨开。先分清时间花在哪：

| 阶段     | 常见场景                 | 线索                                 |
| -------- | ------------------------ | ------------------------------------ |
| 配置     | 脚本里重 IO、动态逻辑多  | 改一行无关代码也像全量重配           |
| 依赖解析 | 仓库远、动态版本、缓存冷 | 首次或 `--refresh-dependencies` 很痛 |
| 编译     | 模块巨大、注解处理重     | `compileJava` / `compileKotlin` 居前 |
| 测试     | 单测多或集成测串行       | `test` 任务占大头                    |
| 打包     | 多渠道、大资源转换       | `shadow` / `minify` 类任务           |

```bash
./gradlew assemble --profile
# 看 build/reports/profile/ 的 HTML

./gradlew assemble --scan   # Build Scan；确认是否允许外发元数据
```

看墙钟最长的 task 再对症。没有数据的优化容易变成“感觉快了”。

## 低成本高收益开关

`gradle.properties` 常见组合：

```properties
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4g -XX:+UseParallelGC
org.gradle.workers.max=4
```

- **Daemon**：复用 JVM，避免每次冷启动
- **parallel**：多项目并行跑无依赖任务
- **caching**：输入不变复用 task 输出
- **configureondemand**：只配置相关子项目（注意与配置缓存的演进关系）
- **workers.max**：过大反而把内存打满变慢

较新 Gradle 优先评估 **Configuration Cache**：

```properties
org.gradle.configuration-cache=true
# 排查期可：org.gradle.configuration-cache.problems=warn
```

它复用配置阶段结果，二次构建往往提速明显。老插件可能不兼容；CI 先 `warn` 再考虑 `fail`。

## 依赖下载与仓库

冷构建慢，十有八九在拉包。

1. **仓库就近**：公司镜像 / 私服代理中央，少跨公网。
2. **钉死版本**：`1.+` 又慢又不可复现，写成 `1.4.2`。
3. **用好缓存**：本地 `~/.gradle/caches`；CI 按 wrapper + 锁文件哈希做 cache key。
4. **锁文件**：`./gradlew dependencies --write-locks` 固定解析结果。
5. **别默认 refresh**：`--refresh-dependencies` 不要写进日常脚本。

## 编译与注解处理

- 保持增量编译可用
- 注解处理器收敛；Kotlin 场景评估 KSP 替代 kapt
- 配置阶段禁止扫盘、跑外部命令、打网络
- 多模块把 API 与实现分开，减少“改实现全家重编”

```properties
kotlin.incremental=true
```

改公共 api 模块成本天然高——那是边界设计问题，不单靠开关。

## 测试常常是最大头

1. **本地默认不要跑全部集成测**

   ```bash
   ./gradlew test
   ./gradlew integrationTest    # 显式才跑
   ./gradlew :order-domain:test
   ```

2. **并行测试**（先保证隔离）

   ```kotlin
   tasks.test {
       maxParallelForks =
           (Runtime.getRuntime().availableProcessors() / 2).coerceAtLeast(1)
   }
   ```

   抢同一 DB/端口会随机红。

3. **昂贵夹具复用**：Testcontainers 重用、全局 fixture 一次启动。
4. **失败快**：又慢又脆的用例挪到独立任务，主链路保持分钟级反馈。

## 配置阶段保持轻

每个 build 都可能重跑配置。这些模式会拖垮：

- 配置期 `exec`、解压大文件、宽目录爬取
- 根上 `allprojects { ... }` 塞重逻辑
- 插件 `apply` 时做昂贵初始化
- 大量 `tasks.create` 提前具现化

改为：逻辑放 Task 执行期；用 `tasks.register` / `providers` 惰性 API；子项目按需 apply 插件。配置缓存一开，配置期副作用会被直接揭穿——这是好事。

## CI 与本地

| 点       | 本地          | CI                 |
| -------- | ------------- | ------------------ |
| Daemon   | 常驻          | 视 runner 是否复用 |
| 依赖缓存 | 用户 home     | 必须显式 cache     |
| 并行度   | 受散热/内存限 | 可按核数调高       |
| 配置缓存 | 开发友好      | 先验证插件兼容     |
| 测试范围 | 子集          | 全量或分片         |

```yaml
# CI 缓存思路（伪配置）
cache:
  key: gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties', '**/libs.versions.toml') }}
  paths:
    - ~/.gradle/caches
    - ~/.gradle/wrapper
```

排除项按官方建议处理，避免缓存脏状态。远程构建缓存（企业版或自建）适合中大型团队，不是个人仓库第一优先。

## 诊断 runbook

1. `--profile` 记下 top tasks
2. 冷/热各测一次，区分解析慢与执行慢
3. 开 daemon / parallel / caching，再测热构建
4. 评估 configuration cache
5. 钉动态版本，确认镜像
6. 拆分测试任务
7. 检查配置期 IO/网络
8. CI 补依赖缓存与合理 JVM/worker

每步留下前后耗时，避免同时拧十个旋钮说不清因果。

## 容易踩的坑

1. **workers 与 Xmx 同时拉满** → swap，更慢。
2. **默认 `--no-daemon` 又抱怨启动** → 长流水线仍值得开 daemon + 缓存。
3. **缓存键过粗/过细** → 幽灵失败或命中率极低。
4. **为速度默认 skip 关键测试** → 本地快、主干红。
5. **插件过旧导致配置缓存全失效** → 升级或排除问题任务，别全局关掉。

## 小结

1. 先用 profile/scan 定位是配置、解析、编译还是测试慢。
2. Daemon、并行、构建缓存、配置缓存通常是第一梯队收益。
3. 依赖钉版本、仓库就近、CI 缓存，解决冷构建与不稳解析。
4. 测试并行与任务拆分往往比再抠编译参数更有效。
5. 配置阶段保持惰性、无副作用，缓存才能真正命中。

## 参考

综合自 Gradle 性能相关用户手册（Daemon、并行、构建缓存、配置缓存）与常见多模块 JVM 工程加速实践整理；具体开关以当前 Gradle 版本文档为准。
