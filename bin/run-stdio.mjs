#!/usr/bin/env node
/**
 * Kimi plugin stdio entry.
 *
 * Kimi's plugin loader rewrites command "node" to the desktop Electron binary
 * (ELECTRON_RUN_AS_NODE) or the native `kimi __plugin_run_node` helper, so this
 * file runs without a separate Node install when Kimi itself can run it.
 * The child MCP package is still the official npm build, started with npx.
 * On Windows, npx is a .cmd shim; Kimi's own process spawn does not launch
 * .cmd (ENOENT). This script launches npx through cmd.exe instead.
 *
 * Secrets are read from the environment or from the per-user secrets file.
 * They are passed only as child environment variables, never as arguments,
 * and this process does not print their values.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { STDIO_SERVERS } from "./servers.mjs";
import { SECRET_KEYS, defaultSecretsPath } from "./secrets-file.mjs";

const id = process.argv[2];
const spec = STDIO_SERVERS[id];
if (!spec) {
  console.error("用法: node bin/run-stdio.mjs <octen|deepseek>");
  process.exit(2);
}

const env = { ...process.env };
const secrets = readSecrets();
for (const key of SECRET_KEYS) {
  if (!env[key] && typeof secrets[key] === "string" && secrets[key].length > 0) {
    env[key] = secrets[key];
  }
}

if (!env[spec.key]) {
  console.error(
    `${spec.key} 未配置。在本机运行：node scripts/setup-secrets.mjs\n` +
      "密钥只写入用户目录下的 secrets.json，不会进入插件仓库。",
  );
  process.exit(2);
}

const child = spawnNpx(["-y", spec.npm], env);
child.on("error", (error) => {
  if (error && error.code === "ENOENT") {
    console.error("找不到 npx。请安装 Node.js 18 或更新版本，并把它加入 PATH，然后完全退出并重新打开 Kimi Code。");
  } else {
    console.error(`启动 ${spec.npm} 失败: ${error.message}`);
  }
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

function readSecrets() {
  const file = defaultSecretsPath();
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return {};
    console.error(`无法读取密钥文件（路径已省略内容）: ${error.message}`);
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    for (const key of SECRET_KEYS) {
      if (typeof parsed[key] === "string") out[key] = parsed[key];
    }
    return out;
  } catch {
    console.error("密钥文件不是 JSON 对象。请重新运行 node scripts/setup-secrets.mjs");
    return {};
  }
}

function spawnNpx(args, childEnv) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "cmd.exe";
    const line = ["npx", ...args].map(quoteCmd).join(" ");
    return spawn(comspec, ["/d", "/s", "/c", line], {
      env: childEnv,
      stdio: "inherit",
      windowsHide: true,
      cwd: homedir(),
    });
  }
  return spawn("npx", args, {
    env: childEnv,
    stdio: "inherit",
    cwd: homedir(),
  });
}

function quoteCmd(arg) {
  if (arg.length === 0) return '""';
  if (!/[\s"&|<>^%]/.test(arg)) return arg;
  return `"${arg.replaceAll('"', '""')}"`;
}
