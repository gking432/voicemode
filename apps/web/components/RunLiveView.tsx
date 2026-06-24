"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StructuredNotes, FinalImplementationBrief, CheckStatus } from "@vco/shared";
import { subscribeRunEvents } from "@/lib/run-events";
import { postJson } from "@/lib/api-client";
import { statusClasses, statusLabel, isActive } from "@/lib/format";
import { AgentTimeline } from "./AgentTimeline";
import { StructuredNotesPanel } from "./StructuredNotesPanel";
import { RunResultCard } from "./RunResultCard";

interface LogLine {
  level: string;
  source: string;
  message: string;
}

export interface RunView {
  id: string;
  status: string;
  workflowMode: string;
  userTranscript: string;
  structuredNotes: StructuredNotes | null;
  codexAnalysis: Record<string, unknown> | null;
  claudeReview: Record<string, unknown> | null;
  finalBrief: FinalImplementationBrief | null;
  branchName: string | null;
  commitSha: string | null;
  previewUrl: string | null;
  productionUrl: string | null;
  diffSummary: string | null;
  errorMessage: string | null;
  logs: LogLine[];
  checks: Array<{ name: string; status: string }>;
}

const PROD_PHRASE = "Confirm production deploy";

export function RunLiveView({ run }: { run: RunView }) {
  const router = useRouter();
  const [status, setStatus] = useState(run.status);
  const [logs, setLogs] = useState<LogLine[]>(run.logs);
  const [agents, setAgents] = useState<{ realtime?: string; codex?: string; claude?: string }>({});
  const [checks, setChecks] = useState(run.checks);
  const [feedback, setFeedback] = useState("");
  const [prodConfirm, setProdConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeRunEvents(run.id, (event) => {
      switch (event.type) {
        case "status":
          setStatus(event.status);
          router.refresh();
          break;
        case "log":
          setLogs((prev) => [...prev, { level: event.level, source: event.source, message: event.message }]);
          break;
        case "agent_output":
          setAgents((prev) => ({ ...prev, [event.agent]: event.summary }));
          break;
        case "check_result":
          setChecks((prev) => {
            const next = prev.filter((c) => c.name !== event.name);
            return [...next, { name: event.name, status: String(event.status) }];
          });
          break;
        case "deployment":
          router.refresh();
          break;
        case "error":
          setLogs((prev) => [...prev, { level: "error", source: "system", message: event.message }]);
          break;
      }
    });
    return unsub;
  }, [run.id, router]);

  async function action(path: string, body?: unknown): Promise<{ id?: string } | undefined> {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ id?: string }>(`/api/runs/${run.id}/${path}`, body);
      router.refresh();
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const codex = run.codexAnalysis;
  const claude = run.claudeReview;
  const reviewable = status === "awaiting_user_review";
  const finished = status === "completed";
  const canPromote = Boolean(run.previewUrl) && (reviewable || finished);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-100">Run {run.id.slice(-6)}</h1>
          <p className="text-sm text-cockpit-muted">{run.workflowMode.replace(/_/g, " ")}</p>
        </div>
        <span className={`badge ${statusClasses(status)}`}>
          {isActive(status) ? "▶ " : ""}
          {statusLabel(status)}
        </span>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {run.errorMessage ? <p className="panel text-sm text-red-300">{run.errorMessage}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <div className="panel-title">Agent timeline</div>
          <AgentTimeline status={status} />
        </section>

        <section className="panel">
          <div className="panel-title">Transcript</div>
          <p className="text-sm text-slate-300">{run.userTranscript}</p>
        </section>

        <section className="panel">
          <div className="panel-title">Structured notes</div>
          <StructuredNotesPanel notes={run.structuredNotes} />
        </section>

        <section className="panel">
          <div className="panel-title">Results</div>
          <RunResultCard run={run} />
          {checks.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {checks.map((c) => (
                <span key={c.name} className={`badge ${checkTone(c.status)}`}>
                  {c.name}: {c.status}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-title">Codex analysis</div>
          <AgentSummary summary={(codex?.summary as string) ?? agents.codex} extra={codex} keys={["risks", "implementationPlan"]} />
        </section>

        <section className="panel">
          <div className="panel-title">Claude review</div>
          <AgentSummary
            summary={(claude?.executiveSummary as string) ?? agents.claude}
            extra={claude}
            keys={["productRecommendations", "technicalRecommendations", "uxRecommendations", "risks"]}
          />
        </section>
      </div>

      {run.finalBrief ? (
        <section className="panel">
          <div className="panel-title">Final implementation brief</div>
          <p className="mb-2 text-sm font-medium text-slate-200">{run.finalBrief.title}</p>
          <BriefList title="Final plan" items={run.finalBrief.finalImplementationPlan} />
          <BriefList title="Acceptance criteria" items={run.finalBrief.acceptanceCriteria} />
          <BriefList title="Test plan" items={run.finalBrief.testPlan} />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-title">Live log</div>
        <div className="max-h-60 space-y-1 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? <p className="text-cockpit-muted">No log lines yet.</p> : null}
          {logs.map((l, i) => (
            <div key={i} className={l.level === "error" ? "text-red-300" : "text-slate-400"}>
              <span className="text-cockpit-muted">[{l.source}]</span> {l.message}
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-4">
        <div className="panel-title">Controls</div>
        <div className="flex flex-wrap gap-2">
          {reviewable ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => action("approve")}>
              Approve & complete
            </button>
          ) : null}
          {isActive(status) ? (
            <button className="btn" disabled={busy} onClick={() => action("cancel")}>
              Cancel run
            </button>
          ) : null}
          {run.previewUrl ? (
            <a className="btn" href={run.previewUrl} target="_blank" rel="noreferrer">
              Open preview
            </a>
          ) : null}
        </div>

        {reviewable || finished ? (
          <div>
            <span className="label">Continue with voice/text feedback (creates a follow-up run)</span>
            <textarea
              className="input min-h-[80px]"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="That's better, but make the urgency score smaller and move the follow-up draft under the timeline."
            />
            <button
              className="btn mt-2"
              disabled={busy || !feedback.trim()}
              onClick={async () => {
                const res = await action("feedback", { transcript: feedback.trim() });
                if (res?.id) router.push(`/runs/${res.id}`);
              }}
            >
              Send feedback →
            </button>
          </div>
        ) : null}

        {canPromote ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-sm text-amber-200">
              Promote this preview to production. Type <code>{PROD_PHRASE}</code> to confirm (spec §21.2).
            </p>
            <input
              className="input mt-2"
              value={prodConfirm}
              onChange={(e) => setProdConfirm(e.target.value)}
              placeholder={PROD_PHRASE}
            />
            <button
              className="btn mt-2"
              disabled={busy || prodConfirm.trim() !== PROD_PHRASE}
              onClick={() => action("promote-production", { confirm: prodConfirm.trim() })}
            >
              Deploy to production
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function checkTone(status: string): string {
  if (status === "passed") return "border-emerald-500/40 text-emerald-300";
  if (status === "failed") return "border-red-500/40 text-red-300";
  return "border-slate-500/40 text-slate-400";
}

function AgentSummary({
  summary,
  extra,
  keys,
}: {
  summary?: string;
  extra: Record<string, unknown> | null;
  keys: string[];
}) {
  if (!summary && !extra) return <p className="text-sm text-cockpit-muted">Pending…</p>;
  return (
    <div className="space-y-2">
      {summary ? <p className="text-sm text-slate-300">{summary}</p> : null}
      {extra
        ? keys.map((k) => {
            const v = extra[k];
            if (!Array.isArray(v) || v.length === 0) return null;
            return <BriefList key={k} title={k.replace(/([A-Z])/g, " $1")} items={v as string[]} />;
          })
        : null}
    </div>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="text-xs font-semibold capitalize text-slate-300">{title}</div>
      <ul className="ml-4 list-disc text-sm text-slate-400">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export type { CheckStatus };
