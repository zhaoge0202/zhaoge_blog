const navbar = [
  "/",
  {
    text: "面试准备",
    link: "/interview-preparation/",
  },
  {
    text: "Java",
    link: "/java/",
  },
  {
    text: "计算机基础",
    link: "/cs-basics/",
  },
  {
    text: "数据库",
    link: "/database/",
  },
  {
    text: "系统设计",
    children: [
      { text: "系统设计总览", link: "/system-design/" },
      { text: "分布式", link: "/distributed-system/" },
      { text: "高性能", link: "/high-performance/" },
      { text: "高可用", link: "/high-availability/" },
    ],
  },
  {
    text: "工具实践",
    link: "/tools/",
  },
  {
    text: "AI",
    children: [
      { text: "AI 应用开发", link: "/ai/" },
      { text: "AI 编程", link: "/ai-coding/" },
    ],
  },
  {
    text: "推荐阅读",
    children: [
      { text: "学习路线", link: "/roadmap/" },
      { text: "开源项目", link: "/open-source-project/" },
      { text: "技术书籍", link: "/books/" },
      { text: "程序人生", link: "/high-quality-technical-articles/" },
    ],
  },
  {
    text: "博客",
    link: "/blog/",
  },
  {
    text: "关于",
    link: "/about-the-author/",
  },
];

export default navbar;
