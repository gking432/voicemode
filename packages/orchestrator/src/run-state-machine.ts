import { type RunStatus, isTerminalRunStatus } from "@vco/shared";

/**
 * Allowed forward transitions for a run (spec §11). Transitions to `failed`
 * and `cancelled` are permitted from any non-terminal state and are therefore
 * not listed explicitly. Terminal states (`completed`, `failed`, `cancelled`)
 * have no outgoing transitions.
 */
export const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  created: ["listening", "building_notes", "needs_user_input"],
  listening: ["transcribing", "needs_user_input"],
  transcribing: ["building_notes", "needs_user_input"],
  building_notes: ["codex_analyzing", "awaiting_user_review", "completed", "needs_user_input"],
  codex_analyzing: ["claude_reviewing", "needs_user_input"],
  claude_reviewing: ["merging_decision", "needs_user_input"],
  merging_decision: [
    "codex_implementing",
    "awaiting_user_review",
    "completed",
    "needs_user_input",
  ],
  codex_implementing: ["running_checks", "needs_user_input"],
  running_checks: [
    "fixing_errors",
    "creating_commit",
    "deploying_preview",
    "awaiting_user_review",
    "needs_user_input",
  ],
  fixing_errors: ["running_checks", "needs_user_input"],
  creating_commit: ["deploying_preview", "awaiting_user_review", "completed", "needs_user_input"],
  deploying_preview: ["awaiting_user_review", "completed", "needs_user_input"],
  awaiting_user_review: ["completed", "needs_user_input"],
  needs_user_input: [
    "listening",
    "building_notes",
    "codex_analyzing",
    "claude_reviewing",
    "merging_decision",
    "codex_implementing",
    "running_checks",
    "deploying_preview",
    "awaiting_user_review",
    "completed",
  ],
  completed: [],
  failed: [],
  cancelled: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: RunStatus, to: RunStatus) {
    super(`Invalid run transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Can a run move from `from` to `to`? */
export function canTransition(from: RunStatus, to: RunStatus): boolean {
  if (from === to) return false;
  if (isTerminalRunStatus(from)) return false;
  // Failure/cancellation can happen from any active state.
  if (to === "failed" || to === "cancelled") return true;
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
