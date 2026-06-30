export const navigationSidebar = {
  "/ai/": [""],
  "/ai-coding/": [
    "",
    "ai-coding-code-review",
    "ai-coding-project-context",
    "ai-coding-technical-writing",
    "ai-coding-acceptance",
  ],
  "/roadmap/": [""],
  "/open-source-project/": [
    "",
    "source-reading-spring-entry",
    "source-reading-mybatis-entry",
    "source-reading-netty-entry",
    "source-reading-project-expression",
  ],
  "/books/": [
    "",
    "books-java-jvm-concurrency",
    "books-database-middleware",
    "books-cs-system-design",
  ],
  "/high-quality-technical-articles/": [""],
  "/about-the-author/": [""],
  "/blog/": [
    "",
    {
      text: "实战记录",
      prefix: "practice/",
      collapsible: true,
      children: ["2026-06-18-r2-media-sync-tutorial"],
    },
    {
      text: "随笔",
      prefix: "essays/",
      collapsible: true,
      children: ["2026-06-16-note-1"],
    },
  ],
};

export const generatedSidebar = {
  "/category/": [],
  "/tag/": [],
  "/article/": [],
  "/timeline/": [],
  "/star/": [],
};
