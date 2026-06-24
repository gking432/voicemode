import Anthropic from "@anthropic-ai/sdk";
import {
  type ClaudeAdapter,
  type ClaudeReviewInput,
  type ClaudeReviewOutput,
  ClaudeReviewOutputSchema,
  type ClaudeDiffReviewInput,
  type ClaudeDiffReviewOutput,
} from "@vco/shared";
import { loadPrompt } from "../prompts.js";
import { extractJson } from "../json.js";

export interface AnthropicAdapterConfig {
  apiKey?: string;
  /** Defaults to claude-opus-4-8 (spec §13 CLAUDE_MODEL). */
  model?: string;
}

/**
 * Claude reviewer/architect backed by the Anthropic Messages API (spec §9.3,
 * §16.2). Uses Opus 4.8 with adaptive thinking + high effort — this is the
 * "second-opinion senior engineer" step, which benefits from deep reasoning.
 */
export class AnthropicApiAdapter implements ClaudeAdapter {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(cfg: AnthropicAdapterConfig = {}) {
    this.client = new Anthropic(cfg.apiKey ? { apiKey: cfg.apiKey } : {});
    this.model = cfg.model ?? "claude-opus-4-8";
  }

  async review(input: ClaudeReviewInput): Promise<ClaudeReviewOutput> {
    const system = loadPrompt("claude-review");
    const user = buildReviewPrompt(input);
    const text = await this.complete(system, user);
    return ClaudeReviewOutputSchema.parse(extractJson(text));
  }

  async reviewDiff(input: ClaudeDiffReviewInput): Promise<ClaudeDiffReviewOutput> {
    const system = loadPrompt("diff-review");
    const user = [
      `# Project summary\n${input.projectSummary}`,
      `# Implementation brief\n${JSON.stringify(input.finalBrief, null, 2)}`,
      `# Diff\n${truncate(input.diff, 60_000)}`,
      `Return ONLY the JSON object described in the system prompt.`,
    ].join("\n\n");
    const text = await this.complete(system, user);
    const parsed = extractJson(text) as Record<string, unknown>;
    return {
      approved: Boolean(parsed.approved),
      blockingIssues: asStringArray(parsed.blockingIssues),
      notes: asStringArray(parsed.notes),
    };
  }

  private async complete(system: string, user: string): Promise<string> {
    // `thinking` (adaptive) and `output_config` (effort) are current-SDK fields;
    // pass through `as never` so the call type-checks across SDK minor versions.
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 16_000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system,
      messages: [{ role: "user", content: user }],
    } as never);

    const blocks = (message as Anthropic.Message).content;
    return blocks
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
}

function buildReviewPrompt(input: ClaudeReviewInput): string {
  const files =
    input.relevantFiles && input.relevantFiles.length > 0
      ? input.relevantFiles
          .map((f) => `## ${f.path}\n\`\`\`\n${truncate(f.excerpt, 4_000)}\n\`\`\``)
          .join("\n\n")
      : "(no file excerpts provided)";

  return [
    `# Raw voice transcript\n${input.rawTranscript}`,
    `# Structured notes\n${JSON.stringify(input.structuredNotes, null, 2)}`,
    `# Codex initial analysis\n${JSON.stringify(input.codexAnalysis, null, 2)}`,
    `# Project summary\n${input.projectSummary}`,
    `# Relevant files\n${files}`,
    `Return ONLY the JSON object described in the system prompt.`,
  ].join("\n\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
