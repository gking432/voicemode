import type { CheckOutcome } from "./verification-service.js";

export interface StatusSummaryInput {
  title: string;
  filesChanged: string[];
  checks: CheckOutcome[];
  previewUrl?: string;
  blockingQuestions?: string[];
  failed?: boolean;
}

/**
 * User Status Summary Service (spec §8 step 11, §18.6). Produces a short,
 * plain-English status line. Deterministic for reliability — the
 * `user-status-summary.md` prompt is available if an LLM-written variant is
 * preferred later.
 */
export function buildStatusSummary(input: StatusSummaryInput): string {
  if (input.blockingQuestions && input.blockingQuestions.length > 0) {
    return `I need a quick answer before continuing: ${input.blockingQuestions.join(" ")}`;
  }

  const checksLine = summarizeChecks(input.checks);
  const filesLine =
    input.filesChanged.length > 0
      ? `${input.filesChanged.length} file${input.filesChanged.length === 1 ? "" : "s"} changed`
      : "no files changed";

  if (input.failed) {
    return `I hit a problem on "${input.title}". ${checksLine} Nothing was deployed — review the logs below.`;
  }

  const parts = [`Done: ${input.title}.`, `${filesLine}.`, checksLine];
  if (input.previewUrl) {
    parts.push(`Preview is ready: ${input.previewUrl}.`);
    parts.push("Take a look and tell me what feels off.");
  } else {
    parts.push("Review the changes and let me know the next step.");
  }
  return parts.join(" ");
}

function summarizeChecks(checks: CheckOutcome[]): string {
  if (checks.length === 0) return "No checks were configured.";
  const passed = checks.filter((c) => c.status === "passed").map((c) => c.name);
  const failed = checks.filter((c) => c.status === "failed").map((c) => c.name);
  const skipped = checks.filter((c) => c.status === "skipped").map((c) => c.name);
  const bits: string[] = [];
  if (passed.length) bits.push(`${passed.join(", ")} passed`);
  if (failed.length) bits.push(`${failed.join(", ")} failed`);
  if (skipped.length) bits.push(`${skipped.join(", ")} skipped`);
  return `Checks: ${bits.join("; ")}.`;
}
