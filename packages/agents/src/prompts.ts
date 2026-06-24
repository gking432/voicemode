import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const PROMPT_NAMES = [
  "realtime-intake",
  "codex-analysis",
  "claude-review",
  "decision-merge",
  "codex-implementation",
  "diff-review",
  "user-status-summary",
] as const;

export type PromptName = (typeof PROMPT_NAMES)[number];

const here = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(here, "prompts");
const cache = new Map<PromptName, string>();

/** Load a prompt markdown file from packages/agents/src/prompts (spec §18, §31). */
export function loadPrompt(name: PromptName): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const content = readFileSync(path.join(promptsDir, `${name}.md`), "utf8");
  cache.set(name, content);
  return content;
}
