const SITE_TITLE = "拾级";
const HOME_DESCRIPTION =
  "拾级是一份面向 3-5 年 Java 后端工程师的进阶知识库，覆盖 Java、数据库、系统设计、工具实践与个人复盘，适合系统复习、查漏补缺和沉淀自己的技术判断。";

// 路径段 -> 中文显示名，用于面包屑和栏目页结构化数据
const segmentDisplayNames: Record<string, string> = {
  "interview-preparation": "面试准备",
  java: "Java",
  basis: "基础",
  collection: "集合",
  concurrent: "并发",
  jvm: "JVM",
  io: "IO",
  "new-features": "新特性",
  "cs-basics": "计算机基础",
  "operating-system": "操作系统",
  network: "计算机网络",
  "data-structure": "数据结构",
  algorithms: "算法",
  database: "数据库",
  mysql: "MySQL",
  redis: "Redis",
  sql: "SQL",
  elasticsearch: "Elasticsearch",
  mongodb: "MongoDB",
  "system-design": "系统设计",
  framework: "框架",
  security: "安全",
  "distributed-system": "分布式",
  rpc: "RPC",
  "high-performance": "高性能",
  "high-availability": "高可用",
  tools: "工具实践",
  docker: "Docker",
  git: "Git",
  maven: "Maven",
  gradle: "Gradle",
  ai: "AI 应用开发",
  "ai-coding": "AI 编程",
  roadmap: "学习路线",
  "open-source-project": "开源项目",
  books: "技术书籍",
  "high-quality-technical-articles": "程序人生",
  blog: "博客",
  essays: "随笔",
  practice: "实战记录",
  "about-the-author": "关于作者",
};

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
  new URL(
    pagePath.replace(/^\//, ""),
    hostname.endsWith("/") ? hostname : `${hostname}/`,
  ).toString();

const formatSegment = (segment: string): string =>
  segmentDisplayNames[segment] ??
  segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const getPathTopic = (pagePath: string): string =>
  pagePath
    .split("/")
    .filter(Boolean)
    .map((segment) => formatSegment(segment.replace(/\.html$/, "")))
    .join(" / ");

const isSectionIndex = (page: {
  path: string;
  frontmatter: Record<string, unknown>;
}): boolean =>
  page.path !== "/" &&
  page.path.endsWith("/") &&
  page.frontmatter.article !== true;

const buildBreadcrumb = (
  hostname: string,
  page: { path: string; title?: string },
): Record<string, unknown> | null => {
  const segments = page.path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let acc = "";
  const itemListElement = segments.map((segment, index) => {
    acc += `/${segment}`;
    const isLast = index === segments.length - 1;
    const cleanSegment = segment.replace(/\.html$/, "");
    const name = isLast
      ? normalize(page.title) || formatSegment(cleanSegment)
      : formatSegment(cleanSegment);
    const segmentPath = isLast ? page.path : `${acc}/`;

    return {
      "@type": "ListItem",
      position: index + 1,
      name,
      item: buildPathUrl(hostname, segmentPath),
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
};

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

  const focus = [...categories, ...tags, ...headers]
    .filter(Boolean)
    .slice(0, 4);

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

  if (existingDescription.length >= 90)
    return trimDescription(existingDescription);
  if (page.path === "/") return HOME_DESCRIPTION;

  const title = normalize(page.title);
  const focusText = buildFocusText(page);
  const bodyText = normalize(
    page.data?.excerpt ?? page.contentRendered ?? page.content ?? "",
  ).slice(0, 110);

  // 栏目首页（目录页）：用完整路径层级补齐主题，描述更准确
  if (isSectionIndex(page) && !bodyText) {
    const topic = getPathTopic(page.path);
    return trimDescription(
      normalize(
        [
          title ? `${title}。` : "",
          topic ? `属于「${topic}」知识域。` : "",
          focusText,
          "这里按知识主线组织面试高频点，尽量讲清概念边界、项目取舍、常见误区和追问方向。",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    );
  }

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
    headers?: { title?: string }[];
  },
  hostname: string,
  authorName: string,
): void => {
  const description = buildSeoDescription(page as never);
  const url = buildPathUrl(hostname, page.path);

  page.frontmatter.description = description;

  const pushJsonLd = (data: Record<string, unknown>): void => {
    head.push([
      "script",
      { type: "application/ld+json" },
      JSON.stringify(data),
    ]);
  };

  if (page.path === "/") {
    pushJsonLd({
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
    });
    return;
  }

  // 所有非首页都输出面包屑，利于搜索引擎富摘要
  const breadcrumb = buildBreadcrumb(hostname, page);
  if (breadcrumb) pushJsonLd(breadcrumb);

  // 栏目首页（目录页）输出 CollectionPage
  if (isSectionIndex(page)) {
    pushJsonLd({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: normalize(page.title) || getPathTopic(page.path) || SITE_TITLE,
      url,
      inLanguage: "zh-CN",
      description,
      isPartOf: {
        "@type": "WebSite",
        name: SITE_TITLE,
        url: hostname,
      },
    });
    return;
  }

  const article =
    page.frontmatter.article === true || page.frontmatter.timeline === true;

  if (!article) return;

  pushJsonLd({
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
  });
};
