#!/usr/bin/env node
// 搜索索引后处理：修中文分词 + 裁掉正文倒排。
//
// 为什么要在产物上动手：
// 1) @vuepress/plugin-slimsearch 建索引时把 `fields: ["h","t","c"]` 硬编码在 indexOptions
//    展开之后，插件选项无法覆盖。笔记没有 <!-- more --> 标记时 page.data.excerpt 等于整篇
//    正文，于是正文被塞进 t 字段并参与倒排 —— 376 篇正文产生 18611 个 term、索引 8.4MB
//    （gzip 2.9MB），用户点开搜索要等好几秒。
// 2) 索引端用 Intl.Segmenter 分词，worker 端却用默认规则（按空白标点切）再整体做前缀匹配，
//    两边不一致 —— 中文双字以上词几乎全部命中不了（"分布式锁""线程池""可重复读"都是 0 条）。
//
// 这里做三件事，都在 worker 产物上完成：
//   a. 删掉倒排表里 t 字段的 posting（fieldId 1），term 从 18611 降到 3918；
//   b. 把 storedFields.t 截断（只留前 2 段、每段 120 字）。t 已不参与倒排，只用于结果摘要，
//      截断不影响搜索质量，却省掉 1.7MB 的正文原文；
//   c. 注入与索引端一致的 Segmenter 分词，并把多词组合从 or 改成 and（or 会让切出来的单字
//      匹配全站，出现"不存在的词"也返回几百条的情况）。
//
// 任一替换点找不到就报错退出，避免插件升级后静默失效。
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");
const WORKER = path.join(DIST, "slimsearch.worker.js");

const SEGMENTER_TOKENIZE =
  "(_q,_f)=>_f===`id`?[_q]:[...new Intl.Segmenter(`zh-CN`,{granularity:`word`}).segment(_q)].map(_x=>_x.segment).filter(_x=>_x.trim())";

const ORIGINAL_OPTIONS = "{fields:[`h`,`t`,`c`],storeFields:[`h`,`t`,`c`]}";
const PATCHED_OPTIONS = `{fields:[\`h\`,\`t\`,\`c\`],storeFields:[\`h\`,\`t\`,\`c\`],searchOptions:{combineWith:\`and\`},tokenize:${SEGMENTER_TOKENIZE}}`;

// 默认只索引标题与 heading；设为 1 时保留正文倒排（能搜到只出现在正文里的词，代价是索引约 3MB gzip）
const KEEP_CONTENT = process.env.SEARCH_INDEX_CONTENT === "1";

const SECTION_LIMIT = 2;
const SECTION_CHARS = 120;

const fail = (msg) => {
  console.error(`[search-worker] ${msg}`);
  process.exit(1);
};

const code = await readFile(WORKER, "utf-8");

// 幂等：已经处理过的产物直接跳过（重复执行、或 build 未重建 worker 时）
if (code.includes(SEGMENTER_TOKENIZE)) {
  console.log("[search-worker] 已优化过，跳过");
  process.exit(0);
}

// 1. 取出注入的索引（双重 JSON.stringify 的结果）
const injected = code.match(/JSON\.parse\(("(?:[^"\\]|\\.)*")\)/s);
if (!injected) fail("未找到索引注入点，插件结构可能已变更");
const rawIndex = injected[1];

const locales = JSON.parse(JSON.parse(rawIndex));
if (typeof locales !== "object" || locales === null) fail("索引结构异常");

let removedTerms = 0;
let totalTermsBefore = 0;
let lengthsBefore = 0;
let lengthsAfter = 0;

for (const locale of Object.keys(locales)) {
  const index = locales[locale];
  if (!Array.isArray(index.index)) fail(`locale ${locale} 缺少倒排表`);

  totalTermsBefore += index.index.length;
  lengthsBefore += JSON.stringify(index).length;

  // a. 删掉 t 字段（fieldId 1）的 posting；只被正文用到的 term 会整体消失。
  //    设 SEARCH_INDEX_CONTENT=1 可保留正文倒排（召回更全，体积回到约 3MB gzip）。
  if (!KEEP_CONTENT) {
    const kept = [];
    for (const [term, postings] of index.index) {
      const next = {};
      for (const [fieldId, docs] of Object.entries(postings)) {
        if (fieldId === "1") continue;
        next[fieldId] = docs;
      }
      if (Object.keys(next).length > 0) kept.push([term, next]);
      else removedTerms += 1;
    }
    index.index = kept;
  }

  // b. 截断摘要：只在结果里展示，不进倒排
  if (index.storedFields && !KEEP_CONTENT) {
    for (const section of Object.values(index.storedFields)) {
      if (!Array.isArray(section.t)) continue;
      section.t = section.t
        .slice(0, SECTION_LIMIT)
        .map((text) =>
          text.length > SECTION_CHARS
            ? `${text.slice(0, SECTION_CHARS)}…`
            : text,
        );
    }
  }

  lengthsAfter += JSON.stringify(index).length;
}

// 2. 写回：保持双重 stringify 的原始形态
const nextRaw = JSON.stringify(JSON.stringify(locales));
let out = code.replace(rawIndex, () => nextRaw);

// 3. 注入分词与组合策略
if (!out.includes(ORIGINAL_OPTIONS))
  fail("未找到 worker 索引反序列化点，插件结构可能已变更");
out = out.replace(ORIGINAL_OPTIONS, PATCHED_OPTIONS);

await writeFile(WORKER, out);

const mb = (n) => `${(n / 1048576).toFixed(2)}MB`;
console.log(
  [
    "[search-worker] 索引优化完成",
    KEEP_CONTENT
      ? "  正文倒排:  已保留（SEARCH_INDEX_CONTENT=1）"
      : `  term:      ${totalTermsBefore} -> ${totalTermsBefore - removedTerms}（删掉 ${removedTerms} 个只出现在正文里的词）`,
    `  索引体积:  ${mb(lengthsBefore)} -> ${mb(lengthsAfter)}（未压缩）`,
    `  摘要截断:  每段最多 ${SECTION_LIMIT} 段 × ${SECTION_CHARS} 字`,
    "  已注入:    Intl.Segmenter 分词 + combineWith=and",
  ].join("\n"),
);
