import type { ClaudeAdapter } from "@vco/shared";
import { AnthropicApiAdapter } from "./anthropic-api-adapter.js";
import { ClaudeCliAdapter } from "./claude-cli-adapter.js";

export type ClaudeProvider = "api" | "cli";

export interface ClaudeAdapterOptions {
  provider?: ClaudeProvider;
  apiKey?: string;
  model?: string;
  cliPath?: string;
}

/** Build the Claude adapter from config (spec §13: CLAUDE_CODE_PROVIDER). */
export function createClaudeAdapter(opts: ClaudeAdapterOptions = {}): ClaudeAdapter {
  const provider = opts.provider ?? "api";
  if (provider === "cli") {
    return new ClaudeCliAdapter({ cliPath: opts.cliPath, model: opts.model });
  }
  return new AnthropicApiAdapter({ apiKey: opts.apiKey, model: opts.model });
}
