"use client";

import type { WalkthroughStepDTO } from "@/lib/teammate";

/**
 * Optional code-diff panel (spec §27.4). Shows the plain-English, per-file
 * explanations the teammate generated, plus any raw diff hunk and the overall
 * diff stat. Collapsed by default on the review screen — the preview is the
 * star; the code is there for when you want it.
 */
export function CodeDiffPanel({
  steps,
  diffStat,
}: {
  steps: WalkthroughStepDTO[];
  diffStat: string | null;
}) {
  const changes = steps.filter((s) => s.kind === "change" || s.kind === "diff");

  return (
    <div className="space-y-4">
      {changes.length === 0 ? (
        <p className="text-sm text-cockpit-muted">No file-level changes to walk through.</p>
      ) : (
        <ul className="space-y-3">
          {changes.map((s) => (
            <li key={s.id} className="rounded-lg border border-cockpit-border bg-cockpit-bg p-3">
              {s.filePath ? (
                <code className="text-xs text-cockpit-accent">{s.filePath}</code>
              ) : (
                <span className="text-xs text-cockpit-muted">{s.title}</span>
              )}
              <p className="mt-1 text-sm text-slate-300">{s.narration}</p>
              {s.diffHunk ? (
                <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-xs text-slate-400">
                  {s.diffHunk}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {diffStat ? (
        <div>
          <div className="label">Diff stat</div>
          <pre className="overflow-x-auto rounded bg-cockpit-bg p-3 text-xs text-slate-400">{diffStat}</pre>
        </div>
      ) : null}
    </div>
  );
}
