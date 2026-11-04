# PROVE — octen-deepseek-search plugin (local)

Proven on the shared box. Times below are **Asia/Shanghai (CST, UTC+8)**.

Date: 2026-11-04 ~21:33 CST

## What was proven

| Step | Result | Notes |
|------|--------|-------|
| Cursor `.cursor-plugin/plugin.json` | **PASS** | kebab-case `name`: `octen-deepseek-search`; `displayName` Octen + DeepSeek Search; both `OCTEN_API_KEY` and `DEEPSEEK_API_KEY` required |
| `mcp.json` dual servers | **PASS** | `octen` → `octen-mcp@0.7.1`; `deepseek-web` → `mcp-deepseek-search@1.0.1`; only `${VAR}` placeholders |
| Octen MCP smoke: `initialize` | **PASS** | `serverInfo.name=octen-mcp`, `version=0.7.1` |
| Octen MCP smoke: `tools/list` | **PASS** | 9 tools: `broad_search`, `business_search`, `extract`, `image_search`, `news_search`, `place_search`, `pulse_search`, `search`, `video_search` |
| Octen MCP smoke: `tools/call` `search` | **SKIP** (local) | Account-level Octen smoke already passed earlier; re-run with `OCTEN_SMOKE_CALL=1`. Transcript: `prove/mcp-smoke-octen.jsonl` (LEAK_CHECK PASS) |
| DeepSeek MCP smoke: `initialize` | **PASS** | `serverInfo.name=mcp-deepseek-search`, `version=1.0.1` |
| DeepSeek MCP smoke: `tools/list` | **PASS** | `deepseek_fetch`, `deepseek_search` |
| DeepSeek MCP smoke: `tools/call` `deepseek_search` | **PASS** | Query `MCP 协议 lang:zh`, `count=1`; real URL + scores. Transcript: `prove/mcp-smoke-deepseek.jsonl` (LEAK_CHECK PASS) |
| Install path real directory | **PASS** | Copied (not symlinked) to `~/.cursor/plugins/local/octen-deepseek-search` |
| Secret scan of tree | **PASS** | No keyfile contents or `.env` secrets in tracked files |

## Paths

| Role | Absolute path |
|------|----------------|
| Plugin git repo | `/workspace/octen-deepseek-search/` |
| Local Cursor install (real dir) | `/home/box/.cursor/plugins/local/octen-deepseek-search/` |
| Octen smoke | `prove/mcp-smoke-octen.mjs` → `prove/mcp-smoke-octen.jsonl` |
| DeepSeek smoke | `prove/mcp-smoke-deepseek.mjs` → `prove/mcp-smoke-deepseek.jsonl` |
| Keyfiles (never committed) | `~/.config/octen/api_key`, `~/.config/deepseek/api_key` |
| Source trees merged from | `/workspace/octen-search-plugin/`, `/workspace/deepseek-china-search-plugin/` |

## Important runtime note

**Grok Bot does not load `~/.cursor/plugins/local`.** Local prove matters for Cursor IDE. On this box live runtimes remain connectors `user-octen` and `user-deepseek-web`.

## How to re-run smoke

```bash
export OCTEN_API_KEY="$(cat ~/.config/octen/api_key)"
export DEEPSEEK_API_KEY="$(cat ~/.config/deepseek/api_key)"
cd /workspace/octen-deepseek-search
node prove/mcp-smoke-octen.mjs
# optional: OCTEN_SMOKE_CALL=1 node prove/mcp-smoke-octen.mjs
node prove/mcp-smoke-deepseek.mjs
unset OCTEN_API_KEY DEEPSEEK_API_KEY
```

## Opening a PR / remote

skip — no remote requested (parent may push later)

## Design reminder

Thin wrap of `octen-mcp@0.7.1` + `mcp-deepseek-search@1.0.1`; Octen is default live web; DeepSeek is CN/Chinese-web supplement via skill routing.
