import type {
  FinalImplementationBrief,
  ClaudeReviewOutput,
  ReviewNarrationPlan,
  WalkthroughStep,
} from "@vco/shared";
import { explainFiles } from "./code-diff-explanation-service.js";

/**
 * Review narration service (spec §26). Builds the script the teammate walks the
 * user through when a run is ready: a bubble headline, an opening line, a short
 * summary, the assumptions/decisions it made, and 2–4 narrated walkthrough
 * steps (preview points + the most important code changes).
 *
 * Deterministic, mirroring the status-summary service — predictable, testable,
 * and free. An LLM-written variant can be layered on later behind the same shape.
 */

export interface ReviewNarrationInput {
  title: string;
  userIntent: string;
  brief: FinalImplementationBrief;
  claudeReview?: ClaudeReviewOutput | null;
  changedFiles: string[];
  previewUrl?: string;
  diffStat?: string;
}

const MAX_STEPS = 4;

export function buildReviewNarration(input: ReviewNarrationInput): ReviewNarrationPlan {
  const { title, userIntent, brief, claudeReview, changedFiles, previewUrl, diffStat } = input;

  const fileCount = changedFiles.length;
  const filesPhrase =
    fileCount === 0
      ? "without touching any files"
      : `across ${fileCount} file${fileCount === 1 ? "" : "s"}`;

  const headline = `Finished "${title}" — got a minute to review?`;
  const openingLine = `I wrapped up ${lowerFirst(title)}. ${capitalize(userIntent.replace(/\.$/, ""))}.`;
  const summary = `I made the changes ${filesPhrase} and the checks passed. Here's what I'd point out.`;

  const assumptions = buildAssumptions(brief, claudeReview);

  const steps: WalkthroughStep[] = [];
  let order = 0;

  // 1. Opening summary step.
  steps.push({
    order: order++,
    kind: "summary",
    title: "What I did",
    narration: `${openingLine} ${summary}`,
  });

  // 2. Preview point (if we deployed one) — the simulated cursor lands on the app.
  if (previewUrl) {
    steps.push({
      order: order++,
      kind: "preview_point",
      title: "See it live",
      narration: `Let me show you in the preview. This is the running app with the change applied.`,
      pointerSelector: "body",
      pointerLabel: "the updated screen",
    });
  }

  // 3..N. The most important code changes, explained plainly.
  const remaining = MAX_STEPS - steps.length;
  if (remaining > 0 && fileCount > 0) {
    for (const exp of explainFiles(changedFiles, brief, remaining)) {
      steps.push({
        order: order++,
        kind: "change",
        title: exp.filePath,
        narration: exp.sentence,
        filePath: exp.filePath,
      });
    }
  }

  // If we still have room and there's a noteworthy assumption, surface it as its
  // own step so the user explicitly hears the decision the teammate made.
  if (steps.length < MAX_STEPS && assumptions.length > 0) {
    steps.push({
      order: order++,
      kind: "assumption",
      title: "One call I made",
      narration: `Heads up on a decision: ${assumptions[0]}`,
    });
  }

  return {
    headline,
    openingLine,
    summary,
    assumptions,
    previewUrl,
    diffStat,
    steps,
  };
}

function buildAssumptions(
  brief: FinalImplementationBrief,
  claudeReview?: ClaudeReviewOutput | null,
): string[] {
  const out: string[] = [];

  for (const rejected of brief.rejectedRecommendations.slice(0, 2)) {
    out.push(`I chose not to ${lowerFirst(rejected.replace(/\.$/, ""))}.`);
  }
  for (const rec of brief.acceptedClaudeRecommendations.slice(0, 2)) {
    out.push(`I followed the suggestion to ${lowerFirst(rec.replace(/\.$/, ""))}.`);
  }
  if (out.length === 0 && claudeReview?.risks?.length) {
    out.push(`Worth watching: ${lowerFirst(claudeReview.risks[0]!.replace(/\.$/, ""))}.`);
  }
  if (out.length === 0) {
    out.push("I stuck closely to what you asked for and didn't expand the scope.");
  }
  return out.slice(0, 3);
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
function lowerFirst(s: string): string {
  return s.length ? s[0]!.toLowerCase() + s.slice(1) : s;
}
