import { createRequire } from "node:module";
import { viteBundler } from "@vuepress/bundler-vite";
import { fileURLToPath } from "node:url";
import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

const require = createRequire(import.meta.url);
const dist = fileURLToPath(new URL("../../dist", import.meta.url));
const lazyMermaidComponentPath = fileURLToPath(
  new URL("./components/LazyMermaid.vue", import.meta.url),
);
const realMermaidComponentPath =
  require.resolve("@vuepress/plugin-markdown-chart/client/components/Mermaid.js");

export default defineUserConfig({
  base: process.env.VUEPRESS_BASE || "/",
  dest: dist,
  lang: "zh-CN",
  title: "拾级",
  description:
    "拾级 —— 面向 3-5 年 Java 后端工程师的进阶知识库，按知识域讲透高频题、原理与项目取舍，并保留独立博客记录实战与复盘。",
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
    ["meta", { name: "mobile-web-app-capable", content: "yes" }],
  ],
  theme,
  bundler: viteBundler({
    viteOptions: {
      resolve: {
        alias: {
          "@site/real-mermaid": realMermaidComponentPath,
          [realMermaidComponentPath]: lazyMermaidComponentPath,
        },
      },
      build: {
        rollupOptions: {
          // Vite 8 默认打包器 Rolldown 对 /* #__PURE__ */ 注释位置的校验更严格，
          // @vueuse/core 等第三方依赖的产物会刷出大量 INVALID_ANNOTATION 告警。
          // 这是依赖自身的注释风格问题，与本站代码无关，这里只静音这一种告警，
          // 其余构建日志照常输出。
          onLog(level, log, handler) {
            if (log.code === "INVALID_ANNOTATION") return;
            handler(level, log);
          },
        },
      },
    },
  }),
  shouldPrefetch: false,
  shouldPreload: false,
});
