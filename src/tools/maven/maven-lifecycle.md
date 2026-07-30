---
title: "Maven 的生命周期和插件机制是怎么运转的？"
description: "从三套生命周期、phase 到插件绑定讲清 Maven 构建的运转方式。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "高频"
  - "基础"
  - "原理深入"
prev:
  text: "Maven"
  link: "/tools/maven/"
next:
  text: "Maven 依赖冲突怎么排查？"
  link: "/tools/maven/maven-dependency-conflict.html"
---

# Maven 的生命周期和插件机制是怎么运转的？

很多人用 Maven 就是 `mvn clean package`，但不太清楚 `clean`、`package` 到底跑了什么。Maven 的核心不是命令本身，而是**生命周期（lifecycle）+ 阶段（phase）+ 插件目标（goal）**这套机制。理解了它，你才能解释 `mvn install` 为什么会先跑 test、自定义插件绑在哪、为什么打包插件一换行为全变了。

## 三套生命周期

Maven 有三套互相独立的生命周期：

| 生命周期 | 作用                   | 关键阶段                                          |
| -------- | ---------------------- | ------------------------------------------------- |
| clean    | 清理构建产物           | pre-clean、clean、post-clean                      |
| default  | 构建、编译、打包、部署 | validate、compile、test、package、install、deploy |
| site     | 生成站点文档           | site、site-deploy                                 |

三套独立意味着 `mvn clean package` 是同时触发 clean 生命周期的 clean 阶段和 default 生命周期的 package 阶段。

## 阶段是有序的

default 生命周期的阶段有顺序，**执行某个阶段会把它前面的阶段都跑一遍**：

```
validate → compile → test → package → verify → install → deploy
```

所以 `mvn package` 会自动跑 compile、test 再 package，不需要你显式写。这是 Maven 和 Gradle（显式任务）最大的行为差异之一——Maven 是"声明阶段，前面自动补齐"。

## 阶段与插件目标的绑定

阶段本身是空的，**真正的活是插件目标（goal）干的**。Maven 把默认插件目标绑定到阶段：

| 阶段    | 默认绑定的插件目标                                                  |
| ------- | ------------------------------------------------------------------- |
| compile | maven-compiler-plugin:compile                                       |
| test    | maven-surefire-plugin:test                                          |
| package | maven-jar-plugin:jar（默认 jar 打包） / maven-war-plugin:war（war） |
| install | maven-install-plugin:install                                        |
| deploy  | maven-deploy-plugin:deploy                                          |

所以 `mvn package` 实际跑的是 `maven-jar-plugin:jar`。换成 `maven-shade-plugin` 或 `spring-boot-maven-plugin`，打包行为就变了——这就是为什么打可执行 jar 要在 POM 里配打包插件。

## 插件目标可以独立执行

插件目标可以不绑阶段，直接执行：

```bash
mvn dependency:tree # maven-dependency-plugin 的 tree 目标
mvn exec:java # exec-maven-plugin 的 java 目标
```

格式是 `插件前缀:目标`。这种不依赖阶段顺序，按需调用。

## POM 里怎么配插件绑定

```xml
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <executions>
    <execution>
      <phase>package</phase>
      <goals><goal>repackage</goal></goals>
    </execution>
  </executions>
</plugin>
```

`repackage` 目标绑到 `package` 阶段，所以 `mvn package` 时 Spring Boot 的可执行 jar 打包就会跑。没绑定阶段的话，只能 `mvn spring-boot:repackage` 显式调。

## 继承与聚合

- **继承**：子模块 POM 继承父 POM 的插件配置、依赖管理（dependencyManagement），统一版本。
- **聚合**：父 POM 用 `<modules>` 列出子模块，`mvn` 在父目录执行时批量构建。

多模块工程里，父 POM 的 `<pluginManagement>` 统一插件版本，子模块按需引用。

## 常见疑问

- **为什么 test 失败会阻断 package**：test 阶段在 package 前，surefire 默认 failFast，测试失败 BUILD FAILURE。跳过测试用 `-DskipTests`（编译测试代码但不跑）或 `-Dmaven.test.skip=true`（连测试代码都不编译）。
- **为什么改了插件版本行为变了**：插件版本升级可能改默认绑定，比如 compiler 插件默认 JDK 版本。锁定插件版本避免意外。
- **phase 和 goal 区别**：phase 是流程节点（空的），goal 是真正干活的动作；一个 phase 可绑多个 goal，一个 goal 也可绑多个 phase。

## 小结

- Maven 三套生命周期（clean / default / site）互相独立，阶段有序，执行某阶段自动补齐前面阶段。
- 阶段本身是空的，真正干活的是插件目标，Maven 默认把 compiler / surefire / jar 等目标绑到对应阶段。
- 插件目标可绑阶段（POM executions）也可独立执行（`插件:目标`）。
- 打包行为由 package 阶段绑的插件决定，换打包插件 = 换产物形态。
- 多模块用继承（pluginManagement 统一版本）和聚合（modules 批量构建）。

## 参考

本文综合公开 Maven 教材与官方 POM 参考文档，核对了三套生命周期、阶段与插件目标的绑定关系、继承与聚合机制，并对照了打包插件替换与跳过测试等常见行为。
