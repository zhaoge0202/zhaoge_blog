#!/usr/bin/env node
// 私有站产物后处理：给 dist-private/ 补上「别被搜索引擎收录」的两件套。
//
// 私有站是靠自己加访问控制（Cloudflare Access 等）来挡人的，但万一哪天规则配错、
// 或者产物被顺手传到别的地方，robots 与 X-Robots-Tag 还能兜一层：
//   - robots.txt：Disallow: /，常规爬虫不再抓；
//   - _headers：Cloudflare Pages / Netlify 会读，任何响应都带 noindex。
// 真正的访问控制不在这里，这里只负责「别被索引」。
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DIST = path.resolve(process.env.PRIVATE_DIST || "dist-private");

const ROBOTS = `# 私有站：整站禁止抓取
User-agent: *
Disallow: /
`;

const HEADERS = `/*
  X-Robots-Tag: noindex, nofollow, noarchive
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
`;

await mkdir(DIST, { recursive: true });
await writeFile(path.join(DIST, "robots.txt"), ROBOTS, "utf8");
await writeFile(path.join(DIST, "_headers"), HEADERS, "utf8");

console.log(
  `[private-site] 已写入 ${path.relative(process.cwd(), DIST)}/robots.txt 与 _headers`,
);
