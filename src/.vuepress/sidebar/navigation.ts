export const navigationSidebar = {
  "/ai/": [
    "",
    "ai-llm-basis",
    "ai-prompt-structured-output",
    "ai-rag",
    "ai-agent-tools",
    "ai-application-engineering",
  ],
  "/ai-coding/": [
    "",
    "ai-coding-code-review",
    "ai-coding-project-context",
    "ai-coding-technical-writing",
    "ai-coding-acceptance",
    "ai-coding-cli-vs-ide",
    "ai-coding-spec-coding",
    "ai-coding-context-rules",
    "ai-coding-vibe-coding-tips",
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
      children: ["2026-06-16-note-1", "2026-07-02-ai-worldcup-betting"],
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
