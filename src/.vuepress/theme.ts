import { getDirname, path } from "vuepress/utils";
import { hopeTheme } from "vuepress-theme-hope";
import navbar from "./navbar.js";
import sidebar from "./sidebar.js";
import { applySeoJsonLd, buildSeoDescription } from "./seo.js";

const __dirname = getDirname(import.meta.url);
const hostname = process.env.VUEPRESS_HOSTNAME || "https://zhaoge0202.github.io/";
const authorName = "zhaoge";
const toSlimsearchFieldValue = (
  value: unknown,
): string | string[] | undefined => {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const strings = value.filter(
      (item): item is string => typeof item === "string",
    );

    return strings.length > 0 ? strings : undefined;
  }

  return undefined;
};

export default hopeTheme({
  hostname,
  logo: "/logo.svg",
  favicon: "/logo.svg",
  author: {
    name: authorName,
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
  displayFooter: false,
  pageInfo: ["Author", "Date", "Category", "Tag", "ReadingTime"],
  blog: {
    intro: "/about-the-author/",
    medias: {
      Github: "https://github.com/zhaoge0202",
      Email: "mailto:zhaoge0202@gmail.com",
      RSS: `${hostname.replace(/\/$/, "")}/rss.xml`,
    },
  },
  markdown: {
    align: true,
    attrs: true,
    codeTabs: true,
    mermaid: true,
    gfm: true,
    mark: true,
    spoiler: true,
    sub: true,
    sup: true,
    tabs: true,
    include: {
      resolvePath: (file, cwd) => {
        if (file.startsWith("@")) {
          return path.resolve(__dirname, "../snippets", file.replace("@", "./"));
        }

        const includeBaseDir = cwd ?? __dirname;
        return path.resolve(includeBaseDir, file);
      },
    },
    tasklist: true,
  },
  plugins: {
    blog: true,
    feed: {
      atom: true,
      json: true,
      rss: true,
    },
    icon: {
      assets: "iconify",
    },
    photoSwipe: false,
    slimsearch: {
      customFields: [
        {
          getter: (page) => toSlimsearchFieldValue(page.frontmatter.category),
          formatter: "分类: $content",
        },
        {
          getter: (page) => toSlimsearchFieldValue(page.frontmatter.tag),
          formatter: "标签: $content",
        },
      ],
    },
    seo: {
      canonical: hostname.replace(/\/$/, ""),
      ogp: (ogp, page) => ({
        ...ogp,
        "og:description": buildSeoDescription(page),
      }),
      jsonLd: (jsonLD, page) => ({
        ...jsonLD,
        description: buildSeoDescription(page),
      }),
      customHead: (head, page) => {
        applySeoJsonLd(head, page, hostname, authorName);
      },
    },
  },
});
