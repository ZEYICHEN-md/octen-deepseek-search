#!/usr/bin/env node
/**
 * Write Octen and DeepSeek API keys to a per-user file outside this repo.
 * The file mode is 0600 on macOS and Linux. Values are never printed.
 *
 * Interactive:
 *   node scripts/setup-secrets.mjs
 *
 * Non-interactive, from variables already in the environment:
 *   node scripts/setup-secrets.mjs --from-env
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { SECRET_KEYS, defaultSecretsPath } from "../bin/secrets-file.mjs";

const fromEnv = process.argv.includes("--from-env");
const target = resolve(defaultSecretsPath());
assertOutsideRepo(target);

const values = {};
if (fromEnv) {
  for (const key of SECRET_KEYS) {
    const value = process.env[key];
    if (!value) {
      console.error(`${key} 不在环境变量里。交互运行请去掉 --from-env。`);
      process.exit(2);
    }
    values[key] = value;
  }
} else {
  console.log("密钥只写入本机用户目录，不会写入插件仓库。输入时不回显。");
  for (const key of SECRET_KEYS) {
    const value = (await askHidden(`${key}: `)).trim();
    if (!value) {
      console.error(`${key} 不能为空。`);
      process.exit(2);
    }
    values[key] = value;
  }
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
try {
  chmodSync(target, 0o600);
} catch {
  // Windows may reject POSIX modes. icacls below tightens the ACL when it exists.
}
if (process.platform === "win32") {
  const user = process.env.USERNAME;
  if (user) {
    spawnSync(
      "icacls",
      [target, "/inheritance:r", "/grant:r", `${user}:(R,W)`],
      { stdio: "ignore", windowsHide: true },
    );
  }
}

console.log(`已写入 ${SECRET_KEYS.join("、")}（未打印内容）。`);
console.log(`文件: ${target}`);
console.log("完全退出并重新打开 Kimi Code 后，新会话会读到这些密钥。");

function askHidden(label) {
  if (!process.stdin.isTTY) {
    return new Promise((resolveLine) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(label, (line) => {
        rl.close();
        resolveLine(line);
      });
    });
  }
  return new Promise((resolveLine) => {
    process.stdout.write(label);
    const chars = [];
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (chunk) => {
      if (chunk === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(130);
      }
      if (chunk === "\r" || chunk === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolveLine(chars.join(""));
        return;
      }
      if (chunk === "\u007f" || chunk === "\b") {
        chars.pop();
        return;
      }
      if (chunk < " " && chunk !== "\t") return;
      chars.push(chunk);
    };
    process.stdin.on("data", onData);
  });
}

function assertOutsideRepo(file) {
  if (!isAbsolute(file)) {
    console.error("密钥路径必须是绝对路径。");
    process.exit(2);
  }
  const root = findGitRoot(process.cwd());
  if (root && isInside(file, root)) {
    console.error("拒绝把密钥写进 git 仓库。请去掉 ODS_SECRETS_FILE 里指向仓库的路径。");
    process.exit(2);
  }
}

function findGitRoot(start) {
  let dir = resolve(start);
  for (;;) {
    try {
      const st = statSync(resolve(dir, ".git"));
      if (st.isDirectory() || st.isFile()) return dir;
    } catch {
      // Not this directory.
    }
    const parent = resolve(dir, "..");
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function isInside(child, parent) {
  const rel = relative(parent, child);
  if (rel === "") return true;
  if (isAbsolute(rel)) return false;
  return !rel.split(/[/\\]/).includes("..");
}
