import type { CodexAdapter } from "@vco/shared";
import { CodexCliAdapter } from "./codex-cli-adapter.js";
import { CodexSdkAdapter } from "./codex-sdk-adapter.js";

export type CodexProvider = "cli" | "sdk";

export interface CodexAdapterOptions {
  provider?: CodexProvider;
  cliPath?: string;
  model?: string;
  sandboxMode?: string;
}

/** Build the Codex adapter from config (spec §13: CODEX_PROVIDER). */
export function createCodexAdapter(opts: CodexAdapterOptions = {}): CodexAdapter {
  if (opts.provider === "sdk") {
    return new CodexSdkAdapter({ model: opts.model });
  }
  return new CodexCliAdapter({
    cliPath: opts.cliPath,
    model: opts.model,
    sandboxMode: opts.sandboxMode,
  });
}
