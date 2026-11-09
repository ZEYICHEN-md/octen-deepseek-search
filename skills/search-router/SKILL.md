---
name: search-router
description: >-
  需要实时网页、来源、新闻、公司或地点、阅读已知 URL，或中文网页补充时使用。
  按本插件实际列出的工具 id 调用 Exa、Octen、DeepSeek。
---

# 搜索路由

先看本会话工具列表里的 id，用列表中的名字调用。下面的 Kimi id 来自官方 `qualifyMcpToolName`：服务器运行时名字是 `plugin-octen-deepseek-search:<服务器>`，`:` 会变成 `_`，前缀是 `mcp__`。长度都小于 64，没有被截断哈希。

Cursor 里同一插件的 MCP 工具用原名，服务器 id 分别是 `exa`、`octen`、`deepseek-web`。

## 先选哪一台

1. **还没有 Octen 密钥，或 Octen 起不来**：用 Exa。免密钥连接 `https://mcp.exa.ai/mcp` 时，列表里是 `web_search_exa` 和 `web_fetch_exa`。
2. **Octen 已连接**：实时网页、新闻、公司/人物、地点、图片、已知 URL 正文，优先用 Octen。
3. **要大陆中文网页，而且 Octen / Exa 的来源不够**（政策原文、A 股中文研报、中文媒体、国内产品文档）：再用 DeepSeek 的 `deepseek_search`，必要时 `deepseek_fetch`。
4. **用户点名 Exa**：用 Exa。

`agent_run` 和 `web_search_advanced_exa` 只在工具列表里出现时才能调用。免密钥连接下实测列表没有这两项。

## Kimi Code 工具 id

| 用途 | Kimi 工具 id |
| --- | --- |
| Exa 搜索 | `mcp__plugin-octen-deepseek-search_exa__web_search_exa` |
| Exa 读页面 | `mcp__plugin-octen-deepseek-search_exa__web_fetch_exa` |
| Octen 默认搜索 | `mcp__plugin-octen-deepseek-search_octen__search` |
| Octen 新闻 | `mcp__plugin-octen-deepseek-search_octen__news_search` |
| Octen 公司/人物 | `mcp__plugin-octen-deepseek-search_octen__business_search` |
| Octen 地点 | `mcp__plugin-octen-deepseek-search_octen__place_search` |
| Octen 文档 URL | `mcp__plugin-octen-deepseek-search_octen__pulse_search` |
| Octen 多角度 | `mcp__plugin-octen-deepseek-search_octen__broad_search` |
| Octen 读 URL | `mcp__plugin-octen-deepseek-search_octen__extract` |
| Octen 图片 | `mcp__plugin-octen-deepseek-search_octen__image_search` |
| Octen 视频（beta） | `mcp__plugin-octen-deepseek-search_octen__video_search` |
| DeepSeek 搜索 | `mcp__plugin-octen-deepseek-search_deepseek-web__deepseek_search` |
| DeepSeek 读页面 | `mcp__plugin-octen-deepseek-search_deepseek-web__deepseek_fetch` |

## Cursor 工具原名

- Exa：`web_search_exa`、`web_fetch_exa`
- Octen：`search`、`news_search`、`business_search`、`place_search`、`pulse_search`、`broad_search`、`extract`、`image_search`、`video_search`
- DeepSeek：`deepseek_search`、`deepseek_fetch`

## 参数

Exa `web_search_exa` 的 schema 要求 `query` 和 `objective`。`query` 写成想找到的页面描述。`web_fetch_exa` 传 `urls` 数组。

Octen 与 DeepSeek 的字段和路由见同插件的 `octen-web-search`、`deepseek-china-search`。只引用工具返回的 URL、标题和正文。

Octen 返回 401 时说明需要有效的 `OCTEN_API_KEY`（运行 `node scripts/setup-secrets.mjs`）。DeepSeek 返回 401 是密钥无效，402 是余额不足。
