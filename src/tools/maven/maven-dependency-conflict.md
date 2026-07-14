---
title: "Maven 依赖冲突怎么排查？"
description: "从依赖树、仲裁规则和 exclusion 讲清冲突定位。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "高频"
  - "项目实战"
  - "基础"
prev:
  text: "Maven"
  link: "/tools/maven/"
next:
  text: "多模块工程和私服怎么组织？"
  link: "/tools/maven/maven-multi-module.html"
---

# Maven 依赖冲突怎么排查？

> 依赖冲突的表面常是 `NoSuchMethodError` / `ClassNotFoundException`，根因是运行时 classpath 上的类来自你不想要的那个版本。

## 为什么会冲突

Maven 会解析整棵传递依赖树，最终每个 `groupId:artifactId` 只保留一个版本进入编译和打包。多个组件可能分别依赖：

```text
你的项目
├─ spring-a → guava 31.x
└─ legacy-b → guava 27.x
```

仲裁之后 classpath 上只有一个 guava。若运行路径走到了只在 31.x 才有的方法，而实际留下的是 27.x，就会在**运行期**炸——编译期未必报错，因为你直接依赖的 API 可能用的是“碰巧还在”的那部分。

胖 jar、Spring Boot repackage、应用服务器提供的共享 lib，还会再叠一层“最终谁覆盖谁”的问题。

## 先看清树，再谈手段

```bash
# 完整树（较大）
mvn dependency:tree

# 标出被省略的冲突分支
mvn dependency:tree -Dverbose

# 只盯某个坐标
mvn dependency:tree -Dincludes=com.google.guava:guava

# 多模块时指定模块
mvn -pl app -am dependency:tree -Dincludes=org.apache.httpcomponents:httpclient
```

读树时关注：

1. **谁直接引入了可疑组件**（你的 pom 还是某传递依赖）
2. **同一组件出现多个版本时，哪条被留下、哪条被 omitted**
3. **路径深度**——这和仲裁规则直接相关

可选辅助：

```bash
mvn dependency:analyze          # 声明未用 / 用了未声明
mvn help:effective-pom          # 看最终生效的依赖与管理
```

`analyze` 对反射、SPI 加载的依赖不敏感，结果要人工甄别，不能盲删。

## Maven 仲裁规则（必须记住）

在没有 `dependencyManagement` 强制版本时，主要两条：

1. **最短路径优先**  
   依赖路径更短的版本获胜。你 pom 直接依赖的 1.2 会压过“经三层传递才来的 1.5”。

2. **路径长度相同：先声明优先**  
   在同一 pom 里，写在前面的依赖所带来的版本优先。

示意：

```text
project → A → X:1.0          （路径长度 2）
project → X:2.0              （路径长度 1）→ 2.0 赢

project → A → X:1.0          （长度 2）
project → B → X:2.0          （长度 2）→ 谁先写在 pom 谁赢
```

这套规则**不是“总是选最新”**。很多人以为 Maven 会智能升到最高版本，这是错觉。要最新或要统一，得自己锁。

## 怎么把版本按住

### 1. `dependencyManagement`（首选）

在父 pom 或 BOM 里声明版本，子模块只写坐标不写版本：

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.google.guava</groupId>
      <artifactId>guava</artifactId>
      <version>32.1.3-jre</version>
    </dependency>
  </dependencies>
</dependencyManagement>
```

它不直接引入依赖，只规定“一旦用到，用这个版本”。对传递依赖的版本收敛非常关键。

### 2. 导入 BOM

Spring Boot、测试容器等提供 BOM：

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>3.2.5</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
```

注意：多个 BOM 同时 import 时，**先声明的 BOM 对同一坐标优先**（与 dependencyManagement 合并顺序有关）。冲突时显式再写一条覆盖。

### 3. `exclusions` 剪枝

某个传递依赖明确有害或重复时：

```xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>legacy-sdk</artifactId>
  <version>1.4.0</version>
  <exclusions>
    <exclusion>
      <groupId>com.google.guava</groupId>
      <artifactId>guava</artifactId>
    </exclusion>
  </exclusions>
</dependency>
```

exclusion 只 imp 掉那一条传递路径。若别处还会引入同一组件，要继续查树。剪完后确认运行期仍有人提供兼容实现，否则会变成 `ClassNotFoundException`。

### 4. 直接显式依赖

在你自己的模块里直接声明目标版本，利用“最短路径优先”压过传递旧版。权宜之计时有用，但长期仍建议收到 `dependencyManagement`，避免每个模块复制版本号。

## 典型症状与排查路径

| 现象                     | 可能原因                              | 动作                                    |
| ------------------------ | ------------------------------------- | --------------------------------------- |
| `NoSuchMethodError`      | 编译期 API 新、运行期 jar 旧          | tree 找旧版来源，升版或 exclusion       |
| `ClassNotFoundException` | 包名迁移/分类器不对/被 exclusion 过度 | 查是否换了 artifact（如 javax→jakarta） |
| `NoClassDefFoundError`   | 静态初始化失败或半套依赖              | 看 caused by，常是缺传递实现            |
| 本地正常 CI 挂           | 仓库缓存、镜像、.m2 差异              | 对齐 settings、清缓存复现               |
| 包进 fat jar 仍冲突      | shade 未 relocate / 顺序覆盖          | 查插件配置与最终 jar 内容               |

解压或列出最终产物很有用：

```bash
jar tf app/target/app.jar | rg guava
# Spring Boot
jar tf app/target/app.jar | rg 'BOOT-INF/lib/guava'
```

看到两个不同版本同时打进包，说明打包插件或依赖集合还有问题。

## 工程上怎么减少复发

1. **父 pom / 平台 BOM 统一第三方版本**，业务模块禁止随手写版本号。
2. **升级大版本时先跑一遍 tree 与全量测试**，关注 httpclient、jackson、guava、asm、字节码相关库。
3. **慎用 `latest`/`RELEASE` 动态版本**，构建不可复现。
4. **插件版本也要管**：`maven-compiler-plugin`、`surefire`、`shade` 行为随版本变。
5. **文档化“禁止引入”列表**：例如旧 `commons-logging` 与 `spring-jcl` 打架时的团队选择。

可选在 CI 加 enforcer 规则，禁止依赖收敛失败或禁止某坐标：

```xml
<!-- 思路：maven-enforcer-plugin + banDuplicateClasses / bannedDependencies -->
```

具体规则按团队耐受度调，太严会拖慢迭代，太松等于没有。

## 容易踩的坑

1. **只改子模块版本，父 management 仍锁旧版**  
   effective-pom 一看便知，别凭感觉。

2. **exclusion 抄错 groupId**  
   树上看似消失，其实坐标写错，冲突还在。

3. **把 provided 的容器包又打进应用**  
   Servlet API 等应 provided，与容器自带版本冲突时各种 `LinkageError`。

4. **编译过了就当依赖健康**  
   冲突是运行期问题的大户，集成测试和启动冒烟要覆盖到。

5. **多模块 reactor 里“我本机 install 过旧版”**  
   本地仓库脏缓存造成“只有我能复现/只有我不能复现”。用 CI 干净环境对齐真相。

## 小结

1. 冲突本质是同一坐标多个版本被仲裁成一个，与调用方期望不一致。
2. 先用 `dependency:tree`（必要时 verbose/includes）定位引入路径。
3. 仲裁是最短路径优先、同深先声明优先，不是自动选最新。
4. 用 `dependencyManagement`/BOM 锁版本，用 exclusion 剪错误传递。
5. 以运行期 classpath 与打包产物为准验收，并在父 pom 层防止复发。

## 参考

综合自 Maven Dependency Mechanism 与 Java 后端常见依赖排障实践整理；仲裁规则以 Maven 官方依赖调解行为为准。
