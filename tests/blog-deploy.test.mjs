import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createDeploymentPlan,
  deployBlog,
  parseArguments,
  renderNginx,
  runCli,
  validateConfig,
} from "../scripts/lib/blog-deploy.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const example = JSON.parse(
  await readFile(
    path.join(repoRoot, "deploy/blog.config.example.json"),
    "utf8",
  ),
);
const template = await readFile(
  path.join(repoRoot, "deploy/nginx.conf.example"),
  "utf8",
);
const copyConfig = () => structuredClone(example);
const createCliFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-deploy-cli-"));
  await mkdir(path.join(root, "deploy"));
  await writeFile(
    path.join(root, "deploy/blog.config.json"),
    JSON.stringify(example),
  );
  await writeFile(path.join(root, "deploy/nginx.conf.example"), template);
  return root;
};

test("博客配置同时决定构建、同步目标和 Nginx，不再重复写资源版本", () => {
  const input = copyConfig();
  input.siteUrl = "https://notes.example.com/";
  input.assetsDir = "assets-v3";
  input.remote.webRoot = "/srv/notes";
  const config = validateConfig(input);
  const plan = createDeploymentPlan(config, { repoRoot, env: {} });
  assert.equal(plan.env.VUEPRESS_HOSTNAME, input.siteUrl);
  assert.equal(plan.env.VUEPRESS_ASSETS_DIR, "assets-v3");
  assert.ok(
    plan.uploads[0].args.includes(
      input.remote.target + ":/srv/notes/assets-v3/",
    ),
  );
  const nginx = renderNginx(config, template);
  assert.match(nginx, /server_name notes\.example\.com;/);
  assert.match(nginx, /root \/srv\/notes;/);
  assert.match(nginx, /location \^~ \/assets-v3\//);
  assert.doesNotMatch(nginx, /assets-v2|\{\{/);
});

test("公开部署覆盖继承的私有构建和检查目录", () => {
  const plan = createDeploymentPlan(validateConfig(copyConfig()), {
    repoRoot,
    env: {
      VUEPRESS_PRIVATE: "1",
      PRIVATE_DIST: "/tmp/wrong-output",
      VUEPRESS_HOSTNAME: "https://private.example.com/",
      VUEPRESS_BASE: "/private/",
      VUEPRESS_ASSETS_DIR: "wrong-assets",
      NODE_ENV: "development",
    },
  });
  assert.equal(plan.env.VUEPRESS_PRIVATE, "0");
  assert.equal(plan.env.NODE_ENV, "production");
  assert.equal(plan.env.PRIVATE_DIST, path.join(repoRoot, "dist"));
  assert.equal(plan.env.VUEPRESS_BASE, "/");
  assert.equal(plan.env.VUEPRESS_HOSTNAME, example.siteUrl);
  assert.equal(plan.env.VUEPRESS_ASSETS_DIR, example.assetsDir);
  assert.equal(plan.distDir, path.join(repoRoot, "dist"));
});

test("只允许明确的 HTTPS 根域名、资源版本、SSH 目标和非根远端目录", () => {
  const invalid = [
    (c) => (c.siteUrl = "http://notes.example.com/"),
    (c) => (c.siteUrl = "https://notes.example.com/private/"),
    (c) => (c.siteUrl = "https://user:secret@notes.example.com/"),
    (c) => (c.siteUrl = "https://notes.example.com/?x=1"),
    (c) => (c.assetsDir = "../private"),
    (c) => (c.assetsDir = "assets-v3; touch /tmp/no"),
    (c) => (c.remote.target = "-oProxyCommand=anything"),
    (c) => (c.remote.target = "user@host;anything"),
    (c) => (c.remote.webRoot = "/"),
    (c) => (c.remote.webRoot = "/etc/nginx"),
    (c) => (c.remote.webRoot = "/data"),
    (c) => (c.remote.webRoot = "/data/../private"),
    (c) => (c.remote.webRoot = "/srv/example-blog;anything"),
    (c) => (c.remote.sshKey = "/tmp/key\n-oProxyCommand=x"),
  ];
  for (const mutate of invalid) {
    const input = copyConfig();
    mutate(input);
    assert.throws(() => validateConfig(input), /配置/);
  }
});

test("密钥路径只展开和作为 SSH 参数引用，不读取内容", () => {
  const input = copyConfig();
  input.remote.sshKey = "~/.ssh/id_example_deploy";
  const config = validateConfig(input);
  const plan = createDeploymentPlan(config, {
    repoRoot,
    homeDir: "/tmp/user home",
    env: {},
  });
  const remoteShell =
    plan.uploads[0].args[plan.uploads[0].args.indexOf("-e") + 1];
  assert.match(remoteShell, /-i "\/tmp\/user home\/\.ssh\/id_example_deploy"/);
  assert.match(remoteShell, /BatchMode=yes/);
  assert.ok(plan.uploads.every((command) => command.file === "rsync"));
});

test("离线计划和 Nginx 渲染模式不会执行构建、SSH 或 rsync", async () => {
  const root = await createCliFixture();
  for (const args of [["--plan"], ["--nginx"]]) {
    const calls = [];
    const output = [];
    await runCli(args, {
      repoRoot: root,
      execute: async (...call) => calls.push(call),
      write: (line) => output.push(line),
    });
    assert.deepEqual(calls, []);
    assert.ok(
      output
        .join("\n")
        .includes(args[0] === "--nginx" ? "server_name" : "离线计划"),
    );
  }
  assert.throws(() => parseArguments(["--plan", "--nginx"]), /参数/);
  assert.throws(() => parseArguments(["--unknown"]), /参数/);
  assert.throws(() => parseArguments(["--config"]), /参数/);
});

test("未提供真实本地配置时不回退示例配置，也不执行发布", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "blog-deploy-missing-config-"),
  );
  await mkdir(path.join(root, "deploy"));
  await writeFile(
    path.join(root, "deploy/blog.config.example.json"),
    JSON.stringify(example),
  );
  for (const args of [[], ["--plan"], ["--nginx"]]) {
    const calls = [];
    await assert.rejects(
      runCli(args, {
        repoRoot: root,
        execute: async (...call) => calls.push(call),
      }),
      /缺少本地部署配置/,
    );
    assert.deepEqual(calls, []);
  }
});

test("示例可用于离线检查，但不能通过 CLI 执行真实发布", async () => {
  const root = await createCliFixture();
  const calls = [];
  await assert.rejects(
    runCli([], {
      repoRoot: root,
      execute: async (...call) => calls.push(call),
    }),
    /示例地址不能用于真实发布/,
  );
  assert.deepEqual(calls, []);
});

test("本地配置 JSON 格式错误时不向错误信息回显原始内容", async () => {
  const root = await createCliFixture();
  const fixtureValue = "synthetic-config-value-do-not-echo";
  await writeFile(
    path.join(root, "deploy/blog.config.json"),
    '{"siteUrl":"' + fixtureValue + '" INVALID}',
  );
  const calls = [];
  await assert.rejects(
    runCli([], {
      repoRoot: root,
      execute: async (...call) => calls.push(call),
    }),
    (error) => {
      assert.equal(
        error.message,
        "本地部署配置 JSON 格式错误，请在本地修正后重试",
      );
      assert.ok(!error.message.includes(fixtureValue));
      return true;
    },
  );
  assert.deepEqual(calls, []);
});

test("真实配置和本地 Nginx 文件被忽略，示例可正常纳入版本管理", () => {
  for (const file of [
    "deploy/blog.config.json",
    "deploy/nginx.private.local.conf",
    "deploy/nginx.blog.local.conf",
  ]) {
    const ignored = spawnSync(
      "git",
      ["check-ignore", "--no-index", "--quiet", "--", file],
      { cwd: repoRoot },
    );
    assert.equal(ignored.status, 0, file + " 必须被忽略");
    assert.equal(
      execFileSync("git", ["ls-files", "--", file], {
        cwd: repoRoot,
        encoding: "utf8",
      }).trim(),
      "",
      file + " 不得已被跟踪",
    );
  }
  for (const file of [
    "deploy/blog.config.example.json",
    "deploy/nginx.conf.example",
    "deploy/nginx.private.conf.example",
  ]) {
    const ignored = spawnSync(
      "git",
      ["check-ignore", "--no-index", "--quiet", "--", file],
      { cwd: repoRoot },
    );
    assert.equal(ignored.status, 1, file + " 应作为公开示例");
  }
});

test("公开示例仅包含虚构连接信息，构建入口不依赖真实配置", async () => {
  assert.deepEqual(Object.keys(example).sort(), [
    "assetsDir",
    "remote",
    "siteUrl",
  ]);
  assert.deepEqual(Object.keys(example.remote).sort(), [
    "sshKey",
    "target",
    "webRoot",
  ]);
  assert.ok(new URL(example.siteUrl).hostname.endsWith(".example.com"));
  assert.ok(example.remote.target.endsWith("@server.example.com"));
  assert.match(example.remote.webRoot, /example/);
  assert.match(example.remote.sshKey, /id_example_/);
  const privateExample = await readFile(
    path.join(repoRoot, "deploy/nginx.private.conf.example"),
    "utf8",
  );
  const serverNames = [
    ...privateExample.matchAll(/server_name\s+([^;]+);/g),
  ].map((match) => match[1]);
  assert.ok(serverNames.length > 0);
  assert.ok(serverNames.every((name) => name.endsWith(".example.com")));
  assert.match(privateExample, /\.htpasswd-example-private/);
  const source = await readFile(
    path.join(repoRoot, "src/.vuepress/config.ts"),
    "utf8",
  );
  assert.match(
    source,
    /require\("\.\.\/\.\.\/deploy\/blog\.config\.example\.json"\)/,
  );
  assert.doesNotMatch(source, /require\("[^"]*deploy\/blog\.config\.json"\)/);
});

test("构建失败时不上传，旧 dist 不能掩盖本次失败", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-deploy-failed-"));
  await mkdir(path.join(root, "dist", example.assetsDir), { recursive: true });
  await writeFile(path.join(root, "dist/index.html"), "old output");
  const calls = [];
  await assert.rejects(
    deployBlog(validateConfig(copyConfig()), {
      repoRoot: root,
      execute: async (command) => {
        calls.push(command.file);
        throw new Error("构建或泄漏检查失败");
      },
    }),
    /构建或泄漏检查失败/,
  );
  assert.deepEqual(calls, ["npm"]);
});

test("缺少产物、缺少资源和出现私有目录都阻止上传", async () => {
  for (const scenario of ["empty", "no-assets", "private"]) {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "blog-deploy-artifacts-"),
    );
    if (scenario !== "empty") {
      await mkdir(path.join(root, "dist"), { recursive: true });
      await writeFile(path.join(root, "dist/index.html"), "public output");
    }
    if (scenario === "private") {
      await mkdir(path.join(root, "dist", example.assetsDir), {
        recursive: true,
      });
      await mkdir(path.join(root, "dist/private"));
    }
    const calls = [];
    await assert.rejects(
      deployBlog(validateConfig(copyConfig()), {
        repoRoot: root,
        execute: async (command) => calls.push(command.file),
      }),
      /产物|私有/,
    );
    assert.deepEqual(calls, ["npm"]);
  }
});

test(
  "嵌套产物含符号链接时不读取链接目标，也不上传",
  {
    skip:
      process.platform === "win32" && "Windows 创建符号链接可能需要额外权限",
  },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "blog-deploy-link-"));
    await mkdir(path.join(root, "dist", example.assetsDir), {
      recursive: true,
    });
    await mkdir(path.join(root, "dist/deep/nested"), { recursive: true });
    await writeFile(path.join(root, "dist/index.html"), "public output");
    await symlink(
      path.join(root, "outside-not-existing.txt"),
      path.join(root, "dist/deep/nested/link.txt"),
    );
    const calls = [];
    await assert.rejects(
      deployBlog(validateConfig(copyConfig()), {
        repoRoot: root,
        execute: async (command) => calls.push(command.file),
      }),
      /符号链接/,
    );
    assert.deepEqual(calls, ["npm"]);
  },
);

test("发布按构建、资源、页面顺序执行，资源上传失败后不动页面", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-deploy-order-"));
  await mkdir(path.join(root, "dist", example.assetsDir), { recursive: true });
  await writeFile(path.join(root, "dist/index.html"), "public output");
  const config = validateConfig(copyConfig());
  const calls = [];
  await deployBlog(config, {
    repoRoot: root,
    execute: async (c) => calls.push(c),
  });
  assert.deepEqual(
    calls.map((c) => c.file),
    ["npm", "rsync", "rsync"],
  );
  assert.ok(calls[1].args.at(-1).endsWith("/" + example.assetsDir + "/"));
  assert.ok(!calls[1].args.includes("--delete-after"));
  assert.ok(calls[2].args.includes("--delete-after"));
  const failed = [];
  await assert.rejects(
    deployBlog(config, {
      repoRoot: root,
      execute: async (c) => {
        failed.push(c.file);
        if (c.file === "rsync") throw new Error("资源上传失败");
      },
    }),
    /资源上传失败/,
  );
  assert.deepEqual(failed, ["npm", "rsync"]);
});

const rsyncAvailable =
  spawnSync("rsync", ["--version"], { timeout: 5_000 }).status === 0;
test(
  "用本机 rsync 验证旧哈希和旧资源版本保留，旧普通页面清理",
  {
    skip: !rsyncAvailable && "当前环境没有 rsync，需在部署环境运行此项集成测试",
  },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "blog-deploy-rsync-"));
    const source = path.join(root, "dist");
    const target = path.join(root, "target");
    await mkdir(path.join(source, example.assetsDir), { recursive: true });
    for (const dir of [example.assetsDir, "assets-v1", "assets"]) {
      await mkdir(path.join(target, dir), { recursive: true });
      await writeFile(path.join(target, dir, "old-hash.js"), "old asset");
    }
    await writeFile(
      path.join(source, example.assetsDir, "new-hash.js"),
      "new asset",
    );
    await writeFile(path.join(source, "index.html"), "new page");
    await writeFile(path.join(target, "removed.html"), "old page");
    const plan = createDeploymentPlan(validateConfig(copyConfig()), {
      repoRoot: root,
      env: {},
    });
    for (const [index, command] of plan.uploads.entries()) {
      const args = command.args.slice(0, -2);
      args.splice(args.indexOf("-e"), 2);
      args.push(
        index === 0 ? path.join(source, example.assetsDir) + "/" : source + "/",
        index === 0 ? path.join(target, example.assetsDir) + "/" : target + "/",
      );
      execFileSync("rsync", args, { timeout: 10_000 });
    }
    for (const dir of [example.assetsDir, "assets-v1", "assets"]) {
      assert.equal(
        await readFile(path.join(target, dir, "old-hash.js"), "utf8"),
        "old asset",
      );
    }
    assert.equal(
      await readFile(
        path.join(target, example.assetsDir, "new-hash.js"),
        "utf8",
      ),
      "new asset",
    );
    assert.equal(
      await readFile(path.join(target, "index.html"), "utf8"),
      "new page",
    );
    await assert.rejects(readFile(path.join(target, "removed.html")), {
      code: "ENOENT",
    });
  },
);

test("Nginx 对缺失资源禁用缓存，页面重验证且不会包含私有站", () => {
  const nginx = renderNginx(validateConfig(copyConfig()), template);
  assert.match(nginx, /Cache-Control "no-cache" always/);
  assert.match(nginx, /Cache-Control "no-store" always/);
  assert.match(nginx, /public, max-age=31536000, immutable/);
  assert.match(nginx, /try_files \$uri =404/);
  assert.doesNotMatch(nginx, /private\.example\.com|example-private/);
});
