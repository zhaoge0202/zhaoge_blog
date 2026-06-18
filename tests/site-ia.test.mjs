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
