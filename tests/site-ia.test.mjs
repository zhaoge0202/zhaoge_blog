import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const exists = (relativePath) =>
  fs.existsSync(path.join(repoRoot, relativePath));

const readJson = (relativePath) => JSON.parse(read(relativePath));

const sidebarVirtualRoutes = new Set([
  "/category/",
  "/tag/",
  "/article/",
  "/timeline/",
  "/star/",
]);

const markdownFrontmatterFields = [
  "title",
  "description",
  "breadcrumb",
  "article",
  "editLink",
  "category",
  "tag",
];

const posixJoin = (...parts) =>
  parts.join("/").replace(/\/+/g, "/").replace(/^\.\//, "");

const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, "");

const collectMarkdownFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if ([".vuepress", "node_modules", "dist"].includes(entry.name)) continue;
      files.push(...collectMarkdownFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(
        path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/"),
      );
    }
  }

  return files.sort();
};

const parseFrontmatter = (content) => {
  if (!content.startsWith("---\n")) return {};

  const end = content.indexOf("\n---", 4);
  if (end === -1) return {};

  const frontmatter = {};
  const lines = content.slice(4, end).split("\n");
  const parseInlineObject = (value) => {
    const objectValue = {};
    const pairPattern = /(\w+):\s*(?:"([^"]*)"|'([^']*)'|([^,}]+))/g;
    let match;

    while ((match = pairPattern.exec(value)) !== null) {
      objectValue[match[1]] = (match[2] ?? match[3] ?? match[4]).trim();
    }

    return objectValue;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z][\w-]*):(?:\s*(.*))?$/);
    if (!match) continue;

    const [, key, rawValue = ""] = match;
    const value = rawValue.trim();

    if (value === "") {
      if (lines[index + 1]?.match(/^\s+-\s+/)) {
        const values = [];

        while (lines[index + 1]?.match(/^\s+-\s+/)) {
          index += 1;
          values.push(
            lines[index]
              .replace(/^\s+-\s+/, "")
              .trim()
              .replace(/^["']|["']$/g, ""),
          );
        }

        frontmatter[key] = values;
        continue;
      }

      if (lines[index + 1]?.match(/^\s+\w+:/)) {
        const values = {};

        while (lines[index + 1]?.match(/^\s+\w+:/)) {
          index += 1;
          const nested = lines[index].match(/^\s+(\w+):\s*(.*)$/);
          if (nested) {
            values[nested[1]] = nested[2].trim().replace(/^["']|["']$/g, "");
          }
        }

        frontmatter[key] = values;
        continue;
      }

      if (lines[index + 1]?.match(/^\s+\{/)) {
        const objectLines = [];

        while (lines[index + 1] && !lines[index + 1].match(/^\s*\}\s*$/)) {
          index += 1;
          objectLines.push(lines[index].trim());
        }

        if (lines[index + 1]?.match(/^\s*\}\s*$/)) index += 1;

        frontmatter[key] = parseInlineObject(objectLines.join(" "));
        continue;
      }
    }

    if (value.startsWith("{") && value.endsWith("}")) {
      frontmatter[key] = parseInlineObject(value);
      continue;
    }

    frontmatter[key] = value.replace(/^["']|["']$/g, "");
  }

  return frontmatter;
};

const loadSidebar = async () => {
  const sidebarEntry = path.join(repoRoot, "src/.vuepress/sidebar.ts");
  const result = await build({
    entryPoints: [sidebarEntry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const code = result.outputFiles[0].text;
  const encoded = Buffer.from(code).toString("base64");
  const module = await import(`data:text/javascript;base64,${encoded}`);

  return module.default;
};

const resolveSidebarLink = (basePath, prefix, value) => {
  const link = typeof value === "string" ? value : value.link;

  if (link === undefined || /^(?:https?:)?\/\//.test(link)) return undefined;

  const withoutHash = link.split("#")[0];
  if (!withoutHash) {
    return `src/${posixJoin(trimSlashes(basePath), prefix)}README.md`;
  }

  if (withoutHash.endsWith(".html")) {
    const pagePath = `src/${trimSlashes(withoutHash).replace(/\.html$/, ".md")}`;
    const indexPath = `src/${trimSlashes(withoutHash).replace(
      /\.html$/,
      "/README.md",
    )}`;

    return exists(pagePath) ? pagePath : indexPath;
  }

  if (withoutHash.endsWith(".md")) {
    return `src/${trimSlashes(withoutHash)}`;
  }

  const route = withoutHash.startsWith("/")
    ? trimSlashes(withoutHash)
    : posixJoin(trimSlashes(basePath), prefix, withoutHash);

  return withoutHash.endsWith("/")
    ? `src/${route}/README.md`
    : `src/${route}.md`;
};

const collectSidebarReferences = (sidebar) => {
  const references = [];

  const walk = (basePath, items, prefix = "") => {
    for (const item of items) {
      if (typeof item === "string") {
        const relativePath = resolveSidebarLink(basePath, prefix, item);
        if (relativePath) references.push(relativePath);
        continue;
      }

      if (!item || typeof item !== "object") continue;

      const relativePath = resolveSidebarLink(basePath, prefix, item);
      if (relativePath) references.push(relativePath);

      if (Array.isArray(item.children)) {
        walk(basePath, item.children, posixJoin(prefix, item.prefix ?? ""));
      }
    }
  };

  for (const [basePath, items] of Object.entries(sidebar)) {
    if (sidebarVirtualRoutes.has(basePath)) continue;
    walk(basePath, items);
  }

  return [...new Set(references)].sort();
};

const resolveSiteLink = (fromRelativePath, link) => {
  if (!link || /^(?:https?:)?\/\//.test(link) || link.startsWith("mailto:")) {
    return undefined;
  }

  const withoutHash = link.split("#")[0];
  if (!withoutHash) return undefined;

  if (withoutHash.endsWith(".html")) {
    const pagePath = `src/${trimSlashes(withoutHash).replace(/\.html$/, ".md")}`;
    const indexPath = `src/${trimSlashes(withoutHash).replace(
      /\.html$/,
      "/README.md",
    )}`;

    return exists(pagePath) ? pagePath : indexPath;
  }

  if (withoutHash.startsWith("/")) {
    const route = trimSlashes(withoutHash);
    if (route.endsWith(".html")) {
      const pagePath = `src/${route.replace(/\.html$/, ".md")}`;
      const indexPath = `src/${route.replace(/\.html$/, "/README.md")}`;

      return exists(pagePath) ? pagePath : indexPath;
    }

    return withoutHash.endsWith("/")
      ? `src/${route}/README.md`
      : `src/${route.replace(/\.md$/, "")}.md`;
  }

  const fromDir = path.posix.dirname(fromRelativePath);
  const route = path.posix.normalize(path.posix.join(fromDir, withoutHash));

  return route.endsWith("/")
    ? `${route}README.md`
    : route.replace(/\.html$/, ".md");
};

test("navbar exposes domain-first knowledge sections and a separate blog entry", () => {
  const navbar = read("src/.vuepress/navbar.ts");

  for (const label of [
    "面试准备",
    "Java",
    "数据库",
    "系统设计",
    "工具实践",
    "博客",
  ]) {
    assert.match(navbar, new RegExp(label));
  }

  for (const legacyLabel of ["专题", "题库", "心路历程"]) {
    assert.doesNotMatch(navbar, new RegExp(legacyLabel));
  }
});

test("new domain entry pages exist", () => {
  for (const relativePath of [
    "src/interview-preparation/README.md",
    "src/java/README.md",
    "src/database/README.md",
    "src/system-design/README.md",
    "src/tools/README.md",
    "src/blog/README.md",
  ]) {
    assert.equal(exists(relativePath), true, `${relativePath} should exist`);
  }
});

test("core content is migrated into java/database/blog paths", () => {
  for (const relativePath of [
    "src/java/concurrent/README.md",
    "src/java/concurrent/java-concurrency-basics.md",
    "src/java/concurrent/java-concurrency-jmm.md",
    "src/java/concurrent/java-concurrency-volatile.md",
    "src/java/concurrent/java-concurrency-synchronized.md",
    "src/java/concurrent/java-concurrency-cas.md",
    "src/java/concurrent/java-concurrency-reentrantlock.md",
    "src/java/concurrent/java-concurrency-thread-pool.md",
    "src/java/concurrent/java-concurrency-threadlocal.md",
    "src/java/concurrent/java-concurrency-concurrent-collections.md",
    "src/java/concurrent/java-concurrency-completablefuture.md",
    "src/java/concurrent/java-concurrency-virtual-thread.md",
    "src/java/jvm/README.md",
    "src/java/jvm/jvm-g1-vs-cms.md",
    "src/database/mysql/README.md",
    "src/database/mysql/mysql-architecture-sql-execution.md",
    "src/database/mysql/mysql-innodb-vs-myisam.md",
    "src/database/mysql/mysql-row-format.md",
    "src/database/mysql/mysql-data-page.md",
    "src/database/mysql/mysql-buffer-pool.md",
    "src/database/mysql/mysql-why-bplus-tree.md",
    "src/database/mysql/mysql-index-design.md",
    "src/database/mysql/mysql-index-invalidation.md",
    "src/database/mysql/mysql-explain.md",
    "src/database/mysql/mysql-count.md",
    "src/database/mysql/mysql-transaction-isolation.md",
    "src/database/mysql/mysql-mvcc-read-view.md",
    "src/database/mysql/mysql-locks.md",
    "src/database/mysql/mysql-lock-rules.md",
    "src/database/mysql/mysql-deadlock.md",
    "src/database/mysql/mysql-logs.md",
    "src/database/mysql/mysql-replication.md",
    "src/database/mysql/mysql-schema-design.md",
    "src/database/mysql/mysql-time-and-primary-key.md",
    "src/database/mysql/mysql-auto-increment.md",
    "src/database/redis/README.md",
    "src/database/redis/redis-cache-consistency.md",
    "src/database/redis/redis-bigkey-hotkey.md",
    "src/database/redis/redis-blocking-troubleshooting.md",
    "src/database/redis/redis-special-data-structures.md",
    "src/database/redis/redis-typical-scenarios.md",
    "src/database/redis/redis-memory-fragmentation.md",
    "src/database/redis/redis-configuration-tuning.md",
    "src/database/redis/redis-monitoring-metrics.md",
    "src/database/redis/redis-bloom-filter.md",
    "src/database/redis/redis-cluster-operations.md",
    "src/database/redis/redis-replication-troubleshooting.md",
    "src/database/redis/redis-cluster-details.md",
    "src/database/redis/redis-pipeline-lua.md",
    "src/database/redis/redis-rate-limiting.md",
    "src/database/redis/redis-message-queue.md",
    "src/database/redis/redis-delayed-task.md",
    "src/database/sql/README.md",
    "src/database/sql/sql-execution-order.md",
    "src/database/sql/sql-groupby-aggregate.md",
    "src/database/sql/sql-join.md",
    "src/database/sql/sql-subquery.md",
    "src/database/sql/sql-set-operations.md",
    "src/database/sql/sql-window-functions.md",
    "src/database/sql/sql-null-and-case.md",
    "src/database/sql/sql-pagination.md",
    "src/database/sql/sql-writing-best-practices.md",
    "src/database/elasticsearch/README.md",
    "src/database/elasticsearch/es-core-concepts.md",
    "src/database/elasticsearch/es-inverted-index.md",
    "src/database/elasticsearch/es-analyzer.md",
    "src/database/elasticsearch/es-mapping.md",
    "src/database/elasticsearch/es-query-dsl.md",
    "src/database/elasticsearch/es-scoring.md",
    "src/database/elasticsearch/es-aggregation.md",
    "src/database/elasticsearch/es-shard-replica.md",
    "src/database/elasticsearch/es-read-write-flow.md",
    "src/database/elasticsearch/es-deep-pagination-tuning.md",
    "src/database/mongodb/README.md",
    "src/database/mongodb/mongodb-data-model.md",
    "src/database/mongodb/mongodb-index-query.md",
    "src/database/mongodb/mongodb-aggregation-pipeline.md",
    "src/database/mongodb/mongodb-replica-sharding.md",
    "src/blog/essays/2026-06-16-note-1.md",
    "src/blog/practice/2026-06-18-r2-media-sync-tutorial.md",
  ]) {
    assert.equal(exists(relativePath), true, `${relativePath} should exist`);
  }
});

test("sidebar is modularized behind the stable compatibility entry", () => {
  const sidebarEntry = read("src/.vuepress/sidebar.ts");
  const sidebarIndex = read("src/.vuepress/sidebar/index.ts");

  assert.match(
    sidebarEntry,
    /export \{ default \} from "\.\/sidebar\/index\.js"/,
  );
  assert.match(sidebarIndex, /knowledgeSidebar/);
  assert.match(sidebarIndex, /navigationSidebar/);
  assert.equal(exists("src/.vuepress/sidebar/knowledge.ts"), true);
  assert.equal(exists("src/.vuepress/sidebar/navigation.ts"), true);
});

test("sidebar references resolve to existing markdown files", async () => {
  const sidebar = await loadSidebar();
  const references = collectSidebarReferences(sidebar);

  assert.ok(
    references.includes("src/java/concurrent/java-concurrency-thread-pool.md"),
  );
  assert.ok(references.includes("src/database/mysql/mysql-locks.md"));
  assert.ok(
    references.includes("src/database/redis/redis-cache-consistency.md"),
  );
  assert.ok(references.includes("src/database/sql/sql-window-functions.md"));
  assert.ok(references.includes("src/database/elasticsearch/es-query-dsl.md"));
  assert.ok(references.includes("src/database/mongodb/mongodb-data-model.md"));

  for (const relativePath of references) {
    assert.equal(exists(relativePath), true, `${relativePath} should exist`);
  }
});

test("public markdown files are discoverable from sidebar", async () => {
  const sidebar = await loadSidebar();
  const references = new Set(collectSidebarReferences(sidebar));
  const allowedOrphans = new Set([
    "src/README.md",
    "src/database/mysql/_article-footer.snippet.md",
  ]);
  const markdownFiles = collectMarkdownFiles(path.join(repoRoot, "src"));

  for (const relativePath of markdownFiles) {
    if (allowedOrphans.has(relativePath)) continue;
    assert.equal(
      references.has(relativePath),
      true,
      `${relativePath} should be reachable from sidebar`,
    );
  }
});

test("sidebar article frontmatter keeps required note fields", async () => {
  const sidebar = await loadSidebar();
  const references = collectSidebarReferences(sidebar).filter(
    (relativePath) =>
      !relativePath.endsWith("/README.md") &&
      !relativePath.startsWith("src/blog/"),
  );

  for (const relativePath of references) {
    const frontmatter = parseFrontmatter(read(relativePath));

    for (const field of markdownFrontmatterFields) {
      assert.ok(
        Object.hasOwn(frontmatter, field),
        `${relativePath} frontmatter should include ${field}`,
      );
    }

    assert.equal(
      Array.isArray(frontmatter.category),
      true,
      `${relativePath} category should be a YAML array`,
    );
    assert.equal(
      Array.isArray(frontmatter.tag),
      true,
      `${relativePath} tag should be a YAML array`,
    );
  }
});

test("article prev and next links point to existing markdown files", async () => {
  const sidebar = await loadSidebar();
  const references = collectSidebarReferences(sidebar).filter(
    (relativePath) =>
      !relativePath.endsWith("/README.md") &&
      !relativePath.startsWith("src/blog/"),
  );

  for (const relativePath of references) {
    const frontmatter = parseFrontmatter(read(relativePath));

    for (const field of ["prev", "next"]) {
      assert.ok(
        frontmatter[field]?.link,
        `${relativePath} frontmatter should include ${field}.link`,
      );
      assert.equal(
        typeof frontmatter[field].link,
        "string",
        `${relativePath} frontmatter ${field}.link should be a string`,
      );

      const target = resolveSiteLink(relativePath, frontmatter[field].link);
      assert.equal(
        exists(target),
        true,
        `${relativePath} ${field}.link should resolve to ${target}`,
      );
    }
  }
});

test("home page links point to new domain and blog entries instead of legacy sections", () => {
  const home = read("src/README.md");

  for (const link of [
    "/interview-preparation/",
    "/java/",
    "/database/",
    "/blog/",
  ]) {
    assert.match(home, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const legacyLink of ["/topics/", "/questions/", "/journey/"]) {
    assert.doesNotMatch(
      home,
      new RegExp(legacyLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("theme overrides slimsearch custom fields with plain string formatters", () => {
  const theme = read("src/.vuepress/theme.ts");

  assert.doesNotMatch(theme, /search:\s*false/);
  assert.match(theme, /slimsearch:\s*\{/);
  assert.match(theme, /customFields:\s*\[/);
  assert.match(theme, /const toSlimsearchFieldValue =/);
  assert.match(
    theme,
    /getter:\s*\(page\)\s*=>\s*toSlimsearchFieldValue\(page\.frontmatter\.category\)/,
  );
  assert.match(
    theme,
    /getter:\s*\(page\)\s*=>\s*toSlimsearchFieldValue\(page\.frontmatter\.tag\)/,
  );
  assert.match(theme, /formatter:\s*"分类: \$content"/);
  assert.match(theme, /formatter:\s*"标签: \$content"/);
});

test("theme config enables richer markdown and blog intro capabilities", () => {
  const theme = read("src/.vuepress/theme.ts");

  for (const snippet of [
    "codeTabs: true",
    "mermaid: true",
    "gfm: true",
    "tasklist: true",
    'intro: "/about-the-author/"',
    "medias:",
  ]) {
    assert.match(
      theme,
      new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.match(theme, /include:\s*\{/);
  assert.match(theme, /const includeBaseDir = cwd \?\? __dirname/);
  assert.match(theme, /return path\.resolve\(includeBaseDir, file\)/);
});

test("site config and theme expose SEO and JSON-LD hooks", () => {
  const theme = read("src/.vuepress/theme.ts");
  const config = read("src/.vuepress/config.ts");

  assert.match(theme, /seo:\s*\{/);
  assert.match(theme, /canonical:/);
  assert.match(theme, /jsonLd:/);
  assert.match(theme, /customHead:/);
  assert.match(config, /mobile-web-app-capable/);
  assert.doesNotMatch(config, /apple-mobile-web-app-capable/);
});

test("about author page and immersive mode client files exist", () => {
  for (const relativePath of [
    "src/about-the-author/README.md",
    "src/.vuepress/client.ts",
    "src/.vuepress/components/DeferredLayoutToggle.vue",
  ]) {
    assert.equal(exists(relativePath), true, `${relativePath} should exist`);
  }

  const styles = read("src/.vuepress/styles/index.scss");
  assert.match(styles, /html\.layout-hidden/);
});

test("package manifest includes runtime support for search and mermaid features", () => {
  const pkg = readJson("package.json");

  assert.equal(
    pkg.devDependencies?.["@vuepress/plugin-slimsearch"] !== undefined,
    true,
    "package.json should include @vuepress/plugin-slimsearch",
  );
  assert.equal(
    pkg.devDependencies?.mermaid !== undefined ||
      pkg.dependencies?.mermaid !== undefined,
    true,
    "package.json should include mermaid",
  );
});

test("client enhancements keep lazy mermaid aliasing without duplicate component registration", () => {
  const client = read("src/.vuepress/client.ts");
  const config = read("src/.vuepress/config.ts");

  for (const snippet of [
    "ClickImagePreview",
    "router.onError",
    "CHUNK_LOAD_ERROR_PATTERN",
  ]) {
    assert.match(
      client,
      new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.doesNotMatch(client, /app\.component\("Mermaid",\s*LazyMermaid\)/);
  assert.match(config, /realMermaidComponentPath/);
  assert.match(config, /lazyMermaidComponentPath/);
  assert.match(config, /"@site\/real-mermaid"/);

  for (const relativePath of [
    "src/.vuepress/components/ClickImagePreview.vue",
    "src/.vuepress/components/LazyMermaid.vue",
  ]) {
    assert.equal(exists(relativePath), true, `${relativePath} should exist`);
  }
});

test("search modal styles disable heavy backdrop blur and long open animations", () => {
  const styles = read("src/.vuepress/styles/index.scss");

  for (const snippet of [
    ".slimsearch-mask",
    "backdrop-filter: none",
    "-webkit-backdrop-filter: none",
    ".slimsearch-modal",
    "animation: none",
  ]) {
    assert.match(
      styles,
      new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});
