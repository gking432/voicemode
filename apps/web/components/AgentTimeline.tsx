const STEPS: Array<{ status: string; label: string }> = [
  { status: "building_notes", label: "Voice notes built" },
  { status: "codex_analyzing", label: "Codex analyzed codebase" },
  { status: "claude_reviewing", label: "Claude reviewed plan" },
  { status: "merging_decision", label: "Final brief merged" },
  { status: "codex_implementing", label: "Codex implementing" },
  { status: "running_checks", label: "Running checks" },
  { status: "creating_commit", label: "Commit created" },
  { status: "deploying_preview", label: "Preview deployed" },
  { status: "awaiting_user_review", label: "Awaiting your review" },
];

const ORDER = STEPS.map((s) => s.status);

function rank(status: string): number {
  if (status === "completed" || status === "cancelled") return ORDER.length;
  if (status === "fixing_errors") return ORDER.indexOf("running_checks");
  const idx = ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

export function AgentTimeline({ status }: { status: string }) {
  const current = rank(status);
  const failed = status === "failed";
  const needsInput = status === "needs_user_input";

  return (
    <ul className="space-y-2 text-sm">
      {STEPS.map((step, i) => {
        const done = i < current || status === "completed";
        const active = i === current && !failed && status !== "completed";
        let marker = "○";
        let cls = "text-cockpit-muted";
        if (done) {
          marker = "✓";
          cls = "text-emerald-400";
        } else if (active) {
          marker = needsInput ? "!" : "→";
          cls = needsInput ? "text-amber-300" : failed ? "text-red-300" : "text-cockpit-accent";
        }
        return (
          <li key={step.status} className={`flex items-center gap-3 ${cls}`}>
            <span className="w-4 text-center font-mono">{marker}</span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
