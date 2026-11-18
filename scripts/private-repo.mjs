#!/usr/bin/env node
// 私有笔记的版本仓库（嵌套在 src/private/ 里的独立 git 仓）。
//
// 主仓库把 src/private/ 整个忽略掉，所以它没有历史、没有远端、误删就没了。
// 这个脚本给私人抽屉补上「自己的 git」：
//   - 嵌套仓库放在 src/private/.git，外仓库看不见它，也不会产生 submodule gitlink；
//   - 远端是一个独立的 **私有** GitHub 仓库，地址来自本地 .private-repo.json；
//   - 推送走 SSH（本机已配置好），不碰主仓库的任何 remote。
//
// 用法：
//   node scripts/private-repo.mjs init       初始化 + 建私有远端 + 首次推送
//   node scripts/private-repo.mjs save       提交并推送当前改动（默认备份信息）
//   node scripts/private-repo.mjs status     看有无未提交改动、和远端差几个提交
//   node scripts/private-repo.mjs pull       拉取远端（rebase，避免多机器冲突）
//   node scripts/private-repo.mjs clone      新机器上把私有仓库拉进 src/private/
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO = path.resolve("src/private");
const REMOTE_NAME = process.env.PRIVATE_REMOTE_NAME || "origin";

// 私有远端不写死在代码里：主仓库是公开的，仓库名跟着一起公开就等于把
// 「这个人有一份私有笔记仓」摆在明面上。本地配置放 .private-repo.json（已 gitignore），
// 字段照抄 .private-repo.example.json；也可以用 PRIVATE_REPO 环境变量覆盖。
const CONFIG_FILE = path.resolve(".private-repo.json");
const config = fs.existsSync(CONFIG_FILE)
  ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"))
  : {};
const PRIVATE_REPO = process.env.PRIVATE_REPO || config.name || "";
const PRIVATE_REMOTE_URL =
  config.remote || (PRIVATE_REPO ? `git@github.com:${PRIVATE_REPO}.git` : "");

const requireRemoteConfig = () => {
  if (PRIVATE_REMOTE_URL) return true;

  console.error(
    "[private-repo] 没有配置私有远端：把 .private-repo.example.json 复制成 .private-repo.json，" +
      "填上 name（owner/repo）后重试；或设置 PRIVATE_REPO 环境变量。",
  );
  return false;
};

const DEFAULT_IGNORE = `# 私有笔记仓库自己的忽略规则
.DS_Store
*.tmp
*.log
.obsidian/
`;

const run = (args, { cwd = REPO, capture = false } = {}) =>
  execFileSync("git", args, {
    cwd,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });

const tryRun = (args, options) => {
  try {
    return run(args, { ...options, capture: true }).trim();
  } catch {
    return "";
  }
};

const hasGitRepo = () => fs.existsSync(path.join(REPO, ".git"));
const hasRemote = (name) => tryRun(["remote", "get-url", name]) !== "";

const ensureDir = () => {
  if (!fs.existsSync(REPO)) {
    fs.mkdirSync(REPO, { recursive: true });
    console.log(`[private-repo] 已创建 ${path.relative(process.cwd(), REPO)}/`);
  }
};

const ensureIgnore = () => {
  const ignoreFile = path.join(REPO, ".gitignore");

  if (!fs.existsSync(ignoreFile)) {
    fs.writeFileSync(ignoreFile, DEFAULT_IGNORE, "utf8");
    console.log("[private-repo] 已创建 src/private/.gitignore");
  }
};

const ensureRepo = () => {
  ensureDir();

  if (!hasGitRepo()) {
    run(["init", "-b", "main"]);
    console.log("[private-repo] 已初始化嵌套仓库 src/private/.git");
  }

  ensureIgnore();
};

const commitIfDirty = (message) => {
  const dirty = tryRun(["status", "--porcelain"]);

  if (!dirty) {
    console.log("[private-repo] 没有改动，跳过提交。");
    return false;
  }

  run(["add", "-A"]);
  run(["commit", "-m", message]);
  return true;
};

const remoteExistsOnGitHub = () => {
  try {
    execFileSync("gh", ["repo", "view", PRIVATE_REPO, "--json", "visibility"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
};

const createRemoteRepo = () => {
  console.log(`[private-repo] 在 GitHub 上创建私有仓库 ${PRIVATE_REPO} …`);
  execFileSync(
    "gh",
    [
      "repo",
      "create",
      PRIVATE_REPO,
      "--private",
      "--description",
      "私有笔记（src/private）备份：不进公开站、不进公开构建",
      "--disable-issues",
      "--disable-wiki",
    ],
    { stdio: "inherit" },
  );
};

const ensureRemote = () => {
  if (hasRemote(REMOTE_NAME)) {
    console.log(
      `[private-repo] 远端 ${REMOTE_NAME} 已存在：${tryRun(["remote", "get-url", REMOTE_NAME])}`,
    );
    return;
  }

  if (!requireRemoteConfig()) return;

  if (!remoteExistsOnGitHub()) {
    createRemoteRepo();
  }

  run(["remote", "add", REMOTE_NAME, PRIVATE_REMOTE_URL]);
  console.log(
    `[private-repo] 已添加远端 ${REMOTE_NAME} → ${PRIVATE_REMOTE_URL}`,
  );
};

const pushIfPossible = () => {
  if (!hasRemote(REMOTE_NAME)) {
    console.log("[private-repo] 没有配远端，只能本地提交。");
    return;
  }

  run(["push", "-u", REMOTE_NAME, "main"]);
};

const timestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const commands = {
  init: () => {
    ensureRepo();
    ensureRemote();
    commitIfDirty("chore(私有笔记): 初始化私有笔记仓库");
    pushIfPossible();
    console.log("\n[private-repo] 完成。日常用 `npm run private:save` 备份。");
  },

  save: () => {
    if (!hasGitRepo()) {
      console.error(
        "[private-repo] src/private 还不是 git 仓库，先跑 `npm run private:init`。",
      );
      process.exit(1);
    }

    const message =
      process.argv[3] && !process.argv[3].startsWith("-")
        ? process.argv[3]
        : `chore(私有笔记): 备份 ${timestamp()}`;

    if (!commitIfDirty(message)) return;
    pushIfPossible();
  },

  status: () => {
    if (!hasGitRepo()) {
      console.log("[private-repo] 还没初始化，跑 `npm run private:init`。");
      return;
    }

    const branch =
      tryRun(["rev-parse", "--abbrev-ref", "HEAD"]) || "(no commit)";
    const changes = tryRun(["status", "--porcelain"]);
    const remote = hasRemote(REMOTE_NAME)
      ? tryRun(["remote", "get-url", REMOTE_NAME])
      : "(未配置)";
    const ahead = tryRun(["rev-list", "--count", `${REMOTE_NAME}/main..HEAD`]);
    const behind = tryRun(["rev-list", "--count", `HEAD..${REMOTE_NAME}/main`]);

    console.log(`仓库路径: ${REPO}`);
    console.log(`分支:     ${branch}`);
    console.log(`远端:     ${remote}`);
    console.log(
      `未提交:   ${changes ? `${changes.split("\n").length} 个文件` : "无"}`,
    );
    console.log(
      `与远端:   ${ahead ? `领先 ${ahead} 个提交` : "无领先"} / ${behind ? `落后 ${behind} 个提交` : "无落后"}`,
    );
    if (changes) console.log(`\n${changes}`);
  },

  pull: () => {
    if (!hasGitRepo()) {
      console.error("[private-repo] 还没初始化。");
      process.exit(1);
    }

    run(["pull", "--rebase", REMOTE_NAME, "main"]);
  },

  clone: () => {
    ensureDir();

    const entries = fs
      .readdirSync(REPO)
      .filter((name) => name !== ".git" && name !== "README.md");

    if (entries.length > 0) {
      console.error(
        `[private-repo] ${path.relative(process.cwd(), REPO)}/ 里已有内容，先挪走再 clone，避免覆盖。`,
      );
      process.exit(1);
    }

    if (!hasGitRepo()) {
      if (!requireRemoteConfig()) process.exit(1);
      run(["init", "-b", "main"]);
      run(["remote", "add", REMOTE_NAME, PRIVATE_REMOTE_URL]);
    }

    run(["fetch", REMOTE_NAME]);
    run(["reset", "--hard", `${REMOTE_NAME}/main`]);
    console.log("[private-repo] 已从远端恢复私有笔记。");
  },
};

const command = process.argv[2];

if (!command || !commands[command]) {
  console.error(
    `用法: node scripts/private-repo.mjs <${Object.keys(commands).join("|")}> [提交信息]`,
  );
  process.exit(1);
}

commands[command]();
