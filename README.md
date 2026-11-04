# Octen + DeepSeek Search（Cursor / Agent Plugin）

把两套搜索能力合成一个可本地安装的 Cursor Plugin：

| Server | Package | Role |
|--------|---------|------|
| `octen` | `octen-mcp@0.7.1` | **Default** live web: search, news, business, place, pulse, broad, extract, image; video beta |
| `deepseek-web` | `mcp-deepseek-search@1.0.1` | **Supplement** for Mainland China / Chinese-web when Octen or other tools lack CN sources |

附带两条路由 skill：`octen-web-search`（默认前门）与 `deepseek-china-search`（国内源补充）。

**不做** marketplace / cursor.directory 上架；本仓库负责可移植的本地安装包。

文档：[Octen MCP](https://docs.octen.ai/integrations/octen-mcp-server) · [Octen-Team/octen-mcp](https://github.com/Octen-Team/octen-mcp) · DeepSeek Platform

## When to use which

1. **Live / global web** → Octen (`search` 默认；见 skill 路由表).
2. **CN gap after Octen (or other tools) is thin** → DeepSeek `deepseek_search` / `deepseek_fetch`.
3. Do **not** make DeepSeek the default for every Chinese-language question.

## Domain shapes

### Octen

```
SearchHit      = { title, url, highlight?, time_published?, time_last_crawled? }
ExtractPage    = { url, status, title?, full_content?|highlights?, category?, page_structure? }
NewsSubject    = storyline summary + supporting articles (from news_search.subjects)
BusinessEntity = company/person card (profile, financials, people, activities)
PlaceCard      = address, coordinates, phone, hours, rating, optional distance
```

Tools: `search` · `news_search` · `business_search` · `place_search` · `pulse_search` · `broad_search` · `extract` · `image_search` · `video_search`（beta）

### DeepSeek

```
SearchHit = { title, url, snippet, summary?, rerank_score, authority, site_name?, date? }
FetchPage = { url → markdown }
```

Tools: `deepseek_search` · `deepseek_fetch`

Never invent URLs, titles, scores, or body text — cite only tool output.

## Dependencies

- Node.js + `npx`
- **Both** API keys (plugin `variables` require them):
  - `OCTEN_API_KEY` — [Octen docs / platform](https://docs.octen.ai/integrations/octen-mcp-server)
  - `DEEPSEEK_API_KEY` — [platform.deepseek.com](https://platform.deepseek.com)（DeepSeek Search/Fetch 约 ¥5 / 1,000 次成功调用，以官方为准）

**永远不要**把密钥写进仓库、README、截图或证明日志。

## Install（Cursor IDE）

1. 拷到真实路径（不要用指向仓库外的 symlink）：

   ```bash
   mkdir -p ~/.cursor/plugins/local
   rsync -a --delete \
     --exclude .git \
     /path/to/octen-deepseek-search/ \
     ~/.cursor/plugins/local/octen-deepseek-search/
   ```

2. Cursor：**Plugins → Configure**，分别为 `OCTEN_API_KEY` 与 `DEEPSEEK_API_KEY` 填密钥（只存在客户端配置里）。
3. 重载 MCP 后应出现服务器 `octen`（九工具）与 `deepseek-web`（两工具）。
4. Skills `octen-web-search`、`deepseek-china-search` 随插件加载。

`mcp.json` 里只有占位符：

```json
{
  "mcpServers": {
    "octen": {
      "command": "npx",
      "args": ["-y", "octen-mcp@0.7.1"],
      "env": { "OCTEN_API_KEY": "${OCTEN_API_KEY}" }
    },
    "deepseek-web": {
      "command": "npx",
      "args": ["-y", "mcp-deepseek-search@1.0.1"],
      "env": { "DEEPSEEK_API_KEY": "${DEEPSEEK_API_KEY}" }
    }
  }
}
```

Octen 托管端点备选：`https://mcp.octen.ai/mcp` + header `x-api-key`（见官方文档；与本插件本地 stdio 包装并行可用）。

## Grok Bot（本机已有接线）

这台共享云电脑上，Grok Bot **不会**加载 `~/.cursor/plugins/local`。运行时仍走已连接的 connectors：

- `user-octen` · keyfile `~/.config/octen/api_key`
- `user-deepseek-web` · wrapper `/home/box/bin/deepseek-mcp` · keyfile `~/.config/deepseek/api_key`
- 工作流 skills：`octen-web-search`、`deepseek-china-search`（与本插件 skill 对齐）

插件仓库与上述接线内容对齐；改 skill 文案时请两边同步。

## 本地证明

见 [`PROVE.md`](./PROVE.md)。有密钥时分别对两个 MCP 做 `initialize` → `tools/list`（可选真实 call）。

```bash
export OCTEN_API_KEY="$(cat ~/.config/octen/api_key)"
export DEEPSEEK_API_KEY="$(cat ~/.config/deepseek/api_key)"
cd /path/to/octen-deepseek-search
node prove/mcp-smoke-octen.mjs
node prove/mcp-smoke-deepseek.mjs
unset OCTEN_API_KEY DEEPSEEK_API_KEY
```

## 设计取舍

- **薄封装**：复用官方/社区 npm MCP，不手写服务器。
- **合仓**：一份插件同时声明两套 `variables` + 两台 MCP，安装一次即可路由。
- **Cursor Plugin 为主**：`variables` + `${…}` 占位；不发布 Marketplace（除非另开任务）。

## License

MIT
