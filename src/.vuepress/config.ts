import { createRequire } from "node:module";
import { viteBundler } from "@vuepress/bundler-vite";
import { fileURLToPath } from "node:url";
import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

const require = createRequire(import.meta.url);
// 普通构建与 CI 只读取可公开的示例默认值，不加载本机真实连接配置。
const blogDeployment = require("../../deploy/blog.config.example.json");

// 私有构建：把 src/private/ 一并打进单独的 dist-private/，用于部署到
// 「带访问控制」的私有站（Cloudflare Access / 内网），而不是公开的 GitHub Pages。
const isPrivateBuild = process.env.VUEPRESS_PRIVATE === "1";
const dist = fileURLToPath(
  new URL(
    isPrivateBuild ? "../../dist-private" : "../../dist",
    import.meta.url,
  ),
);
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
    "拾级 —— 面向 Java 后端开发者的进阶知识库，按知识域讲透高频题、原理与项目取舍，并保留独立博客记录实战与复盘。",
  head: [
    // 提前建立到第三方 CDN 的连接，省掉首屏 icon / logo 的 DNS+TLS 建链时间
    [
      "link",
      {
        rel: "preconnect",
        href: "https://api.iconify.design",
        crossorigin: "",
      },
    ],
    [
      "link",
      { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossorigin: "" },
    ],
    ["link", { rel: "preconnect", href: "https://media.zhaoge.si" }],
    [
      "meta",
      {
        name: "robots",
        content: isPrivateBuild ? "noindex, nofollow, noarchive" : "all",
      },
    ],
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
  // 本地私有笔记（src/private/，已 gitignore）默认只给 `npm run dev` 看。
  // 公开构建一律排除：即使本地存在这些文件，dist/ 里也不会有它们，
  // 避免「本地构建后手动上传 dist」这类路径把私密内容带出去。
  // 想让私有笔记出一个能线上访问的版本，走 `npm run build:private`
  // （产物在 dist-private/，必须部署到带访问控制的私有站）。
  pagePatterns: [
    "**/*.md",
    "!.vuepress",
    "!node_modules",
    ...(process.env.NODE_ENV === "production" && !isPrivateBuild
      ? ["!private/**"]
      : []),
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
        // 与自建发布脚本共用资源版本；其他发布目标仍可显式覆盖。
        assetsDir: process.env.VUEPRESS_ASSETS_DIR || blogDeployment.assetsDir,
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
  // 预加载当前页自身的路由 chunk（如首页 README chunk），使其与 app.js 并行下载、缩短关键请求链。
  // slimsearch 关 suggestion 后 worker 不再进首页 eager 依赖图，不会被误预加载。
  shouldPreload: true,
});
