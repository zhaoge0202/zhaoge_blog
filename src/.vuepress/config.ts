import { viteBundler } from "@vuepress/bundler-vite";
import { fileURLToPath } from "node:url";
import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

export default defineUserConfig({
  base: process.env.VUEPRESS_BASE || "/",
  dest: dist,
  lang: "zh-CN",
  title: "Java 面试进阶指南",
  description: "面向 3-5 年 Java 后端工程师的面试进阶知识站，围绕高频题、原理、项目表达与复盘纠偏组织内容。",
  head: [
    ["meta", { name: "robots", content: "all" }],
    ["meta", { name: "author", content: "zhaoge" }],
    [
      "meta",
      {
        name: "keywords",
        content:
          "Java面试,后端面试,Java并发,JVM,MySQL,Redis,系统设计,工具实践,技术博客",
      },
    ],
    ["meta", { name: "apple-mobile-web-app-capable", content: "yes" }],
  ],
  theme,
  bundler: viteBundler(),
  shouldPrefetch: false,
  shouldPreload: false,
});
