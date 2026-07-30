#!/usr/bin/env node
// Upload site-wide static assets (favicon / og-image / logo / etc.) to the R2
// media CDN, so they are served from media.zhaoge.top and never stored in git.
//
// Reuses the same R2 config the markdown media-sync script uses (.media-sync.json,
// gitignored). Each file is stored under a date-versioned key consistent with the
// markdown media convention: <keyPrefix>/<YYYY>/<MM>/<DD>/<YYYYMMDD>-v001-<name>.
//
// Usage:
//   node scripts/upload-site-assets.mjs <file1> [file2 ...]
//
// Prints the public URL for each uploaded file. Safe to commit: no secrets live
// here, they are read from .media-sync.json at runtime.

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const MIME_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".avif", "image/avif"],
]);

const contentType = (filePath) =>
  MIME_TYPES.get(path.extname(filePath).toLowerCase()) ??
  "application/octet-stream";

const pad = (value) => String(value).padStart(2, "0");

function todayUtc() {
  const now = new Date();
  const y = now.getUTCFullYear();
  return {
    y,
    m: pad(now.getUTCMonth() + 1),
    d: pad(now.getUTCDate()),
    compact: `${y}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`,
  };
}

async function loadConfig() {
  const cfg = JSON.parse(await readFile(".media-sync.json", "utf8"));
  const required = [
    "bucket",
    "endpoint",
    "accessKeyId",
    "secretAccessKey",
    "publicBaseUrl",
    "keyPrefix",
  ];
  const missing = required.filter((key) => !cfg[key]);
  if (missing.length) {
    throw new Error(
      `Missing config fields in .media-sync.json: ${missing.join(", ")}`,
    );
  }
  return cfg;
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error(
      "Usage: node scripts/upload-site-assets.mjs <file1> [file2 ...]",
    );
    process.exit(1);
  }

  const cfg = await loadConfig();
  const client = new S3Client({
    region: cfg.region || "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  const { y, m, d, compact } = todayUtc();
  const base = cfg.publicBaseUrl.replace(/\/+$/, "");

  const results = [];
  for (const file of files) {
    const name = path.basename(file);
    const objectKey = `${cfg.keyPrefix}/${y}/${m}/${d}/${compact}-v001-${name}`;
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
        Body: createReadStream(file),
        ContentType: contentType(file),
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const url = `${base}/${objectKey}`;
    results.push({ file, objectKey, url });
    console.log(`uploaded ${file}\n  -> ${url}`);
  }

  console.log(`\n${results.length} asset(s) uploaded.`);
}

main().catch((error) => {
  console.error(`[upload-site-assets] ${error.message}`);
  process.exitCode = 1;
});
