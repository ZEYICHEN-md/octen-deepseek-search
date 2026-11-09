#!/usr/bin/env node
/**
 * Re-run the local checks. Authenticated Octen/DeepSeek search is skipped
 * when the API keys are absent.
 *
 *   node prove/run-all.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEEPSEEK_PACKAGE, EXA_MCP_URL, OCTEN_PACKAGE } from "../bin/servers.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const steps = [];

function runNode(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
  return result;
}

try {
  checkPins();
  steps.push({ name: "pins", status: "PASS" });
  checkNoSecrets();
  steps.push({ name: "secret-scan", status: "PASS" });
  checkSetupScript();
  steps.push({ name: "setup-secrets", status: "PASS" });
  checkLauncherMissingKey();
  steps.push({ name: "launcher-missing-key", status: "PASS" });
} catch (error) {
  steps.push({ name: "static", status: "FAIL", error: String(error.message || error) });
  finish(1);
}

const scripts = [
  "prove/kimi-plugin-load.mjs",
  "prove/mcp-smoke-exa.mjs",
  "prove/mcp-smoke-deepseek.mjs",
  "prove/mcp-smoke-octen.mjs",
  "prove/mcp-smoke-launcher.mjs",
];
let failed = false;
for (const script of scripts) {
  const result = runNode([script]);
  const status = result.status === 0 ? "PASS" : "FAIL";
  if (status !== "PASS") failed = true;
  steps.push({
    name: script,
    status,
    stdout: tail(result.stdout),
    stderr: tail(result.stderr),
  });
}

finish(failed ? 1 : 0);

function finish(code) {
  console.log(JSON.stringify({ steps }, null, 2));
  process.exit(code);
}

function checkPins() {
  const mcp = JSON.parse(readFileSync(join(repoRoot, "mcp.json"), "utf8"));
  const kimi = JSON.parse(readFileSync(join(repoRoot, "kimi.plugin.json"), "utf8"));
  const octenArgs = mcp.mcpServers.octen.args.join(" ");
  const deepseekArgs = mcp.mcpServers["deepseek-web"].args.join(" ");
  if (!octenArgs.includes(OCTEN_PACKAGE)) throw new Error("mcp.json octen pin");
  if (!deepseekArgs.includes(DEEPSEEK_PACKAGE)) throw new Error("mcp.json deepseek pin");
  if (mcp.mcpServers.exa.url !== EXA_MCP_URL) throw new Error("mcp.json exa url");
  if (mcp.mcpServers.octen.env.OCTEN_API_KEY !== "${OCTEN_API_KEY}") {
    throw new Error("Cursor octen env must stay a placeholder");
  }
  if (mcp.mcpServers["deepseek-web"].env.DEEPSEEK_API_KEY !== "${DEEPSEEK_API_KEY}") {
    throw new Error("Cursor deepseek env must stay a placeholder");
  }
  if (kimi.mcpServers.exa.url !== EXA_MCP_URL) throw new Error("kimi exa url");
  if (kimi.mcpServers.octen.command !== "node") throw new Error("kimi octen command");
  if (kimi.mcpServers["deepseek-web"].command !== "node") throw new Error("kimi deepseek command");
  if (kimi.sessionStart.skill !== "search-router") throw new Error("sessionStart");
  const text = JSON.stringify(kimi);
  if (text.includes("sk-") || /api[_-]?key"\s*:\s*"(?!\$\{)/i.test(text)) {
    throw new Error("kimi manifest contains a secret-like value");
  }
}

function checkNoSecrets() {
  const walk = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        import { readdirSync, readFileSync, statSync } from "node:fs";
        import { join, relative } from "node:path";
        const root = ${JSON.stringify(repoRoot)};
        const bad = [];
        const skip = new Set([".git", "node_modules", "dist", ".tmp"]);
        function walk(dir) {
          for (const name of readdirSync(dir)) {
            if (skip.has(name)) continue;
            const full = join(dir, name);
            const st = statSync(full);
            if (st.isDirectory()) walk(full);
            else if (st.isFile()) {
              const rel = relative(root, full);
              if (rel.endsWith(".jsonl")) continue;
              if (/secret|api_key/i.test(name) && name !== "secrets-file.mjs" && name !== "setup-secrets.mjs") bad.push(rel);
              const text = readFileSync(full, "utf8");
              if (/sk-[A-Za-z0-9]{16,}/.test(text)) bad.push(rel + ":key-like");
            }
          }
        }
        walk(root);
        if (bad.length) {
          console.error(bad.join("\\n"));
          process.exit(1);
        }
      `,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (walk.status !== 0) {
    throw new Error(`secret scan failed: ${walk.stderr || walk.stdout}`);
  }
}

function checkSetupScript() {
  const dir = mkdtempSync(join(tmpdir(), "ods-secrets-"));
  const file = join(dir, "secrets.json");
  const octen = "octen-test-value-not-real";
  const deepseek = "deepseek-test-value-not-real";
  const result = runNode(["scripts/setup-secrets.mjs", "--from-env"], {
    ODS_SECRETS_FILE: file,
    OCTEN_API_KEY: octen,
    DEEPSEEK_API_KEY: deepseek,
  });
  const combined = `${result.stdout}\n${result.stderr}`;
  if (result.status !== 0) throw new Error(`setup exit ${result.status}: ${combined}`);
  if (combined.includes(octen) || combined.includes(deepseek)) {
    throw new Error("setup printed a secret value");
  }
  const saved = JSON.parse(readFileSync(file, "utf8"));
  if (saved.OCTEN_API_KEY !== octen || saved.DEEPSEEK_API_KEY !== deepseek) {
    throw new Error("setup file missing expected keys");
  }
  if (process.platform !== "win32") {
    const mode = statSync(file).mode & 0o777;
    if (mode !== 0o600) throw new Error(`secrets mode ${mode.toString(8)}`);
  }
  rmSync(dir, { recursive: true, force: true });

  const refused = runNode(["scripts/setup-secrets.mjs", "--from-env"], {
    ODS_SECRETS_FILE: join(repoRoot, "secrets.json"),
    OCTEN_API_KEY: octen,
    DEEPSEEK_API_KEY: deepseek,
  });
  if (refused.status === 0) throw new Error("setup wrote inside the repo");
  const refusedText = `${refused.stdout}\n${refused.stderr}`;
  if (refusedText.includes(octen) || refusedText.includes(deepseek)) {
    throw new Error("refused setup printed a secret");
  }
}

function checkLauncherMissingKey() {
  const dir = mkdtempSync(join(tmpdir(), "ods-empty-"));
  const result = runNode(["bin/run-stdio.mjs", "octen"], {
    ODS_SECRETS_FILE: join(dir, "missing.json"),
    OCTEN_API_KEY: "",
    DEEPSEEK_API_KEY: "",
  });
  rmSync(dir, { recursive: true, force: true });
  if (result.status !== 2) {
    throw new Error(`launcher exit ${result.status}: ${result.stderr}`);
  }
  if (!result.stderr.includes("OCTEN_API_KEY")) {
    throw new Error("launcher did not name the missing variable");
  }
}

function tail(text) {
  if (!text) return "";
  const lines = text.trim().split("\n");
  return lines.slice(-30).join("\n");
}
