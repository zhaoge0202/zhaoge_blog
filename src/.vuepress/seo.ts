const SITE_TITLE = "Java 面试进阶指南";
const HOME_DESCRIPTION =
  "Java 面试进阶指南是一份面向 3-5 年 Java 后端工程师的知识库，覆盖 Java、数据库、系统设计、工具实践与个人复盘，适合系统复习、查漏补缺和沉淀自己的技术判断。";

const normalize = (value: unknown): string =>
  String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

const trimDescription = (description: string): string => {
  if (description.length <= 160) return description;

  const trimmed = description.slice(0, 156).replace(/[，、,\s]+$/, "");
  return `${trimmed}。`;
};

const buildPathUrl = (hostname: string, pagePath: string): string =>
  new URL(pagePath.replace(/^\//, ""), hostname.endsWith("/") ? hostname : `${hostname}/`).toString();

const buildFocusText = (page: {
  frontmatter: Record<string, unknown>;
  headers?: { title?: string }[];
}): string => {
  const categories = toArray(page.frontmatter.category)
    .map(normalize)
    .filter(Boolean)
    .slice(0, 2);
  const tags = toArray(page.frontmatter.tag ?? page.frontmatter.tags)
    .map(normalize)
    .filter(Boolean)
    .slice(0, 3);
  const headers = toArray(page.headers)
    .map((header) => normalize(header?.title))
    .filter(Boolean)
    .slice(0, 3);

  const focus = [...categories, ...tags, ...headers].filter(Boolean).slice(0, 4);

  return focus.length ? `重点围绕 ${focus.join("、")} 等内容展开。` : "";
};

export const buildSeoDescription = (page: {
  path: string;
  title?: string;
  frontmatter: Record<string, unknown>;
  headers?: { title?: string }[];
  contentRendered?: string;
  content?: string;
  data?: { excerpt?: string };
}): string => {
  const existingDescription = normalize(page.frontmatter.description);

  if (existingDescription.length >= 90) return trimDescription(existingDescription);
  if (page.path === "/") return HOME_DESCRIPTION;

  const title = normalize(page.title);
  const focusText = buildFocusText(page);
  const bodyText = normalize(page.data?.excerpt ?? page.contentRendered ?? page.content ?? "").slice(0, 110);

  return trimDescription(
    normalize(
      [
        title ? `${title}。` : "",
        focusText,
        "内容会尽量补齐概念边界、项目取舍、常见误区和面试追问方向，帮助你把知识点讲成可落地的答案。",
        bodyText,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  );
};

export const applySeoJsonLd = (
  head: [string, Record<string, string>, string][],
  page: {
    path: string;
    title?: string;
    frontmatter: Record<string, unknown>;
  },
  hostname: string,
  authorName: string,
): void => {
  const description = buildSeoDescription(page as never);
  const url = buildPathUrl(hostname, page.path);

  page.frontmatter.description = description;

  if (page.path === "/") {
    head.push([
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_TITLE,
        url,
        inLanguage: "zh-CN",
        description,
        publisher: {
          "@type": "Person",
          name: authorName,
        },
      }),
    ]);
    return;
  }

  const article = page.frontmatter.article === true || page.frontmatter.timeline === true;

  if (!article) return;

  head.push([
    "script",
    { type: "application/ld+json" },
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.title || SITE_TITLE,
      author: {
        "@type": "Person",
        name: authorName,
      },
      datePublished: page.frontmatter.date || undefined,
      inLanguage: "zh-CN",
      url,
      description,
      mainEntityOfPage: url,
    }),
  ]);
};
