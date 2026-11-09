/**
 * Pinned MCP packages. Cursor mcp.json and the Kimi stdio launcher both use these.
 * Versions checked against the npm registry on 2026-11-09: both are the latest.
 */
export const OCTEN_PACKAGE = "octen-mcp@0.7.1";
export const DEEPSEEK_PACKAGE = "mcp-deepseek-search@1.0.1";
export const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

export const STDIO_SERVERS = {
  octen: {
    npm: OCTEN_PACKAGE,
    key: "OCTEN_API_KEY",
  },
  deepseek: {
    npm: DEEPSEEK_PACKAGE,
    key: "DEEPSEEK_API_KEY",
  },
};
