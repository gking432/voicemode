"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, patchJson } from "@/lib/api-client";
import { speak, stopSpeaking, type ReviewSessionDTO, type FeedbackResponse } from "@/lib/teammate";
import { PreviewPointer } from "./PreviewPointer";
import { CodeDiffPanel } from "./CodeDiffPanel";

type Decision = "approve" | "revise" | "dismiss";

/**
 * The review screen (spec §26–§27). The teammate walks you through what it
 * built: it talks (browser TTS), steps through 2–4 points, points the simulated
 * cursor at the preview, and optionally opens the code diff. You respond by
 * approving, asking for a revision (which spawns a linked follow-up run), or
 * dismissing.
 */
export function ReviewWalkthrough({ session }: { session: ReviewSessionDTO }) {
  const router = useRouter();
  const steps = session.steps;
  const [index, setIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [showDiff, setShowDiff] = useState(false);
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = steps[index];
  const onPreviewStep = current?.kind === "preview_point";

  // Mark the session in progress when the user arrives.
  useEffect(() => {
    void patchJson(`/api/review-sessions/${session.id}`, { status: "in_progress" }).catch(() => {});
  }, [session.id]);

  // Speak the active step's narration whenever it changes (and voice is on).
  useEffect(() => {
    if (!current) return;
    if (voiceOn) speak(current.narration);
    return () => stopSpeaking();
  }, [current, voiceOn]);

  const go = useCallback(
    (next: number) => {
      stopSpeaking();
      setIndex((prev) => Math.min(Math.max(next, 0), steps.length - 1));
    },
    [steps.length],
  );

  const submit = useCallback(
    async (decision: Decision) => {
      setError(null);
      setBusy(decision);
      stopSpeaking();
      try {
        const res = await postJson<FeedbackResponse>(
          `/api/review-sessions/${session.id}/feedback`,
          { decision, transcript: decision === "revise" ? revision : undefined },
        );
        if (res.followUpRunId) {
          router.push(`/runs/${res.followUpRunId}`);
        } else if (decision === "approve") {
          router.push(`/runs/${session.runId}`);
        } else {
          router.push("/");
        }
      } catch (err) {
        setError((err as Error).message);
        setBusy(null);
      }
    },
    [revision, router, session.id, session.runId],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Preview pane ------------------------------------------------------ */}
      <section className="space-y-3">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-cockpit-border bg-black">
          {session.previewUrl ? (
            <>
              <iframe
                title="Preview"
                src={session.previewUrl}
                className="h-full w-full"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
              <PreviewPointer label={current?.pointerLabel ?? null} active={onPreviewStep} />
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-cockpit-muted">
              No preview was deployed for this run. I'll walk you through the changes instead.
            </div>
          )}
        </div>
        {session.previewUrl ? (
          <a
            href={session.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-cockpit-accent underline"
          >
            Open preview in a new tab ↗
          </a>
        ) : null}
      </section>

      {/* Teammate pane ---------------------------------------------------- */}
      <section className="space-y-4">
        <div className="rounded-xl border border-cockpit-border bg-cockpit-panel p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="text-sm font-medium text-slate-100">Your AI teammate</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (voiceOn) stopSpeaking();
                else if (current) speak(current.narration);
                setVoiceOn((v) => !v);
              }}
              className="text-xs text-cockpit-muted hover:text-slate-200"
            >
              {voiceOn ? "🔊 Voice on" : "🔇 Voice off"}
            </button>
          </div>
          <p className="mt-3 text-sm italic text-cockpit-muted">“{session.openingLine}”</p>
        </div>

        {/* Step list */}
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(i)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  i === index
                    ? "border-cockpit-accent/50 bg-cockpit-accent/10"
                    : "border-cockpit-border bg-cockpit-panel hover:border-cockpit-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-cockpit-muted">{s.kind.replace("_", " ")}</span>
                  <span className="truncate text-sm text-slate-200">{s.title}</span>
                </div>
                {i === index ? <p className="mt-1 text-sm text-slate-300">{s.narration}</p> : null}
              </button>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="rounded-md border border-cockpit-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index >= steps.length - 1}
              className="rounded-md border border-cockpit-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next →
            </button>
            {current ? (
              <button
                type="button"
                onClick={() => speak(current.narration)}
                className="rounded-md border border-cockpit-border px-3 py-1.5 text-sm"
              >
                ↻ Replay
              </button>
            ) : null}
          </div>
          <span className="text-xs text-cockpit-muted">
            {index + 1} / {steps.length}
          </span>
        </div>

        {/* Assumptions */}
        {session.assumptions.length > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="label text-amber-300/80">Decisions I made</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {session.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Code diff (optional) */}
        <div className="rounded-lg border border-cockpit-border bg-cockpit-panel p-3">
          <button
            type="button"
            onClick={() => setShowDiff((v) => !v)}
            className="text-sm text-cockpit-accent"
          >
            {showDiff ? "Hide code diff" : "Show me the code diff"}
          </button>
          {showDiff ? (
            <div className="mt-3">
              <CodeDiffPanel steps={steps} diffStat={session.diffStat} />
            </div>
          ) : null}
        </div>

        {/* Feedback */}
        <div className="rounded-xl border border-cockpit-border bg-cockpit-panel p-4">
          <label className="label" htmlFor="revision">
            Want a change? Tell me what to adjust
          </label>
          <textarea
            id="revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            rows={3}
            placeholder="e.g. make the button green and move it above the form"
            className="mt-1 w-full rounded-md border border-cockpit-border bg-cockpit-bg p-2 text-sm text-slate-200 outline-none focus:border-cockpit-accent"
          />
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={busy !== null}
              className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-sm font-medium text-cockpit-bg hover:brightness-110 disabled:opacity-50"
            >
              {busy === "approve" ? "Saving…" : "Looks good ✓"}
            </button>
            <button
              type="button"
              onClick={() => submit("revise")}
              disabled={busy !== null || revision.trim().length === 0}
              className="rounded-md bg-cockpit-accent px-3 py-1.5 text-sm font-medium text-cockpit-bg hover:brightness-110 disabled:opacity-50"
            >
              {busy === "revise" ? "Starting…" : "Make this change →"}
            </button>
            <button
              type="button"
              onClick={() => submit("dismiss")}
              disabled={busy !== null}
              className="rounded-md border border-cockpit-border px-3 py-1.5 text-sm text-cockpit-muted hover:text-slate-200 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
