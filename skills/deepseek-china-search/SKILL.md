---
name: deepseek-china-search
description: >-
  Supplement when Octen / global search lacks Mainland China / Chinese-web
  sources (国内政策、A股中文研报、中文媒体、公众号与国内产品文档等). Not the default search
  path; call only when that gap is clear and the extra DeepSeek Search/Fetch
  cost is justified.
---
# DeepSeek China search (on-demand supplement)

## When to use
Load this skill only when **Octen or other global search is a poor fit for Mainland China / Chinese-web sources** and you still need that coverage. Examples: 国内政策与监管原文、A股/港股中文研报与公告、中文媒体与论坛、国内产品文档与公众号二次传播前的一手中文页。

**Do not** use DeepSeek as the default search, for every Chinese-language question, or when Octen / Tavily / Bright Data / Exa / built-in WebSearch / X already answer well. Prefer Octen (this plugin) for general live web work, and X / overseas tools for global and frontier English context. DeepSeek Search and Fetch are billed per successful call (~¥5 / 1,000), so skip them unless the gap is clear.

## Domain shapes (do not invent fields)
Organize around these shapes returned by the MCP tools. Never invent URLs, titles, scores, or body text.

```
SearchHit = {
  title, url, snippet,
  summary?,          # longer model-facing summary when present
  rerank_score,      # 0–3; ≥ 1.5 = highly relevant
  authority,         # 0–4, or -1 unknown; ≥ 3 = highly authoritative
  site_name?, date?
}

FetchPage = { url → markdown }  # title + Markdown content (truncated)
```

## Tools
Two MCP tools (do **not** invent other tool names):

1. `deepseek_search` — ranked web results from DeepSeek's own engine → `SearchHit[]`.
2. `deepseek_fetch` — one URL → Markdown body (`FetchPage`) after search when a summary is not enough.

### Tool ids
Use the id that is actually listed in the session.

- **Kimi Code:** `mcp__plugin-octen-deepseek-search_deepseek-web__deepseek_search` and `mcp__plugin-octen-deepseek-search_deepseek-web__deepseek_fetch`.
- **Cursor:** MCP server `deepseek-web`, short names `deepseek_search` and `deepseek_fetch`.

## How to call search
- Keep `query` ≤ 128 Unicode chars.
- For Chinese-web intent, add `lang:zh` (or `lang:zh,en`) in the query when helpful.
- Pass `ori_question` as the user's short original ask when you rewrote the query.
- Default `need_content=false` (summaries only). Set `true` only when you need body text in the same call; otherwise search → pick URLs → `deepseek_fetch`.
- Prefer results with `rerank_score` ≥ 1.5 and `authority` ≥ 3 when choosing what to cite or fetch.
- Do **not** pass `localization` (IP) unless the user explicitly asked for geo-localized results and consented to using an IP for that.
- On HTTP 402 (balance), stop and tell the user DeepSeek balance is empty. On 401, the key is invalid — ask them to refresh it. On 429/408/5xx, wait and retry once.

## Routing with other search
1. Prefer Octen (`octen-web-search` skill) and the usual stack first (other connectors, WebSearch, X for public posts).
2. If results are thin on Mainland China sources, **then** call `deepseek_search` once with a tight query.
3. Fetch only the 1–3 URLs you will actually use.
4. Cite real URLs from the tool output; never invent sources.

## Out of scope
Model chat completions, DeepSeek Harness, or replacing Octen/Tavily/Bright Data/Exa for general web research.
