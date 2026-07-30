---
title: "Gradle 和 Maven 到底怎么选？构建脚本、依赖和性能差在哪？"
description: "从脚本模型、依赖解析到构建性能讲清 Gradle 与 Maven 的取舍。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "高频"
  - "项目实战"
  - "体系化"
prev:
  text: "Gradle 构建慢怎么优化？"
  link: "/tools/gradle/gradle-build-speed.html"
next:
  text: "计算机基础"
  link: "/cs-basics/"
---

# Gradle 和 Maven 到底怎么选？构建脚本、依赖和性能差在哪？

Android、Spring Boot 新项目越来越多用 Gradle，老项目和企业 Java 仍以 Maven 为主。两者都能管依赖、跑构建、出产物，但底层模型差很多——Maven 是"声明式 POM + 生命周期"，Gradle 是"可编程脚本 + 任务图"。理解差异，才能解释为什么 Gradle 构建更快、为什么它"灵活但容易乱"。

## 核心模型差异

|          | Maven                           | Gradle                                                    |
| -------- | ------------------------------- | --------------------------------------------------------- |
| 构建脚本 | XML（pom.xml），声明式          | Groovy / Kotlin DSL（build.gradle / .gradle.kts），可编程 |
| 执行模型 | 生命周期阶段，阶段绑插件目标    | 任务（task）+ 有向无环图（DAG）                           |
| 灵活性   | 低，约定大于配置                | 高，脚本可写任意逻辑                                      |
| 依赖管理 | GAV 坐标 + dependencyManagement | GAV + api / implementation 分离 + 约束                    |
| 构建性能 | 较慢，增量弱                    | 快，增量 + 缓存 + 配置缓存                                |

## 脚本：XML vs DSL

Maven 的 pom.xml 是纯声明，不能写逻辑（循环、条件都得靠插件），改构建行为只能换插件或写插件。Gradle 的 build.gradle 是可执行的 Groovy / Kotlin，能写函数、条件、循环，灵活但也更容易"写出只有作者看得懂的脚本"。

```groovy
// Gradle 里可以这么写
tasks.register('hello') {
    doLast {
        println "Hello ${project.name}"
    }
}
```

## 依赖：implementation vs api

Maven 只有 `compile` / `provided` / `runtime` 等范围，依赖会传递。Gradle 引入了 **api / implementation 分离**，解决了"Maven 传递依赖泛滥"的痛点：

- `api`：依赖会暴露给本模块的消费者（等于 Maven 的 compile 传递）。
- `implementation`：依赖只在本模块用，不暴露给上游——减少传递依赖，避免版本冲突，也降低重编译范围。

这是 Gradle 相对 Maven 在依赖治理上最大的改进。

## 构建性能：为什么 Gradle 更快

- **增量构建**：Gradle 跟踪每个任务的输入输出，没变的跳过（UP-TO-DATE）。Maven 增量弱，常全量重跑。
- **配置缓存**（Configuration Cache）：缓存配置阶段结果，不重复执行构建脚本。Maven 没有等价机制。
- **并行构建**：Gradle 原生多模块并行，Maven 需 `-T` 参数且生态支持参差。
- **守护进程**（Daemon）：常驻 JVM 复用，省启动开销。

Spring 官方测试里 Gradle 增量构建比 Maven 快数倍，尤其多模块大项目。但冷构建（全量）差距没那么夸张。

## 什么时候选哪个

- **Android**：Gradle 是唯一选择（AGP 只支持 Gradle）。
- **新 Spring Boot / 多模块 Kotlin 项目**：Gradle 更流行，性能好，DSL 灵活。
- **传统企业 Java、团队 Maven 经验深、依赖 POM 生态**：继续 Maven，生态成熟、约定清晰、上手简单。
- **库发布到 Maven Central**：两者都能，但 Maven 的 POM 元数据更通用。

## 各自的坑

- **Maven**：XML 啰嗦，自定义逻辑要写插件；增量弱，大项目慢。
- **Gradle**：脚本灵活但易失控（团队里"魔法脚本"难维护）；版本升级偶尔 breaking；DSL 学习曲线。

## 小结

- Maven 是声明式 POM + 生命周期，约定大于配置；Gradle 是可编程 DSL + 任务图，灵活但易乱。
- Gradle 的 api / implementation 分离比 Maven 依赖范围更精细，能减少传递依赖冲突。
- Gradle 靠增量、配置缓存、并行、守护进程比 Maven 构建更快，尤其大项目增量场景。
- Android 必 Gradle，新 Spring Boot / Kotlin 倾向 Gradle，传统企业 Java 可继续 Maven。
- Gradle 灵活是双刃剑，团队需约束脚本风格避免"魔法构建"。

## 参考

本文综合公开构建工具教材与 Gradle、Maven 官方文档，核对了脚本模型、依赖范围（api / implementation）、增量与配置缓存等性能机制，并对照了两者的选型取舍。
