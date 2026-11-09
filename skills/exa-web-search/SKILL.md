---
name: exa-web-search
description: >-
  Use Exa's hosted MCP for live web search and reading known URLs. Keyless
  connection exposes web_search_exa and web_fetch_exa. Prefer this when Octen
  is not configured, when the user asks for Exa, or when a second web index helps.
---

# Exa web search

Official hosted server: `https://mcp.exa.ai/mcp` (package is not reimplemented here).

Keyless `tools/list` returns exactly:

- `web_search_exa`
- `web_fetch_exa`

`agent_run` and `web_search_advanced_exa` are absent until the connection is authenticated. Call them only when they appear in the tool list.

## Tool ids

Kimi Code qualifies plugin tools. Use the listed id:

- `mcp__plugin-octen-deepseek-search_exa__web_search_exa`
- `mcp__plugin-octen-deepseek-search_exa__web_fetch_exa`

Cursor server id `exa` keeps the short names `web_search_exa` and `web_fetch_exa`.

## Calls

`web_search_exa` schema requires:

- `query` — natural-language description of the page to find
- `objective` — what should rank first and which facts to pull

Optional: `numResults`.

`web_fetch_exa` requires `urls` (array). Optional: `maxCharacters`.

Cite only URLs and text returned by the tool. When Octen is connected and the question is general live web, follow `search-router` and prefer Octen; use Exa when Octen is down or the user asked for Exa.
