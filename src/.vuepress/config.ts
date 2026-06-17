import { viteBundler } from "@vuepress/bundler-vite";
import { fileURLToPath } from "node:url";
import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

export default defineUserConfig({
  base: process.env.VUEPRESS_BASE || "/",
  dest: dist,
  lang: "zh-CN",
  title: "Java 面试进阶平台",
  description: "面向 3-5 年 Java 后端工程师的进阶面试准备平台",
  head: [
    ["meta", { name: "robots", content: "all" }],
    ["meta", { name: "author", content: "zhaoge" }],
  ],
  theme,
  bundler: viteBundler(),
  shouldPrefetch: false,
  shouldPreload: false,
});
