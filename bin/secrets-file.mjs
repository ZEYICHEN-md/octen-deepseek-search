import { homedir, platform } from "node:os";
import { join } from "node:path";

/** Names written to the local secrets file. Values never go in the git repo. */
export const SECRET_KEYS = ["OCTEN_API_KEY", "DEEPSEEK_API_KEY"];

/**
 * Per-user secrets path, outside the plugin directory.
 * Override with ODS_SECRETS_FILE for tests. Do not point that override at the repo.
 */
export function defaultSecretsPath() {
  if (process.env.ODS_SECRETS_FILE) return process.env.ODS_SECRETS_FILE;
  if (platform() === "win32") {
    const base = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(base, "octen-deepseek-search", "secrets.json");
  }
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "octen-deepseek-search", "secrets.json");
}
