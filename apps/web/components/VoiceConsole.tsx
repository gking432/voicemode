"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKFLOW_MODES } from "@vco/shared";
import { postJson } from "@/lib/api-client";
import { startRealtimeSession, type RealtimeSessionHandle } from "@/lib/realtime-client";
import { VoiceOrb, type OrbState } from "./VoiceOrb";

export function VoiceConsole({
  project,
}: {
  project: { id: string; name: string; workflowMode: string };
}) {
  const router = useRouter();
  const [mode, setMode] = useState(project.workflowMode);
  const [transcript, setTranscript] = useState("");
  const [orb, setOrb] = useState<OrbState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sessionRef = useRef<RealtimeSessionHandle | null>(null);

  async function startTalking() {
    setError(null);
    try {
      const { clientSecret, model } = await postJson<{ clientSecret: string; model: string }>(
        "/api/realtime/session",
        { projectId: project.id, mode },
      );
      sessionRef.current = await startRealtimeSession({
        clientSecret,
        model,
        onTranscript: (text, isFinal) =>
          setTranscript((prev) => (isFinal ? `${prev} ${text}`.trim() : prev + text)),
        onError: (e) => setError(e.message),
      });
      setOrb("listening");
    } catch (err) {
      setError(
        `Voice capture unavailable (${err instanceof Error ? err.message : "unknown"}). You can type the instruction instead.`,
      );
      setOrb("idle");
    }
  }

  function stopTalking() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setOrb("idle");
  }

  async function submit() {
    if (!transcript.trim()) {
      setError("Say or type what you want changed first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    stopTalking();
    try {
      const run = await postJson<{ id: string }>("/api/runs", {
        projectId: project.id,
        transcript: transcript.trim(),
        workflowMode: mode,
      });
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
      setSubmitting(false);
    }
  }

  return (
    <div className="panel space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-cockpit-muted">Active project</div>
          <div className="font-medium text-slate-100">{project.name}</div>
        </div>
        <label className="text-right">
          <span className="label">Mode</span>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {WORKFLOW_MODES.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between rounded-md border border-cockpit-border bg-cockpit-bg px-4 py-3">
        <VoiceOrb state={orb} />
        <div className="flex gap-2">
          {orb === "idle" ? (
            <button className="btn" onClick={startTalking} type="button">
              🎤 Start talking
            </button>
          ) : (
            <button className="btn" onClick={stopTalking} type="button">
              ⏹ Stop
            </button>
          )}
        </div>
      </div>

      <div>
        <span className="label">Instruction (spoken transcript or typed)</span>
        <textarea
          className="input min-h-[120px]"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Open my CRM demo. Move the AI summary above the timeline, make the follow-up draft collapsible, and deploy a preview."
        />
      </div>

      {error ? <p className="text-sm text-amber-300">{error}</p> : null}

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={submit} type="button" disabled={submitting}>
          {submitting ? "Starting…" : "Submit instruction →"}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setTranscript("");
            setError(null);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
