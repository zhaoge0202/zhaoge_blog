import { hopeTheme } from "vuepress-theme-hope";
import navbar from "./navbar.js";
import sidebar from "./sidebar.js";

export default hopeTheme({
  hostname: "https://interview.local",
  author: {
    name: "zhaoge",
  },
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
  footer: "内容由后台维护，发布后导出为 Markdown，由 VuePress Theme Hope 负责阅读体验。",
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
  },
});
