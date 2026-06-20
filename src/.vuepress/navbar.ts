const navbar = [
  "/",
  {
    text: "面试准备",
    icon: "mdi:clipboard-text-outline",
    link: "/interview-preparation/",
  },
  {
    text: "Java",
    icon: "mdi:language-java",
    link: "/java/",
  },
  {
    text: "计算机基础",
    icon: "mdi:desktop-classic",
    link: "/cs-basics/",
  },
  {
    text: "数据库",
    icon: "mdi:database-outline",
    link: "/database/",
  },
  {
    text: "系统设计",
    icon: "mdi:sitemap-outline",
    children: [
      { text: "系统设计总览", icon: "mdi:sitemap-outline", link: "/system-design/" },
      { text: "分布式", icon: "mdi:lan", link: "/distributed-system/" },
      { text: "高性能", icon: "mdi:rocket-launch-outline", link: "/high-performance/" },
      { text: "高可用", icon: "mdi:shield-check-outline", link: "/high-availability/" },
    ],
  },
  {
    text: "工具实践",
    icon: "mdi:tools",
    link: "/tools/",
  },
  {
    text: "AI",
    icon: "mdi:robot-outline",
    children: [
      { text: "AI 应用开发", icon: "mdi:robot-happy-outline", link: "/ai/" },
      { text: "AI 编程", icon: "mdi:code-tags", link: "/ai-coding/" },
    ],
  },
  {
    text: "推荐阅读",
    icon: "mdi:book-open-page-variant-outline",
    children: [
      { text: "学习路线", icon: "mdi:map-outline", link: "/roadmap/" },
      { text: "开源项目", icon: "mdi:github", link: "/open-source-project/" },
      { text: "技术书籍", icon: "mdi:bookshelf", link: "/books/" },
      { text: "程序人生", icon: "mdi:account-heart-outline", link: "/high-quality-technical-articles/" },
    ],
  },
  {
    text: "博客",
    icon: "mdi:notebook-outline",
    link: "/blog/",
  },
  {
    text: "关于",
    icon: "mdi:account-outline",
    link: "/about-the-author/",
  },
];

export default navbar;
