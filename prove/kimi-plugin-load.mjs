#!/usr/bin/env node
/**
 * Load this plugin with the published Kimi Code runtime
 * (@moonshot-ai/kimi-code@2.5.2), which bundles the same PluginManager as
 * MoonshotAI/kimi-code. The CLI has no non-interactive install command, so
 * this imports PluginManager from that build and calls install().
 *
 * Covers a local directory, a zip with the plugin root at the archive root,
 * and a single-wrapper zip (the shape GitHub archive URLs use).
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { listPluginFiles, zipStore } from "../scripts/pack-plugin.mjs";
import { EXA_MCP_URL } from "../bin/servers.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KIMI_VERSION = "2.5.2";
const BRANCH_URL =
  "https://github.com/ZEYICHEN-md/octen-deepseek-search/tree/cursor/kimi-exa-octen-deepseek-d193";
const ARCHIVE_ZIP =
  "https://github.com/ZEYICHEN-md/octen-deepseek-search/archive/refs/heads/cursor/kimi-exa-octen-deepseek-d193.zip";

const EXPECTED_TOOLS = {
  "plugin-octen-deepseek-search:exa": [
    "web_search_exa",
    "web_fetch_exa",
    "web_search_advanced_exa",
    "agent_run",
  ],
  "plugin-octen-deepseek-search:octen": [
    "search",
    "news_search",
    "business_search",
    "place_search",
    "pulse_search",
    "broad_search",
    "extract",
    "image_search",
    "video_search",
  ],
  "plugin-octen-deepseek-search:deepseek-web": ["deepseek_search", "deepseek_fetch"],
};

const summary = {
  kimiPackage: KIMI_VERSION,
  local: "FAIL",
  zipRoot: "FAIL",
  zipWrapped: "FAIL",
  githubUrl: "FAIL",
  archiveZipUrl: "FAIL",
  qualified: "FAIL",
  error: null,
};

try {
  const api = await loadKimiApi();
  const files = listPluginFiles(repoRoot);

  const local = await installFrom(api, repoRoot);
  assertInstall(local, "local");
  summary.local = "PASS";
  summary.localDetail = publicDetail(local);

  const rootZip = zipStore(repoRoot, files);
  const rootInstalled = await installZip(api, rootZip, "root.zip");
  assertInstall(rootInstalled, "zip-root");
  summary.zipRoot = "PASS";

  const wrapped = zipStore(repoRoot, files, "octen-deepseek-search-branch/");
  const wrappedInstalled = await installZip(api, wrapped, "wrapped.zip");
  assertInstall(wrappedInstalled, "zip-wrapped");
  summary.zipWrapped = "PASS";

  const branch = api.proveResolve(BRANCH_URL);
  if (
    branch.kind !== "github" ||
    branch.owner !== "ZEYICHEN-md" ||
    branch.repo !== "octen-deepseek-search" ||
    branch.ref?.kind !== "branch" ||
    branch.ref?.value !== "cursor/kimi-exa-octen-deepseek-d193"
  ) {
    throw new Error(`branch URL parsed as ${JSON.stringify(branch)}`);
  }
  summary.githubUrl = "PASS";
  summary.githubParsed = branch;

  const archive = api.proveResolve(ARCHIVE_ZIP);
  if (archive.kind !== "zip-url" || archive.path !== ARCHIVE_ZIP) {
    throw new Error(`archive URL parsed as ${JSON.stringify(archive)}`);
  }
  summary.archiveZipUrl = "PASS";

  const names = {};
  for (const [server, tools] of Object.entries(EXPECTED_TOOLS)) {
    names[server] = {};
    for (const tool of tools) {
      const qualified = api.proveQualify(server, tool);
      if (qualified.length > 64) throw new Error(`${qualified} exceeds 64`);
      if (!qualified.startsWith("mcp__")) throw new Error(qualified);
      names[server][tool] = qualified;
    }
  }
  summary.qualified = "PASS";
  summary.toolIds = names;
} catch (error) {
  summary.error = String(error && error.stack ? error.stack : error);
}

console.log(JSON.stringify(summary, null, 2));
const ok = ["local", "zipRoot", "zipWrapped", "githubUrl", "archiveZipUrl", "qualified"].every(
  (key) => summary[key] === "PASS",
);
process.exit(ok ? 0 : 1);

async function loadKimiApi() {
  const pkg = ensurePackage();
  const source = readFileSync(join(pkg, "dist", "main.mjs"), "utf8");
  const marker = "// src/main.ts\ninit_askpass();\n";
  const idx = source.lastIndexOf(marker);
  if (idx < 0) throw new Error("Installed kimi bundle has no recognizable startup tail");
  const patched =
    source.slice(0, idx) +
    `
export async function proveInstall(home, source) {
  init_manager$1();
  init_tool_naming();
  init_source$3();
  const mgr = new PluginManager({
    kimiHomeDir: home,
    client: "desktop",
    platform: process.platform,
  });
  await mgr.load();
  const record = await mgr.install(source);
  return {
    id: record.id,
    state: record.state,
    diagnostics: record.diagnostics,
    manifestKind: record.manifestKind,
    sessionStart: record.manifest && record.manifest.sessionStart,
    skills: (record.skills || []).map((skill) => skill.name).sort(),
    locales: record.interfaceLocales ? Object.keys(record.interfaceLocales).sort() : [],
    mcp: sanitizeServers(mgr.enabledMcpServers()),
  };
}
function sanitizeServers(servers) {
  const out = {};
  for (const [name, config] of Object.entries(servers)) {
    out[name] = {
      transport: config.transport,
      command: config.command,
      args: config.args,
      url: config.url,
      cwd: config.cwd ? "<set>" : undefined,
      envKeys: config.env ? Object.keys(config.env).sort() : [],
      startupTimeoutMs: config.startupTimeoutMs,
    };
  }
  return out;
}
export function proveResolve(source) {
  init_source$3();
  return resolveInstallSource(source);
}
export function proveQualify(serverName, toolName) {
  init_tool_naming();
  return qualifyMcpToolName(serverName, toolName);
}
`;
  const dest = join(pkg, "dist", "main.prove.mjs");
  writeFileSync(dest, patched);
  return import(pathToFileURL(dest).href);
}

function ensurePackage() {
  const fromEnv = process.env.KIMI_CODE_PACKAGE;
  if (fromEnv && existsMain(fromEnv)) return fromEnv;
  const cached = "/tmp/kimi-npm/node_modules/@moonshot-ai/kimi-code";
  if (existsMain(cached)) return cached;
  const dir = join(repoRoot, "prove", ".tmp", "kimi-npm");
  mkdirSync(dir, { recursive: true });
  const installed = spawnSync(
    "npm",
    ["install", "--omit=dev", `@moonshot-ai/kimi-code@${KIMI_VERSION}`],
    { cwd: dir, stdio: "inherit" },
  );
  if (installed.status !== 0) throw new Error("npm install @moonshot-ai/kimi-code failed");
  return join(dir, "node_modules", "@moonshot-ai", "kimi-code");
}

function existsMain(pkg) {
  try {
    readFileSync(join(pkg, "dist", "main.mjs"), "utf8");
    return true;
  } catch {
    return false;
  }
}

async function installFrom(api, source) {
  const home = mkdtempSync(join(tmpdir(), "kimi-plugin-home-"));
  try {
    return await api.proveInstall(home, source);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

async function installZip(api, bytes, name) {
  const server = createServer((req, res) => {
    res.writeHead(200, {
      "content-type": "application/zip",
      "content-length": bytes.length,
    });
    res.end(bytes);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/${name}`;
  try {
    return await installFrom(api, url);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

function assertInstall(record, label) {
  const errors = (record.diagnostics || []).filter((item) => item.severity === "error");
  if (record.state !== "ok" || errors.length > 0) {
    throw new Error(`${label} manifest not ok: ${JSON.stringify(record.diagnostics)}`);
  }
  if (record.id !== "octen-deepseek-search") throw new Error(`${label} id ${record.id}`);
  if (record.manifestKind !== "kimi-plugin-root") {
    throw new Error(`${label} manifestKind ${record.manifestKind}`);
  }
  if (record.sessionStart?.skill !== "search-router") {
    throw new Error(`${label} sessionStart ${JSON.stringify(record.sessionStart)}`);
  }
  for (const skill of [
    "search-router",
    "exa-web-search",
    "octen-web-search",
    "deepseek-china-search",
  ]) {
    if (!record.skills.includes(skill)) throw new Error(`${label} missing skill ${skill}`);
  }
  if (!record.locales.includes("zh-CN")) throw new Error(`${label} locales ${record.locales}`);
  const mcp = record.mcp;
  const exa = mcp["plugin-octen-deepseek-search:exa"];
  const octen = mcp["plugin-octen-deepseek-search:octen"];
  const deepseek = mcp["plugin-octen-deepseek-search:deepseek-web"];
  if (!exa || exa.url !== EXA_MCP_URL || exa.transport !== "http") {
    throw new Error(`${label} exa ${JSON.stringify(exa)}`);
  }
  for (const entry of [octen, deepseek]) {
    if (!entry || entry.transport !== "stdio" || entry.command !== "node") {
      throw new Error(`${label} stdio ${JSON.stringify(entry)}`);
    }
    if (entry.cwd !== "<set>") throw new Error(`${label} cwd missing`);
    if (!entry.envKeys.includes("KIMI_PLUGIN_ROOT") || !entry.envKeys.includes("KIMI_CODE_HOME")) {
      throw new Error(`${label} env ${entry.envKeys}`);
    }
    if (entry.envKeys.some((key) => /API_KEY/i.test(key))) {
      throw new Error(`${label} secret env key in manifest runtime`);
    }
  }
  const octenArgs = entryArgs(octen);
  const deepseekArgs = entryArgs(deepseek);
  if (!octenArgs.includes("octen") || !octenArgs.some((arg) => arg.includes("run-stdio.mjs"))) {
    throw new Error(`${label} octen args ${octenArgs}`);
  }
  if (!deepseekArgs.includes("deepseek")) {
    throw new Error(`${label} deepseek args ${deepseekArgs}`);
  }
}

function entryArgs(entry) {
  return entry.args || [];
}

function publicDetail(record) {
  return {
    id: record.id,
    state: record.state,
    skills: record.skills,
    locales: record.locales,
    diagnostics: record.diagnostics,
    servers: Object.keys(record.mcp),
  };
}
