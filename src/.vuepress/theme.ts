import { hopeTheme } from "vuepress-theme-hope";
import navbar from "./navbar.js";
import sidebar from "./sidebar.js";

export default hopeTheme({
  hostname: process.env.VUEPRESS_HOSTNAME || "https://zhaoge0202.github.io/",
  author: {
    name: "zhaoge",
  },
  repo: "https://github.com/zhaoge0202/zhaoge_blog",
  docsDir: "src",
  navbar,
  sidebar,
  pure: true,
  focus: false,
  darkmode: "toggle",
  breadcrumb: true,
  lastUpdated: true,
  contributors: false,
  editLink: false,
  print: false,
  displayFooter: true,
  footer: "内容以 Markdown 维护，由 GitHub Pages 自动发布。",
  pageInfo: ["Author", "Date", "Category", "Tag", "ReadingTime"],
  markdown: {
    align: true,
    attrs: true,
    mark: true,
    spoiler: true,
    sub: true,
    sup: true,
    tabs: true,
  },
  plugins: {
    blog: true,
    photoSwipe: false,
    search: false,
  },
});
