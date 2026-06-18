const sidebar = {
  "/interview-preparation/": [""],
  "/java/": [
    "",
    {
      text: "并发",
      prefix: "concurrent/",
      collapsible: true,
      children: ["", "java-concurrency-thread-pool"],
    },
    {
      text: "JVM",
      prefix: "jvm/",
      collapsible: true,
      children: ["", "jvm-g1-vs-cms"],
    },
  ],
  "/database/": [
    "",
    {
      text: "MySQL",
      prefix: "mysql/",
      collapsible: true,
      children: ["", "mysql-mvcc-read-view"],
    },
    {
      text: "Redis",
      prefix: "redis/",
      collapsible: true,
      children: ["", "redis-cache-consistency"],
    },
  ],
  "/system-design/": [""],
  "/tools/": [""],
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
  "/category/": [],
  "/tag/": [],
  "/article/": [],
  "/timeline/": [],
  "/star/": [],
};

export default sidebar;
