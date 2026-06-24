import type { RunStatus } from "@vco/shared";

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

const TONE: Record<string, string> = {
  completed: "border-emerald-500/40 text-emerald-300",
  awaiting_user_review: "border-cockpit-accent/40 text-cockpit-accent",
  failed: "border-red-500/40 text-red-300",
  cancelled: "border-slate-500/40 text-slate-400",
  needs_user_input: "border-amber-500/40 text-amber-300",
};

export function statusClasses(status: string): string {
  return TONE[status] ?? "border-sky-500/40 text-sky-300";
}

const ACTIVE: RunStatus[] = [
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
];

export function isActive(status: string): boolean {
  return ACTIVE.includes(status as RunStatus);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString();
}
