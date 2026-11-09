# PROVE — Kimi 清单与 Exa / Octen / DeepSeek

日期：2026-11-09。运行环境是 Linux，Node.js v22。使用的 Kimi 运行时是 npm 上的 `@moonshot-ai/kimi-code@2.5.2`（其中带有 `PluginManager`、`qualifyMcpToolName`、zip 根目录识别和 GitHub URL 解析）。对照阅读的上游源码是 `MoonshotAI/kimi-code` 提交 `97637e54a079cace2ba710b38ffb4ed85b232351`。

没有在用户的 Kimi Code 桌面里操作安装对话框。

## 结果

| 步骤 | 结果 |
| --- | --- |
| `kimi.plugin.json` 被 PluginManager 从本地目录安装 | PASS，`state=ok`，diagnostics 为空 |
| 插件根就在 zip 根上的 HTTPS zip | PASS |
| 只有一个顶层目录的 zip（GitHub archive 的形状） | PASS，会落到含 `kimi.plugin.json` 的那一层 |
| 分支 URL 解析 | PASS，ref = `cursor/kimi-exa-octen-deepseek-d193` |
| archive zip URL 解析 | PASS，种类是 `zip-url`，不会被当成 GitHub 安装 |
| 运行时服务器名 | `plugin-octen-deepseek-search:exa`、`:octen`、`:deepseek-web` |
| Exa 是 HTTP，URL 为 `https://mcp.exa.ai/mcp` | PASS |
| Octen / DeepSeek 的 command 是 `node`，参数指向 `./bin/run-stdio.mjs`，cwd 已设置 | PASS |
| 运行时 env 只有 `KIMI_CODE_HOME` 与 `KIMI_PLUGIN_ROOT` 这类注入，没有 API key 字段 | PASS |
| 四个 skill 都被发现，`sessionStart.skill` 为 `search-router`，locale `zh-CN` | PASS |
| `qualifyMcpToolName` 与技能里的 id 一致，长度均小于 64 | PASS |
| Exa 免密钥 initialize | PASS，`exa-search-server` 3.5.0 |
| Exa tools/list | PASS，只有 `web_search_exa`、`web_fetch_exa`；没有 `agent_run` |
| Exa `web_search_exa`（带 `query` 和 `objective`） | PASS，返回真实 URL |
| Exa `web_fetch_exa` | PASS |
| DeepSeek initialize / tools/list | PASS，`mcp-deepseek-search` 1.0.1，工具 `deepseek_search`、`deepseek_fetch` |
| DeepSeek 搜索 | AUTH_REQUIRED。无密钥时工具返回 `DEEPSEEK_API_KEY is not set`。没有可用的私有密钥，未做成功搜索 |
| Octen initialize / tools/list | PASS，`octen-mcp` 0.7.1，九个工具与原先一致 |
| Octen 搜索 | SKIP_NO_KEY。没有私有密钥，未调用 `search` |
| `bin/run-stdio.mjs` 用临时假密钥拉起两个官方包并完成 initialize | PASS。假密钥未出现在输出里 |
| 缺少密钥时启动脚本退出码 2，并指出变量名 | PASS |
| `setup-secrets.mjs --from-env` 写入用户目录外的临时文件，模式 0600，标准输出不含密钥；指向仓库内的路径被拒绝 | PASS |
| 仓库密钥扫描 | PASS |
| npm 版本 | `octen-mcp@0.7.1`、`mcp-deepseek-search@1.0.1` 为 2026-11-09 登记的最新版 |

重跑：

```text
node prove/run-all.mjs
```

## 加载器里和安装有关的事实

- 清单路径：`kimi.plugin.json` 优先于 `.kimi-plugin/plugin.json`。
- stdio 的 `command` 只能是 PATH 上的命令，或以 `./` 开头且留在插件目录内。`npx` 在 Windows 上是 `.cmd`，当前 v2 `HostProcessService.spawn` 不经过 shell，直接 spawn 会 ENOENT。因此 Kimi 清单使用 `command: "node"`，由 `bin/run-stdio.mjs` 再启动 `npx`；Windows 分支使用 `cmd.exe /d /s /c`。这条 Windows 分支没有在 Windows 上跑过。
- HTTP 的 `bearerTokenEnvVar` 会读环境变量并设置 `Authorization: Bearer`。变量为空时连接直接失败。Exa 与 Octen 的官方鉴权头是 `x-api-key`，不是 Bearer。Exa 免密钥不需要这个字段。
- 插件 MCP 不会展开 `${OCTEN_API_KEY}` 这种占位符。Cursor 的 `mcp.json` 仍保留占位符，供 Cursor 自己的变量系统使用。

## 未验证

- 用户机器上的 Kimi Code 桌面安装对话框。
- 带真实密钥的 Octen 搜索、DeepSeek 搜索，以及 Exa `agent_run`。
## 推送后的下载地址

| URL | 结果 |
| --- | --- |
| `https://codeload.github.com/ZEYICHEN-md/octen-deepseek-search/zip/cursor/kimi-exa-octen-deepseek-d193` | HTTP 200，zip。这是加载器对分支 URL 实际请求的地址 |
| `https://github.com/ZEYICHEN-md/octen-deepseek-search/archive/refs/heads/cursor/kimi-exa-octen-deepseek-d193.zip` | HTTP 200，zip。唯一顶层目录内含 `kimi.plugin.json` |
| `https://codeload.github.com/ZEYICHEN-md/octen-deepseek-search/zip/03823034cc4a13f08362db65cebc9519c36b005c` | HTTP 200。这是提交 SHA 形式；文档提交之后 SHA 会变，安装请用分支地址 |
