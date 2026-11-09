# Octen + DeepSeek + Exa（Kimi Code / Cursor）

一个插件目录同时给 **Kimi Code 桌面** 和 **Cursor** 用。Exa 走官方托管 MCP，不在这里重写服务器。Octen 与 DeepSeek 仍是原来的 npm 包。

| 服务器 | 怎么接 | 作用 |
| --- | --- | --- |
| `exa` | `https://mcp.exa.ai/mcp` | 免密钥 `web_search_exa`、`web_fetch_exa`。`agent_run` 要登录后才会出现 |
| `octen` | `octen-mcp@0.7.1` | 有密钥后的默认实时网页：search、news、business、place、pulse、broad、extract、image；video 为 beta |
| `deepseek-web` | `mcp-deepseek-search@1.0.1` | 大陆中文网页补充：`deepseek_search`、`deepseek_fetch` |

2026-11-09 在 npm 上核对过：这两个版本就是当时的最新版。

密钥不要写进仓库、README 或截图。Octen / DeepSeek 的密钥用下面的脚本写到本机用户目录。

## 在 Kimi Code 桌面安装

设置 → 插件 → 安装自定义插件。对话框接受 **HTTPS zip**、**GitHub 仓库 URL**、**本地目录**。

`main` 合并这次改动之前，不要填仓库根地址（根地址会装最新 release，没有 release 时才退回默认分支，装到的是还没有 Kimi 清单的旧树）。

把下面这一条整段贴进对话框（GitHub 分支，加载器解析为 ref `cursor/kimi-exa-octen-deepseek-d193`）：

```text
https://github.com/ZEYICHEN-md/octen-deepseek-search/tree/cursor/kimi-exa-octen-deepseek-d193
```

或者贴 HTTPS zip。Kimi 会下载 zip；若压缩包里只有一个顶层目录且该目录含有清单，会自动用那一层。这条 archive 链接就是这种形状：

```text
https://github.com/ZEYICHEN-md/octen-deepseek-search/archive/refs/heads/cursor/kimi-exa-octen-deepseek-d193.zip
```

本地目录：选**解压后直接含有 `kimi.plugin.json` 的那一层**。不要选 `.zip` 文件本身，加载器把绝对路径当成目录，不会再解压。

装好后新开一个会话。Exa 此时就能搜索和抓取，不需要密钥。

清单在仓库根的 `kimi.plugin.json`（Kimi 也认 `.kimi-plugin/plugin.json`；两份同时存在时根上的那份优先）。本仓库只放根上这一份。

### 配置 Octen 和 DeepSeek 密钥

需要 Node.js 18 或更新版本，并且 `npx` 在 PATH 里。Exa 不需要 Node。

在插件目录执行（输入时不回显，终端里不会打印密钥）：

```text
node scripts/setup-secrets.mjs
```

脚本把 `OCTEN_API_KEY` 和 `DEEPSEEK_API_KEY` 写到用户目录，不写进 git 仓库：

- Windows：`%APPDATA%\octen-deepseek-search\secrets.json`
- macOS / Linux：`~/.config/octen-deepseek-search/secrets.json`（若设置了 `XDG_CONFIG_HOME`，用那个目录）

Kimi 安装后实际运行的是拷贝，不跟你原来的文件夹联动。拷贝位置是 `$KIMI_CODE_HOME/plugins/managed/octen-deepseek-search/`。没设置 `KIMI_CODE_HOME` 时，这个目录在用户主目录的 `.kimi-code` 下（Windows 即 `%USERPROFILE%\.kimi-code`）。可以对那份拷贝里的 `scripts/setup-secrets.mjs` 运行同一条命令。密钥文件在插件目录外面，重装插件不会把它清掉。

已经把密钥放在环境变量里时：

```text
node scripts/setup-secrets.mjs --from-env
```

写完后完全退出并重新打开 Kimi Code，再开新会话。

Kimi 启动插件里的 stdio 程序时，`command` 为 `node` 会改写成桌面版自带的 Node，或命令行版的 `kimi __plugin_run_node`。真正的 Octen / DeepSeek 进程仍由 `npx` 拉起官方包。Windows 上 Kimi 自己不能直接启动 `npx.cmd`，所以启动脚本在 Windows 上改走 `cmd.exe`。

### 装好后模型看到的工具名

Kimi 会把插件服务器登记成 `plugin-octen-deepseek-search:<服务器>`，再变成 `mcp__...` 工具 id。路由说明在技能 `search-router`，新会话会自动带上。例如：

- `mcp__plugin-octen-deepseek-search_exa__web_search_exa`
- `mcp__plugin-octen-deepseek-search_octen__search`
- `mcp__plugin-octen-deepseek-search_deepseek-web__deepseek_search`

这些名字用 `@moonshot-ai/kimi-code@2.5.2` 里的 `qualifyMcpToolName` 生成过，长度都小于 64。

## 在 Cursor 安装

Cursor 仍读 `.cursor-plugin/plugin.json` 和 `mcp.json`。Exa 同样是官方 URL。Octen / DeepSeek 仍是 `npx` 加 `${OCTEN_API_KEY}`、`${DEEPSEEK_API_KEY}`，在 Cursor 的插件配置里填这两个变量，不要改 `mcp.json`。

把本目录复制到本机插件目录（复制真实文件夹，不要只放一个指向别处的符号链接）：

- Windows：`%USERPROFILE%\.cursor\plugins\local\octen-deepseek-search`
- macOS / Linux：`~/.cursor/plugins/local/octen-deepseek-search`

然后在 Cursor 里为两个密钥填值并重载 MCP。Cursor 里的工具名是短名：`web_search_exa`、`search`、`deepseek_search` 等。

## 怎么选

1. 还没有 Octen 密钥时，用 Exa。
2. Octen 已连接时，一般实时网页用 Octen。
3. 需要大陆中文来源，而 Octen / Exa 不够时，再用 DeepSeek。
4. 只引用工具返回的 URL 和正文。

`web_search_exa` 要同时给 `query` 和 `objective`。

## 本地复查

```text
node prove/run-all.mjs
```

没有 API 密钥时：Exa 会做 initialize、tools/list、搜索和抓取；DeepSeek 能完成 initialize 和 tools/list，搜索调用会返回缺少 `DEEPSEEK_API_KEY`；Octen 能完成 initialize 和 tools/list，不发起搜索。详见 [PROVE.md](./PROVE.md)。

## 这次没有覆盖的部分

- 没有在你的 Windows 桌面里点过安装对话框，不能把那一步说成已验证。
- 没有 Octen / DeepSeek / Exa 的私有密钥，所以没有做带鉴权的搜索或 `agent_run`。
- `agent_run` 在免密钥连接里不会出现。清单里故意不写 `bearerTokenEnvVar`：Kimi 在该变量为空时会直接拒绝连接，免密钥搜索会一起坏掉。需要 `agent_run` 时，用 Kimi 的 HTTP OAuth（文档中的 `/mcp-config login`；插件运行时服务器名是 `plugin-octen-deepseek-search:exa`）。本次没有完成 Exa 登录。
- 官方加载器对带斜杠的分支，下载地址是 `https://codeload.github.com/ZEYICHEN-md/octen-deepseek-search/zip/cursor/kimi-exa-octen-deepseek-d193`（没有 `refs/heads`）。推送后要核对这个地址是否返回 200；若不是，对话框改贴上面的 archive zip。

## 许可

MIT
