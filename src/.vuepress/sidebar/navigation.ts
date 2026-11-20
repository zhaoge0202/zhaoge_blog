export const navigationSidebar = {
  "/ai/": [
    "",
    "ai-llm-basis",
    "ai-prompt-structured-output",
    "ai-rag",
    "ai-agent-tools",
    {
      text: "MCP 协议与工程实践",
      collapsible: true,
      children: [
        "ai-mcp-architecture",
        "ai-mcp-primitives",
        "ai-mcp-lifecycle",
        "ai-mcp-transports",
        "ai-mcp-authorization",
        "ai-mcp-java-server",
        "ai-mcp-troubleshooting",
      ],
    },
    "ai-application-engineering",
    {
      text: "AI 能力接入业务系统",
      collapsible: true,
      children: [
        "ai-java-integration-stack",
        "ai-streaming-sse-backend",
        "ai-tool-calling-business-api",
        "ai-async-task-pipeline",
        "ai-feature-rollout-guard",
      ],
    },
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
      children: [
        "2026-06-18-r2-media-sync-tutorial",
        "2026-07-30-read-source-code-rpc",
        "2026-10-29-pi-agent-runtime-architecture",
        "2026-11-11-ai-gateway-agent-context-interview",
      ],
    },
    {
      text: "随笔",
      prefix: "essays/",
      collapsible: true,
      children: [
        "2026-06-16-note-1",
        "2026-07-02-ai-worldcup-betting",
        "2026-07-30-learn-cs-connect",
        "2026-07-30-bad-habits",
      ],
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
