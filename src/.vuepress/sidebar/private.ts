import fs from "node:fs";
import path from "node:path";

// 用 cwd 而不是 import.meta.url：结构测试会把 sidebar 打包成 data: 模块再 import，
// 那时 import.meta.url 不再是文件路径，fileURLToPath 会抛 ERR_INVALID_URL_SCHEME。
// 构建与测试都在仓库根执行，cwd 即仓库根；取不到目录时按「没有私有笔记」处理。
const repoRoot = process.cwd();

// 私有笔记目录（src/private/ 已写进 .gitignore）。它只存在于本地：
// CI 上没有这个目录，collectPrivateSidebar() 返回空对象，于是侧边栏、内容清单、
// 结构测试全都看不到这些笔记，构建产物里也不会出现，线上自然搜不到、也访问不到。
const PRIVATE_DIR = path.resolve(repoRoot, "src/private");

const readTitle = (filePath: string): string => {
  const content = fs.readFileSync(filePath, "utf8");
  const matched = content.match(/^title:\s*["']?(.+?)["']?\s*$/mu);

  return matched?.[1] ?? path.basename(filePath, ".md");
};

const listPrivatePages = (): { text: string; link: string }[] => {
  if (!fs.existsSync(PRIVATE_DIR)) return [];

  return fs
    .readdirSync(PRIVATE_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !entry.name.startsWith("_") &&
        entry.name !== "README.md",
    )
    .map((entry) => ({
      text: readTitle(path.join(PRIVATE_DIR, entry.name)),
      link: entry.name.replace(/\.md$/u, ""),
    }))
    .sort((a, b) => a.text.localeCompare(b.text, "zh-Hans-CN"));
};

/**
 * 本地私有笔记的侧边栏分组。
 *
 * 目录不存在时返回空对象 —— 这正是 CI 与线上构建的行为，
 * 所以私有笔记不会进入 nav / sidebar / 内容清单 / 搜索索引。
 */
export const privateSidebar = (): Record<string, unknown[]> => {
  const pages = listPrivatePages();

  if (pages.length === 0) return {};

  return {
    "/private/": [
      {
        text: "私人笔记（仅本地）",
        collapsible: false,
        children: pages,
      },
    ],
  };
};
