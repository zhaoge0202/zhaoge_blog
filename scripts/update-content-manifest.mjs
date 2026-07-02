import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MANIFEST_RELATIVE_PATH,
  collectPublishedMarkdown,
  serializeContentManifest,
} from "./lib/content-inventory.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const manifestPath = path.join(repoRoot, MANIFEST_RELATIVE_PATH);

const files = collectPublishedMarkdown(repoRoot);
const nextContent = serializeContentManifest(files);
const prevContent = fs.existsSync(manifestPath)
  ? fs.readFileSync(manifestPath, "utf8")
  : "";

if (prevContent === nextContent) {
  console.log(
    `内容清单已是最新：${files.length} 篇（${MANIFEST_RELATIVE_PATH}）`,
  );
} else {
  fs.writeFileSync(manifestPath, nextContent);
  console.log(
    `已刷新内容清单：${files.length} 篇 -> ${MANIFEST_RELATIVE_PATH}`,
  );
}
