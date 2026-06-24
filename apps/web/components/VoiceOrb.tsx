"use client";

export type OrbState = "idle" | "listening" | "thinking";

export function VoiceOrb({ state }: { state: OrbState }) {
  const color =
    state === "listening" ? "bg-cockpit-accent" : state === "thinking" ? "bg-sky-400" : "bg-slate-600";
  const pulse = state === "idle" ? "" : "animate-pulse";
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-block h-4 w-4 rounded-full ${color} ${pulse}`} />
      <span className="text-sm capitalize text-cockpit-muted">{state}</span>
    </div>
  );
}
