"use client";

import { useState } from "react";
import { postJson } from "@/lib/api-client";

interface ValidationCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export function ValidateButton({ projectId }: { projectId: string }) {
  const [result, setResult] = useState<{ ok: boolean; checks: ValidationCheck[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await postJson<{ ok: boolean; checks: ValidationCheck[] }>(
        `/api/projects/${projectId}/validate`,
      );
      setResult(r);
    } catch (e) {
      setResult({ ok: false, checks: [{ name: "error", ok: false, detail: (e as Error).message }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button className="btn" onClick={run} disabled={busy} type="button">
        {busy ? "Validating…" : "Run health check"}
      </button>
      {result ? (
        <ul className="space-y-1 text-sm">
          {result.checks.map((c) => (
            <li key={c.name} className={c.ok ? "text-emerald-300" : "text-red-300"}>
              {c.ok ? "✓" : "✗"} <span className="text-slate-300">{c.name}</span>{" "}
              <span className="text-cockpit-muted">— {c.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
