---
title: "多模块工程和私服怎么组织？"
description: "从模块拆分、依赖管理与私服发布讲清多模块工程。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "进阶"
  - "项目实战"
  - "体系化"
prev:
  text: "Maven 依赖冲突怎么排查？"
  link: "/tools/maven/maven-dependency-conflict.html"
next:
  text: "Gradle"
  link: "/tools/gradle/"
---

# 多模块工程和私服怎么组织？

> 多模块是为了边界清晰和构建复用，不是为了把目录切碎显得架构高级。拆错了会比单模块更难改。

## 多模块在解决什么问题

单仓库代码变多后，常见痛点：

- 改一行触发过大范围编译
- 依赖版本散落各 pom，冲突难收口
- 领域模型 / 客户端 SDK 想单独复用却抽不干净
- 库与可运行应用的生命周期本就不该绑死

Maven 多模块（reactor）用父 pom 聚合子模块，按依赖顺序编译、测试、安装。日常高频组合：

```bash
mvn -pl order-app -am package    # 构建 app 及其依赖模块
mvn -pl order-domain test        # 只碰相关反应堆
```

`-pl` 指定模块，`-am`（also-make）连同它所依赖的上游一起做。别每次根目录盲敲全量 `package`。

## 一种务实的目录形态

```text
shop-parent/                 packaging=pom：聚合 + dependencyManagement
├─ shop-api/                 对外契约：DTO、API，可被他服务依赖
├─ shop-domain/              领域模型与领域服务
├─ shop-infrastructure/      DB、MQ、外部 HTTP 适配
├─ shop-app/                 启动与可运行打包
└─ shop-bom/                 可选：纯 BOM，供其他仓库 import
```

| 模块           | 职责                | 注意                    |
| -------------- | ------------------- | ----------------------- |
| parent         | 版本、插件、modules | packaging 为 `pom`      |
| api            | 稳定契约            | 少依赖，别拖进实现细节  |
| domain         | 业务核心            | 尽量不依赖入站 Web 框架 |
| infrastructure | 技术实现            | 依赖 domain，禁止反向   |
| app            | 可运行装配          | 通常只有这里打可执行包  |

不是每个项目都要套齐 DDD 目录名。**按变更频率与依赖方向切**，比按名词表切重要。

## 父 pom 该管什么

适合收敛到父级的：

1. 属性与第三方版本
2. `dependencyManagement`（锁版本，不强制引入）
3. `pluginManagement` + 必要 plugin（compiler、surefire 等）
4. `modules` 列表
5. 发布相关配置（或放到 profile / settings）

子模块保持瘦：

```xml
<parent>
  <groupId>com.example</groupId>
  <artifactId>shop-parent</artifactId>
  <version>1.4.0-SNAPSHOT</version>
</parent>
<artifactId>shop-domain</artifactId>
<dependencies>
  <dependency>
    <groupId>com.example</groupId>
    <artifactId>shop-api</artifactId>
    <!-- 版本跟 ${project.version} 或由 parent 管理 -->
  </dependency>
</dependencies>
```

同仓库内部模块通常一起发版；对外 BOM 可以另仓、另版本节奏。

## 依赖方向与循环依赖

健康方向：

```text
app → infrastructure → domain → api
app → domain / api
```

domain 依赖 app、api 依赖 infrastructure 都属于倒置。反应堆检出循环依赖会构建失败——应视为拆分失败信号，而不是用“先 local install 再编”掩盖。

出现循环时优先：类型下沉到更基础模块、接口与实现分离、或承认这两个模块本不该拆。再堆一个 `common` 大杂烩往往是长期中毒。

## 构建与开发体验

```bash
mvn -pl shop-domain test
mvn -pl shop-app -am package
mvn -pl shop-app -am spring-boot:run
mvn -T 1C package                 # 并行；集成测抢端口时要小心
```

IDE 的“委派 IDE 构建 / 委派 Maven”要与团队一致，避免本机能跑、CI 路径不一致。`-DskipTests` 只适合本地赶验证，不要当 CI 默认。

## 私服与 SNAPSHOT / Release

私服（Nexus / Artifactory 等）负责：缓存中央仓库、存放二方库、区分快照与正式版、控制谁能 deploy release。

`settings.xml` 里 `server.id` 必须和 pom `distributionManagement` 的仓库 id 对齐；密码走环境变量，勿明文进库。`mirrorOf` 范围写错（例如 `*` 只代理了中央）会导致内部坐标全 404。

|          | SNAPSHOT           | Release          |
| -------- | ------------------ | ---------------- |
| 用途     | 联调、开发中       | 生产与可追溯交付 |
| 可变性   | 同版本号可能被覆盖 | 应不可变         |
| 构建复现 | 差                 | 好               |

CI 发布建议：主干合并 → 测试 →（可选）SNAPSHOT 供联调 → tag 后 deploy release。正式版权限收在 CI，禁止每人笔记本直接打生产坐标。

本地调试二方库用 `mvn -pl shop-api -am clean install` 进 `.m2` 可以，但联调真相仍应以私服或同一反应堆为准，别让“只有我 install 过”成为隐藏依赖。

## 版本策略

1. **反应堆统一版本**：所有模块同一 `1.4.0`，中小拆分最省事
2. **分模块独立版本**：库与应用生命周期不同时更灵活，沟通与工具成本更高

统一版本可用 `versions-maven-plugin` 批量改号。独立版本时要写清兼容矩阵，避免 app 1.8“顺手”依赖 api 1.2 却假定天然匹配。

对外 SDK 另看语义化版本 + changelog；破坏性改动升 major，并保留一段时间旧坐标或适配层。内部模块编号可以糙一点，**对外坐标一旦发布就应按契约维护**。

## 容易踩的坑

1. **为拆而拆**：三个类一个模块，pom 比代码多。
2. **api 引入重型实现**：所有依赖方被迫带上 Hibernate/Kafka。
3. **循环依赖靠 install 顺序蒙混**：CI 干净环境必炸。
4. **生产依赖 SNAPSHOT**：不可复现，回滚困难。
5. **父 pom 插件过重**：每个模块都跑无关报告，CI 被拖死——用 profile 拆。
6. **mirror 配太宽**：内部制品解析失败。

多模块把版本收到 parent/BOM 后，外部传递冲突仍用：

```bash
mvn -pl shop-app -am dependency:tree -Dverbose
```

与《Maven 依赖冲突怎么排查？》同一套手法；parent 是第一道防线，公司 BOM 是跨仓库第二道。

## 小结

1. 按边界与依赖方向拆模块，父 pom 收敛版本与插件。
2. 依赖保持单向：可运行模块在外，契约模块保持轻。
3. 日常用 `-pl`/`-am` 增量构建；循环依赖当设计失败信号。
4. 私服区分 SNAPSHOT/release，正式版由 CI 发布且不可变。
5. 拆分粒度服从变更与复用；对外 SDK 单独把好语义化版本。

## 参考

综合自 Maven 多模块反应堆机制与二方库/私服协作实践整理，结合常见 Java 服务端工程结构约束说明。
