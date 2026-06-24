import {
  type CodexAdapter,
  type CodexAnalyzeInput,
  type CodexAnalyzeOutput,
  CodexAnalyzeOutputSchema,
  type CodexImplementInput,
  type CodexImplementOutput,
} from "@vco/shared";
import { loadPrompt } from "../prompts.js";
import { extractJson } from "../json.js";
import { runCli } from "../cli.js";

export interface CodexCliAdapterConfig {
  cliPath?: string;
  model?: string;
  /** read-only | workspace-write | danger-full-access (spec §13 CODEX_SANDBOX_MODE). */
  sandboxMode?: string;
}

/**
 * Codex backed by the Codex CLI in non-interactive mode (`codex exec`).
 * Analysis runs read-only; implementation runs with workspace-write so Codex
 * can edit files (spec §9.2, §9.4, §16.1). Git/checks/commit are handled
 * deterministically by the orchestrator, not by Codex.
 */
export class CodexCliAdapter implements CodexAdapter {
  private readonly cliPath: string;
  private readonly model?: string;
  private readonly sandboxMode: string;

  constructor(cfg: CodexCliAdapterConfig = {}) {
    this.cliPath = cfg.cliPath ?? "codex";
    this.model = cfg.model;
    this.sandboxMode = cfg.sandboxMode ?? "workspace-write";
  }

  private baseArgs(projectPath: string, sandbox: string): string[] {
    const args = ["exec", "--cd", projectPath, "--sandbox", sandbox];
    if (this.model) args.push("--model", this.model);
    return args;
  }

  async analyze(input: CodexAnalyzeInput): Promise<CodexAnalyzeOutput> {
    const prompt = [
      loadPrompt("codex-analysis"),
      "---",
      `Project path: ${input.projectPath}`,
      `Project summary:\n${input.projectSummary}`,
      `Structured voice notes:\n${JSON.stringify(input.structuredNotes, null, 2)}`,
      input.previousRunSummaries?.length
        ? `Previous run summaries:\n${input.previousRunSummaries.join("\n")}`
        : "",
      input.relevantFiles?.length ? `Relevant files:\n${input.relevantFiles.join("\n")}` : "",
      "Output ONLY the JSON object, wrapped in a ```json fenced block, as your final message.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await runCli(this.cliPath, [...this.baseArgs(input.projectPath, "read-only"), prompt], {
      cwd: input.projectPath,
    });
    if (result.code !== 0) {
      throw new Error(`codex analyze exited ${result.code}: ${result.stderr.slice(0, 500)}`);
    }
    return CodexAnalyzeOutputSchema.parse(extractJson(result.stdout));
  }

  async implement(input: CodexImplementInput): Promise<CodexImplementOutput> {
    const prompt = [
      loadPrompt("codex-implementation"),
      "---",
      `You are on branch: ${input.branchName}`,
      `Final implementation brief:\n${JSON.stringify(input.finalBrief, null, 2)}`,
      `Allowed commands: ${input.allowedCommands.join(", ") || "(none)"}`,
      `Denied commands: ${input.deniedCommands.join(", ") || "(none)"}`,
      `Make the code changes only. Do NOT commit, push, or deploy — the system handles that.`,
      "When done, output a short JSON summary in a ```json block: { status, summary, filesChanged }.",
    ].join("\n\n");

    const result = await runCli(
      this.cliPath,
      [...this.baseArgs(input.projectPath, this.sandboxMode), prompt],
      { cwd: input.projectPath },
    );

    let summary = result.stdout.slice(-2_000).trim();
    let filesChanged: string[] = [];
    try {
      const parsed = extractJson(result.stdout) as Record<string, unknown>;
      if (typeof parsed.summary === "string") summary = parsed.summary;
      if (Array.isArray(parsed.filesChanged)) {
        filesChanged = parsed.filesChanged.filter((f): f is string => typeof f === "string");
      }
    } catch {
      /* best-effort: git is the source of truth for the diff */
    }

    return {
      status: result.code === 0 ? "completed" : "failed",
      summary: summary || "Codex completed implementation.",
      filesChanged,
      diff: "", // authoritatively computed from git by the implementation service
      errors: result.code === 0 ? undefined : [result.stderr.slice(0, 1_000)],
    };
  }
}
