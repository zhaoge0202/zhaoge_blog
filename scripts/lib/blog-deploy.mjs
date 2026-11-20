import { spawn } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_ROOT = path.resolve(import.meta.dirname, "../..");
const fail = (reason) => {
  throw new Error("部署配置错误：" + reason);
};
const validHost = (host) =>
  host.length <= 253 &&
  host
    .split(".")
    .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));

export function validateConfig(input) {
  let url;
  try {
    if (typeof input?.siteUrl !== "string" || /\s/.test(input.siteUrl))
      fail("siteUrl 不合法");
    url = new URL(input.siteUrl);
  } catch {
    fail("siteUrl 必须是 HTTPS 根地址");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !validHost(url.hostname)
  ) {
    fail("siteUrl 只支持不带认证、端口、子路径和查询参数的 HTTPS 根地址");
  }
  if (!/^assets-v[1-9][0-9]*$/.test(input.assetsDir ?? "")) {
    fail("assetsDir 应采用 assets-v数字，例如 assets-v2");
  }
  const { target, webRoot, sshKey } = input.remote ?? {};
  const targetParts = typeof target === "string" ? target.split("@") : [];
  if (
    targetParts.length !== 2 ||
    !/^[a-z_][a-z0-9_-]*$/i.test(targetParts[0]) ||
    !validHost(targetParts[1])
  ) {
    fail("remote.target 应为 user@host，不支持空白或命令参数");
  }
  if (
    typeof webRoot !== "string" ||
    !/^\/(?:data|srv|var\/www)\/[a-z0-9_.\/-]+$/i.test(webRoot) ||
    webRoot.split("/").some((part) => part === "." || part === "..") ||
    path.posix.normalize(webRoot) !== webRoot ||
    webRoot.endsWith("/")
  ) {
    fail(
      "remote.webRoot 应为 /data、/srv 或 /var/www 下独立站点的规范绝对目录",
    );
  }
  if (
    typeof sshKey !== "string" ||
    !/^(?:~\/|\/)[a-z0-9_./ -]+$/i.test(sshKey) ||
    sshKey.split("/").includes("..") ||
    sshKey.endsWith("/")
  ) {
    fail(
      "remote.sshKey 应为绝对路径或 ~/ 路径，不支持引号、控制字符和命令语法",
    );
  }
  return {
    siteUrl: url.origin + "/",
    assetsDir: input.assetsDir,
    remote: { target, webRoot, sshKey },
  };
}

export function parseArguments(args) {
  const result = { mode: "publish", configPath: "deploy/blog.config.json" };
  let selectedMode = false;
  let selectedConfig = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--plan", "--nginx", "--help"].includes(arg)) {
      if (selectedMode)
        throw new Error("参数错误：--plan、--nginx、--help 只能选择一个");
      selectedMode = true;
      result.mode = arg.slice(2);
    } else if (arg === "--config") {
      if (selectedConfig || !args[i + 1] || args[i + 1].startsWith("-")) {
        throw new Error("参数错误：--config 需要且只能指定一个配置文件");
      }
      selectedConfig = true;
      result.configPath = args[++i];
    } else {
      throw new Error("参数错误：未知参数 " + arg);
    }
  }
  return result;
}

export function createDeploymentPlan(
  config,
  { repoRoot = DEFAULT_ROOT, env = process.env, homeDir = os.homedir() } = {},
) {
  config = validateConfig(config);
  const distDir = path.join(repoRoot, "dist");
  const key = config.remote.sshKey.startsWith("~/")
    ? path.join(homeDir, config.remote.sshKey.slice(2))
    : config.remote.sshKey;
  if (/["'\r\n\\$\x60]/.test(key)) fail("展开后的 SSH 密钥路径含不支持的字符");
  // rsync 的 -e 有自己的参数拆分规则，路径用双引号包裹，禁止引号与转义字符混入。
  const ssh =
    'ssh -i "' +
    key +
    '" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15';
  const common = [
    "-azc",
    "--delay-updates",
    "--timeout=60",
    "-e",
    ssh,
    "--exclude=._*",
    "--exclude=.DS_Store",
  ];
  const destination = config.remote.target + ":" + config.remote.webRoot + "/";
  return {
    distDir,
    env: {
      ...env,
      NODE_ENV: "production",
      VUEPRESS_PRIVATE: "0",
      PRIVATE_DIST: distDir,
      VUEPRESS_BASE: "/",
      VUEPRESS_HOSTNAME: config.siteUrl,
      VUEPRESS_ASSETS_DIR: config.assetsDir,
    },
    build: { file: "npm", args: ["run", "build"] },
    uploads: [
      {
        file: "rsync",
        args: [
          ...common,
          path.join(distDir, config.assetsDir) + "/",
          destination + config.assetsDir + "/",
        ],
      },
      {
        file: "rsync",
        args: [
          ...common,
          "--delete-after",
          "--exclude=/assets/",
          "--exclude=/assets-v*/",
          distDir + "/",
          destination,
        ],
      },
    ],
  };
}

export function renderNginx(config, template) {
  config = validateConfig(config);
  const values = {
    HOSTNAME: new URL(config.siteUrl).hostname,
    WEB_ROOT: config.remote.webRoot,
    ASSETS_DIR: config.assetsDir,
  };
  const rendered = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error("Nginx 模板含未知字段：" + name);
    return values[name];
  });
  if (rendered.includes("{{")) throw new Error("Nginx 模板含未解析字段");
  return rendered;
}

export async function executeCommand(command, { cwd, env }) {
  await new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, {
      cwd,
      env,
      shell: false,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(command.file + " 执行失败：" + (signal ?? code)));
    });
  });
}

async function assertPublicArtifacts(distDir, assetsDir) {
  for (const [name, kind] of [
    ["", "directory"],
    ["index.html", "file"],
    [assetsDir, "directory"],
  ]) {
    let info;
    try {
      info = await lstat(path.join(distDir, name));
    } catch {
      throw new Error("公开构建产物缺失：" + (name || "dist/"));
    }
    if (
      info.isSymbolicLink() ||
      (kind === "directory" ? !info.isDirectory() : !info.isFile())
    ) {
      throw new Error("公开构建产物类型错误：" + (name || "dist/"));
    }
  }
  const privateEntry = await lstat(path.join(distDir, "private")).catch(
    (error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    },
  );
  if (privateEntry) throw new Error("公开构建产物中存在私有目录，已阻止上传");
  // rsync -a 会保留符号链接；公开静态产物只接收普通文件和目录，不读取链接目标。
  const pending = [distDir];
  while (pending.length) {
    const current = pending.pop();
    for (const name of await readdir(current)) {
      const file = path.join(current, name);
      const info = await lstat(file);
      if (info.isSymbolicLink()) {
        throw new Error(
          "公开构建产物含符号链接，已阻止上传：" + path.relative(distDir, file),
        );
      }
      if (info.isDirectory()) pending.push(file);
      else if (!info.isFile()) {
        throw new Error(
          "公开构建产物含非常规文件，已阻止上传：" +
            path.relative(distDir, file),
        );
      }
    }
  }
}

export async function deployBlog(
  config,
  { repoRoot = DEFAULT_ROOT, env = process.env, execute = executeCommand } = {},
) {
  const plan = createDeploymentPlan(config, { repoRoot, env });
  const options = { cwd: repoRoot, env: plan.env };
  await execute(plan.build, options);
  await assertPublicArtifacts(plan.distDir, config.assetsDir);
  for (const upload of plan.uploads) await execute(upload, options);
  return plan;
}

export async function runCli(
  args,
  {
    repoRoot = DEFAULT_ROOT,
    env = process.env,
    execute = executeCommand,
    write = console.log,
  } = {},
) {
  const options = parseArguments(args);
  if (options.mode === "help") {
    write(
      "用法：node scripts/deploy-blog.mjs [--plan | --nginx] [--config 配置文件]",
    );
    return;
  }
  let content;
  try {
    content = await readFile(
      path.resolve(repoRoot, options.configPath),
      "utf8",
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "缺少本地部署配置。请将 deploy/blog.config.example.json 复制为 deploy/blog.config.json 并填写真实值，或通过 --config 指定本地文件。实际配置不应提交到 Git。",
      );
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // JSON.parse 的原始错误可能回显输入片段，不能把本地配置内容带进日志。
    throw new Error("本地部署配置 JSON 格式错误，请在本地修正后重试");
  }
  const config = validateConfig(parsed);
  if (options.mode === "nginx") {
    const template = await readFile(
      path.join(repoRoot, "deploy/nginx.conf.example"),
      "utf8",
    );
    write(renderNginx(config, template));
    return;
  }
  if (options.mode === "plan") {
    const plan = createDeploymentPlan(config, { repoRoot, env });
    write("离线计划：只显示配置与参数，不构建、不连接远端。");
    write(
      JSON.stringify(
        {
          siteUrl: config.siteUrl,
          assetsDir: config.assetsDir,
          webRoot: config.remote.webRoot,
          buildEnv: Object.fromEntries(
            [
              "NODE_ENV",
              "VUEPRESS_PRIVATE",
              "PRIVATE_DIST",
              "VUEPRESS_BASE",
              "VUEPRESS_HOSTNAME",
              "VUEPRESS_ASSETS_DIR",
            ].map((key) => [key, plan.env[key]]),
          ),
          commands: [plan.build, ...plan.uploads],
        },
        null,
        2,
      ),
    );
    return;
  }
  const hosts = [
    new URL(config.siteUrl).hostname,
    config.remote.target.split("@")[1],
  ];
  if (
    hosts.some(
      (host) => host === "example.com" || host.endsWith(".example.com"),
    )
  ) {
    throw new Error(
      "示例地址不能用于真实发布，请先填写被 Git 忽略的本地部署配置",
    );
  }
  await deployBlog(config, { repoRoot, env, execute });
  write("博客构建与同步完成；Nginx 安装、重载及线上验收另行执行。");
}
