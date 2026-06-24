import { z } from "zod";

/** Run lifecycle states (spec §11). */
export const RUN_STATUSES = [
  "created",
  "listening",
  "transcribing",
  "building_notes",
  "codex_analyzing",
  "claude_reviewing",
  "merging_decision",
  "codex_implementing",
  "running_checks",
  "fixing_errors",
  "creating_commit",
  "deploying_preview",
  "awaiting_user_review",
  "completed",
  "failed",
  "cancelled",
  "needs_user_input",
] as const;

export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

/** Terminal states a run cannot leave. */
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}
