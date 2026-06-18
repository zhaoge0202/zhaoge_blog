import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseCliArguments,
  resolveRuntimeConfig,
} from "../scripts/lib/media-sync-cli.mjs";
import {
  buildVersionedObjectKey,
  findMediaReferences,
  isLocalMediaPath,
  rewriteMarkdownContent,
  syncMarkdownFile,
} from "../scripts/lib/media-sync.mjs";

test("isLocalMediaPath only accepts relative local paths", () => {
  assert.equal(isLocalMediaPath("./images/diagram.png"), true);
  assert.equal(isLocalMediaPath("../audio/intro.mp3"), true);
  assert.equal(isLocalMediaPath("https://media.zhaoge.top/a.png"), false);
  assert.equal(isLocalMediaPath("data:image/png;base64,aaa"), false);
  assert.equal(isLocalMediaPath("#section-1"), false);
  assert.equal(isLocalMediaPath("/assets/logo.png"), false);
});

test("findMediaReferences extracts local markdown and html media paths", () => {
  const markdown = `
![diagram](./images/diagram.png)
[slides](./files/slides.pdf)
[doc](./README.md)
<img src="./images/inline.png" alt="inline" />
<source src="../media/voice.mp3" />
`;

  assert.deepEqual(
    findMediaReferences(markdown).map((item) => item.rawPath),
    [
      "./images/diagram.png",
      "./files/slides.pdf",
      "./images/inline.png",
      "../media/voice.mp3",
    ],
  );
});

test("rewriteMarkdownContent replaces every matched path with a CDN URL", () => {
  const markdown = `
![diagram](./images/diagram.png)
<img src="./images/diagram.png" alt="inline" />
`;

  const references = findMediaReferences(markdown);
  const rewritten = rewriteMarkdownContent(markdown, references, {
    "./images/diagram.png": "https://media.zhaoge.top/blog/2026/06/18/20260618-v001-diagram.png",
  });

  assert.match(rewritten, /https:\/\/media\.zhaoge\.top\/blog\/2026\/06\/18\/20260618-v001-diagram\.png/);
  assert.equal(rewritten.includes("./images/diagram.png"), false);
});

test("buildVersionedObjectKey creates dated keys with a version prefix", () => {
  const key = buildVersionedObjectKey({
    keyPrefix: "blog",
    date: new Date("2026-06-18T10:30:00Z"),
    version: 3,
    originalName: "System Design Diagram.PNG",
  });

  assert.equal(
    key,
    "blog/2026/06/18/20260618-v003-system-design-diagram.png",
  );
});

test("syncMarkdownFile uploads local media once and rewrites the markdown file", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "media-sync-"));
  const articleDir = path.join(tempDir, "src", "journey");
  const imageDir = path.join(articleDir, "images");
  const articlePath = path.join(articleDir, "2026-06-18-note.md");
  const imagePath = path.join(imageDir, "diagram.png");

  await mkdir(imageDir, { recursive: true });
  await writeFile(imagePath, "png-bytes");
  await writeFile(
    articlePath,
    `![diagram](./images/diagram.png)\n\n<img src="./images/diagram.png" alt="inline" />\n`,
  );

  const uploaded = [];
  const result = await syncMarkdownFile(articlePath, {
    config: {
      keyPrefix: "blog",
      publicBaseUrl: "https://media.zhaoge.top",
      date: new Date("2026-06-18T10:30:00Z"),
    },
    getNextVersion: async () => 1,
    uploadMedia: async ({ absolutePath, objectKey }) => {
      uploaded.push({ absolutePath, objectKey });
      return {
        objectKey,
        publicUrl: `https://media.zhaoge.top/${objectKey}`,
      };
    },
  });

  const rewritten = await readFile(articlePath, "utf8");

  assert.equal(uploaded.length, 1);
  assert.equal(result.replacements.length, 2);
  assert.match(
    rewritten,
    /https:\/\/media\.zhaoge\.top\/blog\/2026\/06\/18\/20260618-v001-diagram\.png/,
  );
  assert.equal(rewritten.includes("./images/diagram.png"), false);
});

test("syncMarkdownFile leaves the markdown untouched when upload fails", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "media-sync-"));
  const articleDir = path.join(tempDir, "src", "journey");
  const imageDir = path.join(articleDir, "images");
  const articlePath = path.join(articleDir, "2026-06-18-note.md");
  const imagePath = path.join(imageDir, "diagram.png");
  const original = `![diagram](./images/diagram.png)\n`;

  await mkdir(imageDir, { recursive: true });
  await writeFile(imagePath, "png-bytes");
  await writeFile(articlePath, original);

  await assert.rejects(
    syncMarkdownFile(articlePath, {
      config: {
        keyPrefix: "blog",
        publicBaseUrl: "https://media.zhaoge.top",
        date: new Date("2026-06-18T10:30:00Z"),
      },
      getNextVersion: async () => 1,
      uploadMedia: async () => {
        throw new Error("upload failed");
      },
    }),
    /upload failed/,
  );

  assert.equal(await readFile(articlePath, "utf8"), original);
});

test("syncMarkdownFile can skip writing when running in dry-run mode", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "media-sync-"));
  const articleDir = path.join(tempDir, "src", "journey");
  const imageDir = path.join(articleDir, "images");
  const articlePath = path.join(articleDir, "2026-06-18-note.md");
  const imagePath = path.join(imageDir, "diagram.png");
  const original = `![diagram](./images/diagram.png)\n`;

  await mkdir(imageDir, { recursive: true });
  await writeFile(imagePath, "png-bytes");
  await writeFile(articlePath, original);

  const result = await syncMarkdownFile(articlePath, {
    config: {
      keyPrefix: "blog",
      publicBaseUrl: "https://media.zhaoge.top",
      date: new Date("2026-06-18T10:30:00Z"),
    },
    writeChanges: false,
    getNextVersion: async () => 1,
    uploadMedia: async ({ objectKey }) => ({
      objectKey,
      publicUrl: `https://media.zhaoge.top/${objectKey}`,
    }),
  });

  assert.equal(result.replacements.length, 1);
  assert.equal(await readFile(articlePath, "utf8"), original);
});

test("parseCliArguments reads the target, config path, and dry-run flag", () => {
  assert.deepEqual(
    parseCliArguments([
      "src/journey/2026-06-18-note.md",
      "--config",
      ".media-sync.local.json",
      "--dry-run",
    ]),
    {
      target: "src/journey/2026-06-18-note.md",
      configPath: ".media-sync.local.json",
      dryRun: true,
      help: false,
    },
  );
});

test("resolveRuntimeConfig prefers environment secrets over file placeholders", () => {
  assert.deepEqual(
    resolveRuntimeConfig({
      fileConfig: {
        bucket: "zhaogepersonal",
        endpoint: "https://example.r2.cloudflarestorage.com",
        accessKeyId: "placeholder-key",
        secretAccessKey: "placeholder-secret",
        publicBaseUrl: "https://media.zhaoge.top",
        keyPrefix: "blog",
        region: "auto",
      },
      env: {
        R2_MEDIA_SYNC_ACCESS_KEY_ID: "env-key",
        R2_MEDIA_SYNC_SECRET_ACCESS_KEY: "env-secret",
      },
    }),
    {
      bucket: "zhaogepersonal",
      endpoint: "https://example.r2.cloudflarestorage.com",
      accessKeyId: "env-key",
      secretAccessKey: "env-secret",
      publicBaseUrl: "https://media.zhaoge.top",
      keyPrefix: "blog",
      region: "auto",
    },
  );
});
