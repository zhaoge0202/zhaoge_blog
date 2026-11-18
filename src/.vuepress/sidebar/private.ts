import fs from "node:fs";
import path from "node:path";

// 用 cwd 而不是 import.meta.url：结构测试会把 sidebar 打包成 data: 模块再 import，
// 那时 import.meta.url 不再是文件路径，fileURLToPath 会抛 ERR_INVALID_URL_SCHEME。
// 构建与测试都在仓库根执行，cwd 即仓库根；取不到目录时按「没有私有笔记」处理。
const repoRoot = process.cwd();

// 私有笔记目录（src/private/ 已写进 .gitignore）。它只存在于本地：
// CI 上没有这个目录，privateSidebar() 返回空对象，于是侧边栏、内容清单、
// 结构测试全都看不到这些笔记，公开构建产物里也不会出现，线上自然搜不到、也访问不到。
//
// 目录结构自由：既可以平铺 `src/private/xxx.md`，也可以按主题分子目录
// `src/private/<主题>/xxx.md`，子目录会自动变成可折叠的侧边栏分组。
const PRIVATE_DIR = path.resolve(repoRoot, "src/private");

// 公开构建里必须彻底不出现私有笔记：sidebar 会被序列化进客户端 bundle（app-*.js），
// 只要条目还在，标题和链接就会跟着发到线上，哪怕对应页面根本没被构建。
// 所以这里再上一道闸：非私有构建 + production 直接返回空对象。
const isPrivateBuild = process.env.VUEPRESS_PRIVATE === "1";
const isPublicBuild = process.env.NODE_ENV === "production" && !isPrivateBuild;

type SidebarItem = {
  text: string;
  link?: string;
  collapsible?: boolean;
  expanded?: boolean;
  children?: SidebarItem[];
};

const readTitle = (filePath: string): string => {
  const content = fs.readFileSync(filePath, "utf8");
  const matched = content.match(/^title:\s*["']?(.+?)["']?\s*$/mu);

  return matched?.[1] ?? path.basename(filePath, ".md");
};

/** 子目录分组标题：优先取目录下 README.md 的 title，没有就用目录名。 */
const readDirTitle = (dirPath: string, fallback: string): string => {
  const readme = path.join(dirPath, "README.md");

  return fs.existsSync(readme) ? readTitle(readme) : fallback;
};

const byChineseName = (a: string, b: string): number =>
  a.localeCompare(b, "zh-Hans-CN");

/**
 * 递归收集私有笔记，生成侧边栏条目。
 *
 * - `_开头`、`.` 开头的文件/目录视为草稿或附件，不进侧边栏（仍可在 dev 里直接访问 URL）；
 * - 目录内 README.md 作为分组标题，不单独成页；
 * - link 用相对 `/private/` 的路径，VuePress 会按 sidebar key 自动补前缀。
 */
const buildTree = (dir: string, prefix: string): SidebarItem[] => {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => !entry.name.startsWith(".") && !entry.name.startsWith("_"),
    );

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(byChineseName);

  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "README.md",
    )
    .map((entry) => entry.name)
    .sort(byChineseName);

  const dirItems: SidebarItem[] = directories
    .map((name) => {
      const dirPath = path.join(dir, name);

      return {
        text: readDirTitle(dirPath, name),
        collapsible: true,
        expanded: false,
        children: buildTree(dirPath, `${prefix}${name}/`),
      };
    })
    // 空目录（只有草稿或 README）不占位
    .filter((item) => (item.children?.length ?? 0) > 0);

  const fileItems: SidebarItem[] = files.map((name) => ({
    text: readTitle(path.join(dir, name)),
    link: `${prefix}${name.replace(/\.md$/u, "")}`,
  }));

  return [...dirItems, ...fileItems];
};

/**
 * 本地私有笔记的侧边栏分组。
 *
 * 目录不存在或为空时返回空对象 —— 这正是 CI 与公开构建的行为，
 * 所以私有笔记不会进入 nav / sidebar / 内容清单 / 搜索索引。
 */
export const privateSidebar = (): Record<string, unknown[]> => {
  if (isPublicBuild) return {};
  if (!fs.existsSync(PRIVATE_DIR)) return {};

  const tree = buildTree(PRIVATE_DIR, "");

  if (tree.length === 0) return {};

  return { "/private/": tree };
};
