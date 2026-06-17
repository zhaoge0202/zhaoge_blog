const sidebar = {
  "/topics/": [
    "",
    {
      text: "并发",
      prefix: "java-concurrency/",
      collapsible: true,
      children: [""],
    },
    {
      text: "JVM",
      prefix: "jvm/",
      collapsible: true,
      children: [""],
    },
    {
      text: "MySQL",
      prefix: "mysql/",
      collapsible: true,
      children: [""],
    },
    {
      text: "Redis",
      prefix: "redis/",
      collapsible: true,
      children: [""],
    },
  ],
  "/questions/": [
    "",
    {
      text: "并发",
      prefix: "java-concurrency/",
      collapsible: true,
      children: ["java-concurrency-thread-pool"],
    },
    {
      text: "JVM",
      prefix: "jvm/",
      collapsible: true,
      children: ["jvm-g1-vs-cms"],
    },
    {
      text: "MySQL",
      prefix: "mysql/",
      collapsible: true,
      children: ["mysql-mvcc-read-view"],
    },
    {
      text: "Redis",
      prefix: "redis/",
      collapsible: true,
      children: ["redis-cache-consistency"],
    },
  ],
  "/journey/": ["", "2026-06-16-note-1"],
  "/category/": [],
  "/tag/": [],
  "/article/": [],
  "/timeline/": [],
  "/star/": [],
};

export default sidebar;
