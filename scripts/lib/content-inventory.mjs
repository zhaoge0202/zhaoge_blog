import fs from "node:fs";
import path from "node:path";

// 内容目录之外不算「可路由页面」：.vuepress 是配置，node_modules/dist 是生成物。
const IGNORED_DIRECTORIES = new Set([".vuepress", "node_modules", "dist"]);

// 下划线开头或 *.snippet.md 是被 include 引入的片段，不是独立页面，不进内容清单。
const isPartial = (fileName) =>
  fileName.startsWith("_") || fileName.endsWith(".snippet.md");

const toPosix = (value) => value.replaceAll(path.sep, "/");

/**
 * 扫描 src/ 下所有「可路由 Markdown 页面」，返回相对仓库根、按字典序排好的 posix 路径。
 * 这是内容清单的唯一事实来源：tests 拿它跟提交进仓库的快照比对，
 * scripts/update-content-manifest.mjs 拿它生成快照。
 */
export const collectPublishedMarkdown = (repoRoot) => {
  const contentRoot = path.join(repoRoot, "src");
  const files = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        walk(absolutePath);
        continue;
      }

      if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !isPartial(entry.name)
      ) {
        files.push(toPosix(path.relative(repoRoot, absolutePath)));
      }
    }
  };

  walk(contentRoot);

  return files.sort();
};

export const MANIFEST_RELATIVE_PATH = "tests/content-manifest.json";

export const readContentManifest = (repoRoot) => {
  const manifestPath = path.join(repoRoot, MANIFEST_RELATIVE_PATH);
  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw);

  return Array.isArray(parsed.files) ? parsed.files : [];
};

export const serializeContentManifest = (files) =>
  `${JSON.stringify(
    {
      $comment:
        "自动生成的内容清单快照，请勿手改。新增/删除笔记后运行 `npm run manifest:update` 刷新。",
      count: files.length,
      files,
    },
    null,
    2,
  )}\n`;
