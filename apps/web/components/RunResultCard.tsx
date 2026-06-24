export interface RunResult {
  branchName?: string | null;
  commitSha?: string | null;
  previewUrl?: string | null;
  productionUrl?: string | null;
  diffSummary?: string | null;
}

export function RunResultCard({ run }: { run: RunResult }) {
  const hasAnything = run.branchName || run.previewUrl || run.commitSha || run.diffSummary;
  if (!hasAnything) {
    return <p className="text-sm text-cockpit-muted">No results yet.</p>;
  }
  return (
    <div className="space-y-2 text-sm">
      {run.branchName ? (
        <Row label="Branch" value={<code className="text-cockpit-accent">{run.branchName}</code>} />
      ) : null}
      {run.commitSha ? (
        <Row label="Commit" value={<code>{run.commitSha.slice(0, 10)}</code>} />
      ) : null}
      {run.previewUrl ? (
        <Row
          label="Preview"
          value={
            <a className="text-cockpit-accent underline" href={run.previewUrl} target="_blank" rel="noreferrer">
              {run.previewUrl}
            </a>
          }
        />
      ) : null}
      {run.productionUrl ? (
        <Row
          label="Production"
          value={
            <a className="text-emerald-300 underline" href={run.productionUrl} target="_blank" rel="noreferrer">
              {run.productionUrl}
            </a>
          }
        />
      ) : null}
      {run.diffSummary ? (
        <div>
          <div className="label">Diff</div>
          <pre className="overflow-x-auto rounded bg-cockpit-bg p-3 text-xs text-slate-400">{run.diffSummary}</pre>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-cockpit-muted">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  );
}
