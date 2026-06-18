import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const ENV_FIELD_MAP = {
  bucket: "R2_MEDIA_SYNC_BUCKET",
  endpoint: "R2_MEDIA_SYNC_ENDPOINT",
  accessKeyId: "R2_MEDIA_SYNC_ACCESS_KEY_ID",
  secretAccessKey: "R2_MEDIA_SYNC_SECRET_ACCESS_KEY",
  publicBaseUrl: "R2_MEDIA_SYNC_PUBLIC_BASE_URL",
  keyPrefix: "R2_MEDIA_SYNC_KEY_PREFIX",
  region: "R2_MEDIA_SYNC_REGION",
};

export function parseCliArguments(argv) {
  const result = {
    target: undefined,
    configPath: ".media-sync.json",
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      result.help = true;
      continue;
    }

    if (argument === "--dry-run") {
      result.dryRun = true;
      continue;
    }

    if (argument === "--config") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("--config requires a file path");
      }

      result.configPath = nextValue;
      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (result.target) {
      throw new Error("Only one target path is supported per run");
    }

    result.target = argument;
  }

  return result;
}

export function resolveRuntimeConfig({
  fileConfig = {},
  env = process.env,
} = {}) {
  const merged = {};

  for (const [field, envName] of Object.entries(ENV_FIELD_MAP)) {
    const envValue = env[envName];

    merged[field] =
      envValue && String(envValue).trim()
        ? String(envValue).trim()
        : fileConfig[field];
  }

  if (!merged.keyPrefix) {
    merged.keyPrefix = "blog";
  }

  if (!merged.region) {
    merged.region = "auto";
  }

  return merged;
}

export function getMissingConfigFields(config) {
  return [
    "bucket",
    "endpoint",
    "accessKeyId",
    "secretAccessKey",
    "publicBaseUrl",
    "keyPrefix",
    "region",
  ].filter((field) => !config[field]);
}

export async function loadConfigFile(configPath) {
  const content = await readFile(configPath, "utf8");
  return JSON.parse(content);
}

async function walkMarkdownFiles(targetPath, collected) {
  const targetStats = await stat(targetPath);

  if (targetStats.isFile()) {
    if (targetPath.endsWith(".md")) {
      collected.push(path.resolve(targetPath));
    }
    return collected;
  }

  if (!targetStats.isDirectory()) {
    return collected;
  }

  const entries = await readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const nextPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await walkMarkdownFiles(nextPath, collected);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      collected.push(path.resolve(nextPath));
    }
  }

  return collected;
}

export async function collectMarkdownTargets(targetPath = "src") {
  const files = await walkMarkdownFiles(targetPath, []);
  return files.sort();
}
