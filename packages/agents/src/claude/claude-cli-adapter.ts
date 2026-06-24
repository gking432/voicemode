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
import { runCli } from "../cli.js";

export interface ClaudeCliAdapterConfig {
  cliPath?: string;
  model?: string;
}

/**
 * Claude reviewer backed by the Claude Code CLI in headless print mode
 * (`claude -p --output-format json`). The API adapter is the default/preferred
 * path (spec §13); this is the alternative when CLAUDE_CODE_PROVIDER=cli.
 */
export class ClaudeCliAdapter implements ClaudeAdapter {
  private readonly cliPath: string;
  private readonly model: string;

  constructor(cfg: ClaudeCliAdapterConfig = {}) {
    this.cliPath = cfg.cliPath ?? "claude";
    this.model = cfg.model ?? "claude-opus-4-8";
  }

  async review(input: ClaudeReviewInput): Promise<ClaudeReviewOutput> {
    const prompt = [
      loadPrompt("claude-review"),
      "---",
      `Raw transcript:\n${input.rawTranscript}`,
      `Structured notes:\n${JSON.stringify(input.structuredNotes, null, 2)}`,
      `Codex analysis:\n${JSON.stringify(input.codexAnalysis, null, 2)}`,
      `Project summary:\n${input.projectSummary}`,
      "Return ONLY the JSON object described above.",
    ].join("\n\n");
    const text = await this.invoke(prompt);
    return ClaudeReviewOutputSchema.parse(extractJson(text));
  }

  async reviewDiff(input: ClaudeDiffReviewInput): Promise<ClaudeDiffReviewOutput> {
    const prompt = [
      loadPrompt("diff-review"),
      "---",
      `Brief:\n${JSON.stringify(input.finalBrief, null, 2)}`,
      `Diff:\n${input.diff}`,
      "Return ONLY the JSON object described above.",
    ].join("\n\n");
    const text = await this.invoke(prompt);
    const parsed = extractJson(text) as Record<string, unknown>;
    return {
      approved: Boolean(parsed.approved),
      blockingIssues: Array.isArray(parsed.blockingIssues) ? (parsed.blockingIssues as string[]) : [],
      notes: Array.isArray(parsed.notes) ? (parsed.notes as string[]) : [],
    };
  }

  private async invoke(prompt: string): Promise<string> {
    const result = await runCli(
      this.cliPath,
      ["-p", "--output-format", "json", "--model", this.model],
      { input: prompt },
    );
    if (result.code !== 0) {
      throw new Error(`claude CLI exited with code ${result.code}: ${result.stderr.slice(0, 500)}`);
    }
    // `--output-format json` wraps the answer in an envelope with a `result` field.
    try {
      const envelope = JSON.parse(result.stdout) as { result?: string };
      if (typeof envelope.result === "string") return envelope.result;
    } catch {
      /* fall through to raw stdout */
    }
    return result.stdout;
  }
}
