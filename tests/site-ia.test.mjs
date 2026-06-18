import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const exists = (relativePath) =>
  fs.existsSync(path.join(repoRoot, relativePath));

const readJson = (relativePath) =>
  JSON.parse(read(relativePath));

test("navbar exposes domain-first knowledge sections and a separate blog entry", () => {
  const navbar = read("src/.vuepress/navbar.ts");

  for (const label of ["面试准备", "Java", "数据库", "系统设计", "工具实践", "博客"]) {
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
    "src/java/concurrent/java-concurrency-thread-pool.md",
    "src/java/jvm/README.md",
    "src/java/jvm/jvm-g1-vs-cms.md",
    "src/database/mysql/README.md",
    "src/database/mysql/mysql-mvcc-read-view.md",
    "src/database/redis/README.md",
    "src/database/redis/redis-cache-consistency.md",
    "src/blog/essays/2026-06-16-note-1.md",
    "src/blog/practice/2026-06-18-r2-media-sync-tutorial.md",
  ]) {
    assert.equal(exists(relativePath), true, `${relativePath} should exist`);
  }
});

test("home page links point to new domain and blog entries instead of legacy sections", () => {
  const home = read("src/README.md");

  for (const link of ["/interview-preparation/", "/java/", "/database/", "/blog/"]) {
    assert.match(home, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const legacyLink of ["/topics/", "/questions/", "/journey/"]) {
    assert.doesNotMatch(home, new RegExp(legacyLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("theme overrides slimsearch custom fields with plain string formatters", () => {
  const theme = read("src/.vuepress/theme.ts");

  assert.doesNotMatch(theme, /search:\s*false/);
  assert.match(theme, /slimsearch:\s*\{/);
  assert.match(theme, /customFields:\s*\[/);
  assert.match(theme, /const toSlimsearchFieldValue =/);
  assert.match(theme, /getter:\s*\(page\)\s*=>\s*toSlimsearchFieldValue\(page\.frontmatter\.category\)/);
  assert.match(theme, /getter:\s*\(page\)\s*=>\s*toSlimsearchFieldValue\(page\.frontmatter\.tag\)/);
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
    assert.match(theme, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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
    pkg.devDependencies?.mermaid !== undefined || pkg.dependencies?.mermaid !== undefined,
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
    assert.match(client, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(
    client,
    /app\.component\("Mermaid",\s*LazyMermaid\)/,
  );
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
    assert.match(styles, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
