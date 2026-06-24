"use client";

/**
 * Simulated pointer overlay (spec §27.2, MVP scope). Real cross-origin browser
 * control is deliberately out of scope for the first slice — the preview is an
 * iframe we don't own. Instead we render an *illustrative* cursor that glides to
 * a labeled region while the teammate narrates, which is enough to make the
 * walkthrough feel guided. The label is honest about what's being pointed at.
 */
export function PreviewPointer({ label, active }: { label: string | null; active: boolean }) {
  if (!active || !label) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl drop-shadow-lg">👆</span>
          <span className="rounded-md bg-cockpit-accent px-2 py-1 text-xs font-medium text-cockpit-bg shadow-lg">
            {label}
          </span>
        </div>
        <span className="absolute -left-2 -top-2 h-10 w-10 animate-ping rounded-full bg-cockpit-accent/30" />
      </div>
    </div>
  );
}
