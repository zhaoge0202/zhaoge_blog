#!/usr/bin/env node
// 私有笔记泄漏检查：确认公开构建产物 dist/ 里没有任何 src/private/ 的痕迹。
//
// 为什么要这一步：私有笔记靠 pagePatterns 的 `!private/**` 排除，属于「配置正确才安全」。
// 一旦有人改了 pagePatterns、换了构建入口、或者拿 dev 目录直接打包上传，
// 私密内容就会静默出现在公开站上。这里在 build 末尾做一次硬校验：
//   1) dist/private/ 目录整体不存在；
//   2) 每个私有 md 的预期路由（/private/xxx.html）在 dist/ 里不存在；
//   3) dist/ 的文本产物（html / js / json / xml / txt）里都不出现私有笔记的 title
//      —— sidebar 会被序列化进 app-*.js，只查 HTML 抓不到这类泄漏。
// 没有 src/private/（CI、克隆到新机器）时直接跳过，不阻塞别人的构建。
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PRIVATE_DIR = path.resolve("src/private");
const DIST_DIR = path.resolve(process.env.PRIVATE_DIST || "dist");
const TITLE_MIN_LENGTH = 4;

const exists = async (target) => {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
};

const walkMarkdown = async (dir) => {
  const files = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }

  return files;
};

const TEXT_EXTENSIONS = new Set([".html", ".js", ".json", ".xml", ".txt"]);

const walkTextFiles = async (dir) => {
  const files = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkTextFiles(full)));
    } else if (
      entry.isFile() &&
      TEXT_EXTENSIONS.has(path.extname(entry.name))
    ) {
      files.push(full);
    }
  }

  return files;
};

const readTitle = async (filePath) => {
  const content = await readFile(filePath, "utf8");
  const matched = content.match(/^title:\s*["']?(.+?)["']?\s*$/mu);

  return matched?.[1]?.trim();
};

/** src/private/a/b.md -> private/a/b.html；src/private/a/README.md -> private/a/index.html */
const toRoutePath = (absolutePath) => {
  const relative = path
    .relative(PRIVATE_DIR, absolutePath)
    .split(path.sep)
    .join("/");

  return relative.endsWith("README.md")
    ? `private/${relative.slice(0, -"README.md".length)}index.html`
    : `private/${relative.replace(/\.md$/u, ".html")}`;
};

const main = async () => {
  if (!(await exists(PRIVATE_DIR))) {
    console.log("[leak-check] 没有 src/private/，跳过。");
    return;
  }

  if (!(await exists(DIST_DIR))) {
    console.log(
      `[leak-check] ${path.relative(process.cwd(), DIST_DIR)} 不存在，跳过。`,
    );
    return;
  }

  const problems = [];

  if (await exists(path.join(DIST_DIR, "private"))) {
    problems.push(
      `构建产物里出现了 ${path.join(path.relative(process.cwd(), DIST_DIR), "private")}/ 目录`,
    );
  }

  const privateFiles = await walkMarkdown(PRIVATE_DIR);
  const routes = privateFiles.map(toRoutePath);

  for (const route of routes) {
    if (await exists(path.join(DIST_DIR, route))) {
      problems.push(`私有路由被打进了产物：${route}`);
    }
  }

  const titles = (
    await Promise.all(privateFiles.map((file) => readTitle(file)))
  ).filter((title) => title && title.length >= TITLE_MIN_LENGTH);

  if (titles.length > 0) {
    const textFiles = await walkTextFiles(DIST_DIR);

    for (const textFile of textFiles) {
      const content = await readFile(textFile, "utf8");
      for (const title of titles) {
        if (content.includes(title)) {
          problems.push(
            `产物 ${path.relative(DIST_DIR, textFile)} 出现了私有笔记标题「${title}」`,
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error("[leak-check] 私有内容泄漏，已中断构建：");
    for (const problem of [...new Set(problems)])
      console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(
    `[leak-check] 通过：${privateFiles.length} 篇私有笔记均未进入 ${path.relative(process.cwd(), DIST_DIR)}/。`,
  );
};

await main();
