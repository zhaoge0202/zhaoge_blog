#!/usr/bin/env node
// 关键 CSS 内联后处理：对 dist/**/*.html 用 critters 抽取首屏关键 CSS 内联进 <style>，
// 剩余 CSS 改为 media="print" onload 异步加载，消除 ~490ms 渲染阻塞、改善 FCP/LCP。
// 通过 publicPath 适配任意 base（/ 或 /zhaoge_blog/），无需软链。
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import Critters from "critters";

const distDir = path.resolve("dist");
const publicPath = process.env.VUEPRESS_BASE || "/";

async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtml(full);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      yield full;
    }
  }
}

function hasStylesheet(html) {
  return /<link[^>]+rel=["']stylesheet["']/i.test(html);
}

// critters 处理同一份 CSS 时每次都会重新读取磁盘；这里缓存文件内容，444 页共享一份 CSS 读取结果。
async function main() {
  const cssCache = new Map();
  const critters = new Critters({
    path: distDir,
    publicPath,
    preload: "media", // 剩余 CSS：media="print" onload=>all，不依赖 JS polyfill
    noscriptFallback: false, // 异步 swap 本就依赖 JS，noscript 兜底也是 print-only，移除以保持 HTML 干净
    pruneSource: false, // 不改 CSS 源文件，保持 R2/边缘缓存与内容完整
    reduceInlineStyles: false, // 保留内联样式，避免改动 SSR 已确定的呈现
    logLevel: "warn",
    fs: {
      readFile: (filename, cb) => {
        const cached = cssCache.get(filename);
        if (cached !== undefined) {
          cb(null, cached);
          return;
        }
        readFile(filename, "utf8")
          .then((data) => {
            cssCache.set(filename, data);
            cb(null, data);
          })
          .catch((err) => cb(err));
      },
    },
  });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const t0 = Date.now();

  for await (const file of walkHtml(distDir)) {
    const rel = path.relative(distDir, file);
    let html;
    try {
      html = await readFile(file, "utf8");
    } catch {
      skipped += 1;
      continue;
    }
    if (!hasStylesheet(html)) {
      skipped += 1;
      continue;
    }
    try {
      const out = await critters.process(html);
      if (out && out !== html) {
        await writeFile(file, out);
        processed += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      // 任何单页失败都回退到原 HTML（渲染阻塞仍在，但不破坏部署）
      console.warn(`[critters] skip ${rel}: ${err.message}`);
      failed += 1;
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[critters] critical CSS inlined: ${processed} ok, ${skipped} skipped, ${failed} failed in ${dt}s`,
  );
}

main().catch((err) => {
  console.error("[critters] fatal:", err);
  // 不让后处理失败阻断构建：CSS 仍按原渲染阻塞方式工作，只是少了优化
  process.exitCode = 0;
});
