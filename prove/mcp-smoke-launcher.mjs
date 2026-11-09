#!/usr/bin/env node
/**
 * Starts Octen and DeepSeek through bin/run-stdio.mjs with a temporary
 * secrets file. The values are fake. initialize must succeed; search is not
 * called. The transcript must not contain the fake values.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "ods-launcher-"));
const secretsFile = join(dir, "secrets.json");
const fake = {
  OCTEN_API_KEY: "octen-launcher-test-not-real",
  DEEPSEEK_API_KEY: "deepseek-launcher-test-not-real",
};
writeFileSync(secretsFile, `${JSON.stringify(fake)}\n`, { mode: 0o600 });

const summary = [];
let failed = false;
try {
  summary.push(await probe("octen", "octen-mcp"));
  summary.push(await probe("deepseek", "mcp-deepseek-search"));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 2));
process.exit(failed ? 1 : 0);

function probe(id, expectedName) {
  return new Promise((resolveProbe) => {
    const child = spawn(process.execPath, ["bin/run-stdio.mjs", id], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ODS_SECRETS_FILE: secretsFile,
        OCTEN_API_KEY: "",
        DEEPSEEK_API_KEY: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    const pending = new Map();
    let nextId = 1;
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || "rpc error"));
        else resolve(msg.result);
      }
    });
    const send = (method, params) => {
      const rpcId = nextId++;
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: rpcId, method, params }) + "\n");
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(rpcId);
          reject(new Error(`timeout ${method}`));
        }, 180000);
        pending.set(rpcId, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
      });
    };
    const row = { id, initialize: "FAIL", leakCheck: "FAIL", error: null };
    send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "launcher-smoke", version: "1.1.0" },
    })
      .then((init) => {
        row.initialize = init?.serverInfo?.name === expectedName ? "PASS" : "FAIL";
        row.serverInfo = init?.serverInfo
          ? { name: init.serverInfo.name, version: init.serverInfo.version }
          : undefined;
      })
      .catch((error) => {
        row.error = String(error.message || error);
      })
      .finally(() => {
        child.stdin.end();
        child.kill("SIGTERM");
        const blob = `${stderr}\n${JSON.stringify(row)}`;
        const leaked = Object.values(fake).some((value) => blob.includes(value));
        row.leakCheck = leaked ? "FAIL" : "PASS";
        if (row.initialize !== "PASS" || row.leakCheck !== "PASS") failed = true;
        if (row.error) row.error = row.error.replaceAll(fake.OCTEN_API_KEY, "[REDACTED]").replaceAll(fake.DEEPSEEK_API_KEY, "[REDACTED]");
        resolveProbe(row);
      });
  });
}
