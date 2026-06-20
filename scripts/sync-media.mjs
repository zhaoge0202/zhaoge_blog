#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  collectMarkdownTargets,
  getMissingConfigFields,
  loadConfigFile,
  parseCliArguments,
  resolveRuntimeConfig,
} from "./lib/media-sync-cli.mjs";
import {
  buildVersionedObjectKey,
  syncMarkdownFile,
} from "./lib/media-sync.mjs";

const DEFAULT_CONFIG_PATH = ".media-sync.json";
const MIME_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".bmp", "image/bmp"],
  [".ico", "image/x-icon"],
  [".avif", "image/avif"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".ogg", "audio/ogg"],
  [".m4a", "audio/mp4"],
  [".aac", "audio/aac"],
  [".flac", "audio/flac"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".m4v", "video/x-m4v"],
  [".avi", "video/x-msvideo"],
  [".mkv", "video/x-matroska"],
  [".pdf", "application/pdf"],
  [".zip", "application/zip"],
  [".rar", "application/vnd.rar"],
  [".7z", "application/x-7z-compressed"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [
    ".pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  [".doc", "application/msword"],
  [
    ".docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  [".xls", "application/vnd.ms-excel"],
  [
    ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
]);

function printHelp() {
  console.log(`Usage: npm run media:sync -- [target] [--config path] [--dry-run]

target:
  Markdown file or directory to scan. Defaults to src

options:
  --config   Path to the local JSON config file. Defaults to .media-sync.json
  --dry-run  Resolve uploads and rewrites without modifying Markdown files
  --help     Show this message
`);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPublicUrl(publicBaseUrl, objectKey) {
  return `${publicBaseUrl.replace(/\/+$/u, "")}/${objectKey.replace(/^\/+/u, "")}`;
}

function guessContentType(filePath) {
  return (
    MIME_TYPES.get(path.extname(filePath).toLowerCase()) ||
    "application/octet-stream"
  );
}

function createVersionResolver({ client, bucket }) {
  const nextVersionCache = new Map();

  return async ({ keyPrefix, date, originalName }) => {
    const seedKey = buildVersionedObjectKey({
      keyPrefix,
      date,
      version: 0,
      originalName,
    });
    const directory = path.posix.dirname(seedKey);
    const filename = path.posix.basename(seedKey);
    const matched = filename.match(
      /^(?<compactDate>\d{8})-v000-(?<stem>.+)(?<extension>\.[^.]+)$/u,
    );

    if (!matched?.groups) {
      throw new Error(`Unable to derive version prefix for ${originalName}`);
    }

    const signature = `${directory}/${matched.groups.compactDate}-${matched.groups.stem}${matched.groups.extension}`;

    if (nextVersionCache.has(signature)) {
      const nextVersion = nextVersionCache.get(signature);
      nextVersionCache.set(signature, nextVersion + 1);
      return nextVersion;
    }

    const objectPrefix = `${directory}/${matched.groups.compactDate}-v`;
    const versionPattern = new RegExp(
      `^${escapeRegExp(
        matched.groups.compactDate,
      )}-v(?<version>\\d{3})-${escapeRegExp(matched.groups.stem)}${escapeRegExp(
        matched.groups.extension,
      )}$`,
      "u",
    );
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: objectPrefix,
      }),
    );

    const maxVersion = (response.Contents ?? []).reduce((currentMax, item) => {
      const objectName = path.posix.basename(item.Key ?? "");
      const match = objectName.match(versionPattern);

      if (!match?.groups?.version) {
        return currentMax;
      }

      return Math.max(currentMax, Number(match.groups.version));
    }, 0);
    const nextVersion = maxVersion + 1;

    nextVersionCache.set(signature, nextVersion + 1);
    return nextVersion;
  };
}

function createUploader({ client, bucket, publicBaseUrl, dryRun }) {
  const uploadedByAbsolutePath = new Map();

  return async ({ absolutePath, objectKey }) => {
    const cachedUpload = uploadedByAbsolutePath.get(absolutePath);

    if (cachedUpload) {
      return cachedUpload;
    }

    const uploadResult = {
      objectKey,
      publicUrl: buildPublicUrl(publicBaseUrl, objectKey),
    };

    if (!dryRun) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: createReadStream(absolutePath),
          ContentType: guessContentType(absolutePath),
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    }

    uploadedByAbsolutePath.set(absolutePath, uploadResult);
    return uploadResult;
  };
}

async function maybeLoadFileConfig(configPath) {
  const exists = await fileExists(configPath);

  if (!exists) {
    if (configPath === DEFAULT_CONFIG_PATH) {
      return {};
    }

    throw new Error(`Config file not found: ${configPath}`);
  }

  return loadConfigFile(configPath);
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const fileConfig = await maybeLoadFileConfig(args.configPath);
  const runtimeConfig = resolveRuntimeConfig({
    fileConfig,
    env: process.env,
  });
  const missingFields = getMissingConfigFields(runtimeConfig);

  if (missingFields.length) {
    throw new Error(
      `Missing media sync config fields: ${missingFields.join(", ")}`,
    );
  }

  const targets = await collectMarkdownTargets(args.target ?? "src");

  if (!targets.length) {
    console.log("No Markdown files found for media sync.");
    return;
  }

  const runDate = new Date();
  const s3Client = new S3Client({
    region: runtimeConfig.region,
    endpoint: runtimeConfig.endpoint,
    credentials: {
      accessKeyId: runtimeConfig.accessKeyId,
      secretAccessKey: runtimeConfig.secretAccessKey,
    },
  });
  const getNextVersion = createVersionResolver({
    client: s3Client,
    bucket: runtimeConfig.bucket,
  });
  const uploadMedia = createUploader({
    client: s3Client,
    bucket: runtimeConfig.bucket,
    publicBaseUrl: runtimeConfig.publicBaseUrl,
    dryRun: args.dryRun,
  });

  let touchedFiles = 0;
  let rewrittenReferences = 0;
  let uploadedCount = 0;

  for (const target of targets) {
    const result = await syncMarkdownFile(target, {
      config: {
        keyPrefix: runtimeConfig.keyPrefix,
        publicBaseUrl: runtimeConfig.publicBaseUrl,
        date: runDate,
      },
      getNextVersion,
      uploadMedia,
      writeChanges: !args.dryRun,
    });

    if (!result.replacements.length) {
      continue;
    }

    touchedFiles += 1;
    rewrittenReferences += result.replacements.length;
    uploadedCount += result.uploadedCount;

    console.log(
      `${args.dryRun ? "[dry-run] " : ""}${path.relative(
        process.cwd(),
        target,
      )}: ${result.uploadedCount} uploads, ${result.replacements.length} rewrites`,
    );
  }

  console.log(
    `${args.dryRun ? "Dry run complete" : "Media sync complete"}: ${touchedFiles} files, ${rewrittenReferences} rewritten references, ${uploadedCount} uploads`,
  );
}

main().catch((error) => {
  console.error(`[media-sync] ${error.message}`);
  process.exitCode = 1;
});
