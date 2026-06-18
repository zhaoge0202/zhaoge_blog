import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".bmp",
  ".ico",
  ".avif",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".pdf",
  ".zip",
  ".rar",
  ".7z",
  ".ppt",
  ".pptx",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

const MARKDOWN_MEDIA_REGEX =
  /(?<prefix>!?\[[^\]]*]\()(?<target>[^)]+)(?<suffix>\))/dg;
const HTML_MEDIA_REGEX =
  /<(?<tag>img|audio|video|source)\b[^>]*\bsrc=(?<quote>["'])(?<src>[^"']+)\k<quote>[^>]*>/dgi;

export function isLocalMediaPath(rawPath) {
  if (!rawPath) {
    return false;
  }

  const value = rawPath.trim();

  if (!value || value.startsWith("#") || value.startsWith("/")) {
    return false;
  }

  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);
}

function getPathExtension(rawPath) {
  return path.posix.extname(rawPath.split(/[?#]/, 1)[0]).toLowerCase();
}

function isSupportedMediaReference(rawPath) {
  return MEDIA_EXTENSIONS.has(getPathExtension(rawPath));
}

function extractMarkdownPath(target) {
  const leadingWhitespaceLength = target.match(/^\s*/u)?.[0].length ?? 0;
  const trimmedTarget = target.slice(leadingWhitespaceLength);

  if (!trimmedTarget) {
    return null;
  }

  if (trimmedTarget.startsWith("<")) {
    const closingIndex = trimmedTarget.indexOf(">");

    if (closingIndex <= 1) {
      return null;
    }

    return {
      rawPath: trimmedTarget.slice(1, closingIndex),
      startOffset: leadingWhitespaceLength + 1,
      endOffset: leadingWhitespaceLength + closingIndex,
    };
  }

  const whitespaceIndex = trimmedTarget.search(/\s/u);
  const endOffset =
    whitespaceIndex === -1 ? trimmedTarget.length : whitespaceIndex;

  return {
    rawPath: trimmedTarget.slice(0, endOffset),
    startOffset: leadingWhitespaceLength,
    endOffset: leadingWhitespaceLength + endOffset,
  };
}

export function findMediaReferences(markdown) {
  const references = [];

  for (const match of markdown.matchAll(MARKDOWN_MEDIA_REGEX)) {
    const targetIndices = match.indices.groups.target;
    const extracted = extractMarkdownPath(match.groups.target);

    if (!extracted) {
      continue;
    }

    if (
      !isLocalMediaPath(extracted.rawPath) ||
      !isSupportedMediaReference(extracted.rawPath)
    ) {
      continue;
    }

    references.push({
      kind: "markdown",
      rawPath: extracted.rawPath,
      pathStart: targetIndices[0] + extracted.startOffset,
      pathEnd: targetIndices[0] + extracted.endOffset,
    });
  }

  for (const match of markdown.matchAll(HTML_MEDIA_REGEX)) {
    const srcIndices = match.indices.groups.src;
    const rawPath = match.groups.src;

    if (!isLocalMediaPath(rawPath) || !isSupportedMediaReference(rawPath)) {
      continue;
    }

    references.push({
      kind: "html",
      rawPath,
      pathStart: srcIndices[0],
      pathEnd: srcIndices[1],
    });
  }

  return references.sort((left, right) => left.pathStart - right.pathStart);
}

export function rewriteMarkdownContent(markdown, references, replacementMap) {
  let rewritten = markdown;

  for (const reference of [...references].sort(
    (left, right) => right.pathStart - left.pathStart,
  )) {
    const replacement = replacementMap[reference.rawPath];

    if (!replacement) {
      continue;
    }

    rewritten =
      rewritten.slice(0, reference.pathStart) +
      replacement +
      rewritten.slice(reference.pathEnd);
  }

  return rewritten;
}

function sanitizeFileName(originalName) {
  const parsedName = path.parse(originalName);
  const extension = parsedName.ext.toLowerCase();
  const stem = parsedName.name;
  const normalizedStem = stem
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  return {
    stem: normalizedStem || "file",
    extension,
  };
}

function formatDateParts(date) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return {
    year,
    month,
    day,
    compactDate: `${year}${month}${day}`,
  };
}

export function buildVersionedObjectKey({
  keyPrefix = "blog",
  date = new Date(),
  version,
  originalName,
}) {
  const { year, month, day, compactDate } = formatDateParts(date);
  const { stem, extension } = sanitizeFileName(originalName);
  const paddedVersion = String(version).padStart(3, "0");

  return path.posix.join(
    keyPrefix,
    year,
    month,
    day,
    `${compactDate}-v${paddedVersion}-${stem}${extension}`,
  );
}

async function ensureReadableFile(filePath) {
  await access(filePath);
}

function resolveLocalPath(markdownFilePath, rawPath) {
  const decodedPath = decodeURI(rawPath);
  return path.resolve(path.dirname(markdownFilePath), decodedPath);
}

function joinPublicUrl(publicBaseUrl, objectKey) {
  return `${publicBaseUrl.replace(/\/+$/u, "")}/${objectKey.replace(/^\/+/u, "")}`;
}

export async function syncMarkdownFile(
  markdownFilePath,
  { config, getNextVersion, uploadMedia, writeChanges = true },
) {
  const markdown = await readFile(markdownFilePath, "utf8");
  const references = findMediaReferences(markdown);

  if (!references.length) {
    return {
      filePath: markdownFilePath,
      replacements: [],
      uploadedCount: 0,
    };
  }

  const uploadedByAbsolutePath = new Map();
  const replacementMap = {};
  const replacements = [];

  for (const reference of references) {
    const absolutePath = resolveLocalPath(markdownFilePath, reference.rawPath);
    await ensureReadableFile(absolutePath);

    let uploaded = uploadedByAbsolutePath.get(absolutePath);

    if (!uploaded) {
      const version = await getNextVersion({
        keyPrefix: config.keyPrefix,
        date: config.date,
        originalName: path.basename(absolutePath),
      });
      const objectKey = buildVersionedObjectKey({
        keyPrefix: config.keyPrefix,
        date: config.date,
        version,
        originalName: path.basename(absolutePath),
      });

      uploaded = await uploadMedia({
        absolutePath,
        objectKey,
        publicBaseUrl: config.publicBaseUrl,
      });

      uploaded = {
        objectKey: uploaded.objectKey ?? objectKey,
        publicUrl:
          uploaded.publicUrl ?? joinPublicUrl(config.publicBaseUrl, objectKey),
      };
      uploadedByAbsolutePath.set(absolutePath, uploaded);
    }

    replacementMap[reference.rawPath] = uploaded.publicUrl;
    replacements.push({
      ...reference,
      absolutePath,
      objectKey: uploaded.objectKey,
      publicUrl: uploaded.publicUrl,
    });
  }

  const rewritten = rewriteMarkdownContent(markdown, references, replacementMap);

  if (writeChanges && rewritten !== markdown) {
    await writeFile(markdownFilePath, rewritten, "utf8");
  }

  return {
    filePath: markdownFilePath,
    replacements,
    uploadedCount: uploadedByAbsolutePath.size,
    rewrittenContent: rewritten,
  };
}
