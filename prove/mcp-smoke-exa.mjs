#!/usr/bin/env node
/**
 * Keyless Exa hosted MCP smoke: initialize → tools/list → web_search_exa → web_fetch_exa.
 * Endpoint: https://mcp.exa.ai/mcp
 * Transcript: prove/mcp-smoke-exa.jsonl
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXA_MCP_URL } from "../bin/servers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "mcp-smoke-exa.jsonl");
mkdirSync(__dirname, { recursive: true });

const lines = [];
function log(obj) {
  lines.push(obj);
}

const result = {
  server: "exa",
  url: EXA_MCP_URL,
  initialize: "FAIL",
  toolsList: "FAIL",
  toolsCall: "FAIL",
  fetchCall: "FAIL",
  toolNames: [],
  error: null,
};

let session;
try {
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "octen-deepseek-search-prove-exa", version: "1.1.0" },
  });
  result.initialize = init?.serverInfo?.name ? "PASS" : "FAIL";
  result.serverInfo = init?.serverInfo
    ? { name: init.serverInfo.name, version: init.serverInfo.version }
    : undefined;
  await rpcNotify("notifications/initialized", {});

  const listed = await rpc("tools/list", {});
  const names = (listed?.tools || []).map((tool) => tool.name).sort();
  result.toolNames = names;
  result.toolsList =
    names.includes("web_search_exa") && names.includes("web_fetch_exa") ? "PASS" : "FAIL";
  result.agentRunListed = names.includes("agent_run");
  const searchTool = (listed?.tools || []).find((tool) => tool.name === "web_search_exa");
  result.searchRequired = searchTool?.inputSchema?.required || [];

  const call = await rpc("tools/call", {
    name: "web_search_exa",
    arguments: {
      query: "What is the Model Context Protocol",
      objective: "Find an official or primary page that explains MCP.",
      numResults: 1,
    },
  });
  const text = textOf(call);
  const url = text.match(/https?:\/\/[^\s)]+/)?.[0];
  const looksOk = !call?.isError && text.length > 40 && Boolean(url);
  result.toolsCall = looksOk ? "PASS" : "FAIL";
  result.preview = text.slice(0, 240);

  if (url) {
    const fetched = await rpc("tools/call", {
      name: "web_fetch_exa",
      arguments: { urls: [url], maxCharacters: 400 },
    });
    const body = textOf(fetched);
    result.fetchCall = !fetched?.isError && body.length > 40 ? "PASS" : "FAIL";
    result.fetchPreview = body.slice(0, 180);
  } else {
    result.fetchCall = "FAIL";
  }
} catch (error) {
  result.error = String(error && error.message ? error.message : error);
} finally {
  log({ dir: "summary", result });
  writeFileSync(outPath, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
}

console.log(JSON.stringify(result, null, 2));
const ok =
  result.initialize === "PASS" &&
  result.toolsList === "PASS" &&
  result.toolsCall === "PASS" &&
  result.fetchCall === "PASS" &&
  result.agentRunListed === false;
process.exit(ok ? 0 : 1);

async function rpc(method, params) {
  const id = lines.length + 1;
  const message = await post({ jsonrpc: "2.0", id, method, params });
  if (message.error) {
    throw new Error(message.error.message || "rpc error");
  }
  return message.result;
}

async function rpcNotify(method, params) {
  await post({ jsonrpc: "2.0", method, params });
}

async function post(body) {
  log({ dir: "out", method: body.method, id: body.id });
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (session) headers["mcp-session-id"] = session;
  const response = await fetch(EXA_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!session) session = response.headers.get("mcp-session-id") || undefined;
  if (!response.ok && response.status !== 202) {
    throw new Error(`HTTP ${response.status} ${raw.slice(0, 300)}`);
  }
  if (response.status === 202 || raw.trim().length === 0) {
    log({ dir: "in", status: response.status });
    return {};
  }
  const parsed = parseBody(raw);
  log({ dir: "in", msg: summarize(parsed) });
  return parsed;
}

function parseBody(raw) {
  const match = raw.match(/data:\s*(\{[\s\S]*\})\s*$/);
  return JSON.parse(match ? match[1] : raw);
}

function textOf(message) {
  return (message?.content || [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function summarize(message) {
  const copy = JSON.parse(JSON.stringify(message));
  if (Array.isArray(copy.result?.content)) {
    copy.result.content = copy.result.content.map((part) => {
      if (part?.type === "text" && typeof part.text === "string" && part.text.length > 500) {
        return { ...part, text: part.text.slice(0, 500) + "…[truncated]" };
      }
      return part;
    });
  }
  if (Array.isArray(copy.result?.tools)) {
    copy.result.tools = copy.result.tools.map((tool) => ({
      name: tool.name,
      required: tool.inputSchema?.required || [],
    }));
  }
  return copy;
}
