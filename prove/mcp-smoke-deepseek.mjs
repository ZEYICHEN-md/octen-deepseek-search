#!/usr/bin/env node
/**
 * MCP stdio smoke (deepseek-web): initialize → tools/list → tools/call deepseek_search
 * Reads DEEPSEEK_API_KEY from env only. Never prints the key.
 * Transcript: prove/mcp-smoke-deepseek.jsonl (redacted).
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "mcp-smoke-deepseek.jsonl");
mkdirSync(__dirname, { recursive: true });

const HAS_KEY = Boolean(process.env.DEEPSEEK_API_KEY);

const lines = [];
function log(obj) {
  const safe = JSON.parse(
    JSON.stringify(obj, (k, v) => {
      if (typeof v === "string" && /sk-[a-zA-Z0-9]{8,}/.test(v)) {
        return "[REDACTED_KEY_LIKE]";
      }
      if (k === "DEEPSEEK_API_KEY" || /api[_-]?key/i.test(String(k))) return "[REDACTED]";
      return v;
    })
  );
  lines.push(safe);
}

const child = spawn(
  "npx",
  ["-y", "mcp-deepseek-search@1.0.1"],
  {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  }
);

let stderrBuf = "";
child.stderr.on("data", (d) => {
  stderrBuf += d.toString();
});

const rl = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1;

function send(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params };
  log({ dir: "out", msg: { ...msg, params } });
  child.stdin.write(JSON.stringify(msg) + "\n");
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout waiting for id=${id} method=${method}`));
    }, 180000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(t);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(t);
        reject(e);
      },
    });
  });
}

function notify(method, params) {
  const msg = { jsonrpc: "2.0", method, params };
  log({ dir: "out", msg });
  child.stdin.write(JSON.stringify(msg) + "\n");
}

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    log({ dir: "in", raw: line.slice(0, 500) });
    return;
  }
  log({ dir: "in", msg: summarizeIn(msg) });
  if (msg.id != null && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(Object.assign(new Error(msg.error.message || "rpc error"), { rpc: msg.error }));
    else resolve(msg.result);
  }
});

function summarizeIn(msg) {
  const copy = JSON.parse(JSON.stringify(msg));
  if (copy.result?.content) {
    const c = copy.result.content;
    if (Array.isArray(c)) {
      copy.result.content = c.map((part) => {
        if (part?.type === "text" && typeof part.text === "string" && part.text.length > 800) {
          return { ...part, text: part.text.slice(0, 800) + `…[truncated ${part.text.length} chars]` };
        }
        return part;
      });
    }
  }
  if (copy.result?.tools) {
    copy.result.tools = copy.result.tools.map((t) => ({
      name: t.name,
      description: (t.description || "").slice(0, 120),
    }));
  }
  return copy;
}

async function main() {
  const result = {
    server: "deepseek-web",
    initialize: "FAIL",
    toolsList: "FAIL",
    toolsCall: "FAIL",
    toolNames: [],
    error: null,
  };
  try {
    const init = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "octen-deepseek-search-prove-deepseek", version: "1.0.0" },
    });
    result.initialize = init?.serverInfo ? "PASS" : "PASS_NO_SERVERINFO";
    if (init?.serverInfo) {
      result.serverInfo = {
        name: init.serverInfo.name,
        version: init.serverInfo.version,
      };
    }
    notify("notifications/initialized", {});

    const listed = await send("tools/list", {});
    const names = (listed?.tools || []).map((t) => t.name).sort();
    result.toolNames = names;
    const need = ["deepseek_search", "deepseek_fetch"];
    result.toolsList = need.every((n) => names.includes(n)) ? "PASS" : "FAIL";

    const call = await send("tools/call", {
      name: "deepseek_search",
      arguments: {
        query: "MCP 协议 lang:zh",
        count: 1,
        need_content: false,
      },
    });
    const text = (call?.content || [])
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    const looksOk =
      !call?.isError &&
      typeof text === "string" &&
      text.length > 20 &&
      (/https?:\/\//.test(text) || /rerank_score|authority|title/i.test(text));
    const authRequired =
      !HAS_KEY &&
      (call?.isError === true || /DEEPSEEK_API_KEY is not set/i.test(text));
    result.toolsCall = looksOk ? "PASS" : authRequired ? "AUTH_REQUIRED" : "FAIL";
    result.preview = text.slice(0, 240).replace(/sk-[a-zA-Z0-9]+/g, "[REDACTED_KEY_LIKE]");
  } catch (e) {
    result.error = String(e && e.message ? e.message : e);
    if (e && e.rpc) result.rpc = e.rpc;
  } finally {
    try {
      child.stdin.end();
    } catch {}
    child.kill("SIGTERM");
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
    }, 2000).unref?.();
  }

  if (stderrBuf.trim()) {
    log({
      dir: "stderr",
      text: stderrBuf
        .replace(/sk-[a-zA-Z0-9]+/g, "[REDACTED_KEY_LIKE]")
        .slice(0, 2000),
    });
  }
  log({ dir: "summary", result });
  writeFileSync(outPath, lines.map((x) => JSON.stringify(x)).join("\n") + "\n");

  const dump = lines.map((x) => JSON.stringify(x)).join("\n");
  const key = process.env.DEEPSEEK_API_KEY || "";
  const leaked = key.length >= 8 && dump.includes(key);
  result.leakCheck = leaked ? "FAIL" : "PASS";
  console.log(JSON.stringify(result, null, 2));
  const ok =
    (result.initialize === "PASS" || result.initialize === "PASS_NO_SERVERINFO") &&
    result.toolsList === "PASS" &&
    (result.toolsCall === "PASS" || result.toolsCall === "AUTH_REQUIRED") &&
    result.leakCheck === "PASS";
  process.exit(ok ? 0 : 1);
}

main();
