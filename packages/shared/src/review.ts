import { z } from "zod";

/**
 * Review session + walkthrough types (spec §25–§27, Phase 2 "AI teammate").
 * A review session is what the teammate presents when a run is ready: a short
 * spoken summary, the assumptions it made, and a few narrated walkthrough steps
 * (pointing at the preview and/or explaining a code change).
 */

export const REVIEW_SESSION_STATUSES = [
  "pending", // narration not built yet
  "ready", // built and waiting for the user (bubble shows)
  "in_progress", // user opened the review screen
  "completed", // user approved or finished walking through
  "dismissed", // user dismissed without acting
] as const;

export const ReviewSessionStatusSchema = z.enum(REVIEW_SESSION_STATUSES);
export type ReviewSessionStatus = z.infer<typeof ReviewSessionStatusSchema>;

export const WALKTHROUGH_STEP_KINDS = [
  "summary", // "here's the gist of what I did"
  "change", // a specific change, usually tied to a file
  "assumption", // a decision/assumption worth flagging
  "preview_point", // points the simulated cursor at a region of the preview
  "diff", // explains a code diff hunk
] as const;

export const WalkthroughStepKindSchema = z.enum(WALKTHROUGH_STEP_KINDS);
export type WalkthroughStepKind = z.infer<typeof WalkthroughStepKindSchema>;

export const REVIEW_DECISIONS = ["approve", "revise", "dismiss"] as const;
export const ReviewDecisionSchema = z.enum(REVIEW_DECISIONS);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const WalkthroughStepSchema = z.object({
  order: z.number().int().nonnegative(),
  kind: WalkthroughStepKindSchema,
  title: z.string(),
  narration: z.string(),
  filePath: z.string().optional(),
  diffHunk: z.string().optional(),
  pointerSelector: z.string().optional(),
  pointerLabel: z.string().optional(),
});
export type WalkthroughStep = z.infer<typeof WalkthroughStepSchema>;

/** The full narration plan produced for a run, before persistence. */
export const ReviewNarrationPlanSchema = z.object({
  headline: z.string(), // the bubble line
  openingLine: z.string(), // first spoken line in the walkthrough
  summary: z.string(),
  assumptions: z.array(z.string()),
  previewUrl: z.string().optional(),
  diffStat: z.string().optional(),
  steps: z.array(WalkthroughStepSchema),
});
export type ReviewNarrationPlan = z.infer<typeof ReviewNarrationPlanSchema>;

/** Stable ordering helper so steps always render in the intended sequence. */
export function orderWalkthroughSteps<T extends { order: number }>(steps: T[]): T[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

export const ReviewFeedbackInputSchema = z.object({
  decision: ReviewDecisionSchema,
  transcript: z.string().trim().optional(),
});
export type ReviewFeedbackInput = z.infer<typeof ReviewFeedbackInputSchema>;
