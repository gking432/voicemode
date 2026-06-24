"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchOpenReviewSessions, type OpenReviewSession } from "@/lib/teammate";

const POLL_MS = 8000;

/**
 * The teammate bubble (spec §25). A small, persistent bottom-right presence
 * that surfaces when the AI engineer has finished work and wants a minute of
 * your time. It is global — mounted in the root layout — so it can reach you on
 * any screen, just like a colleague tapping you on the shoulder.
 */
export function TeammateBubble() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<OpenReviewSession[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const next = await fetchOpenReviewSessions();
      if (active) setSessions(next);
    };
    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Don't nag the user while they're already on the review screen.
  const onReviewScreen = pathname?.startsWith("/reviews/");
  const pending = sessions.filter((s) => !dismissedIds.has(s.id));
  const top = pending[0];

  if (onReviewScreen || !top) return null;

  const snooze = (id: string) => setDismissedIds((prev) => new Set(prev).add(id));

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[22rem] max-w-[calc(100vw-2.5rem)]">
      {open ? (
        <div className="rounded-2xl border border-cockpit-accent/40 bg-cockpit-panel shadow-2xl shadow-black/40">
          <div className="flex items-start gap-3 p-4">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">Your AI teammate</p>
              <p className="mt-1 text-sm text-cockpit-muted">{top.headline}</p>
              {pending.length > 1 ? (
                <p className="mt-1 text-xs text-cockpit-muted">
                  +{pending.length - 1} more waiting
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-cockpit-border p-3">
            <button
              type="button"
              onClick={() => snooze(top.id)}
              className="rounded-md px-3 py-1.5 text-sm text-cockpit-muted hover:text-slate-200"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => router.push(`/reviews/${top.id}`)}
              className="rounded-md bg-cockpit-accent px-3 py-1.5 text-sm font-medium text-cockpit-bg hover:brightness-110"
            >
              Review with me →
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-full border border-cockpit-accent/40 bg-cockpit-panel py-2 pl-2 pr-4 shadow-2xl shadow-black/40 hover:border-cockpit-accent"
        >
          <Avatar pulse />
          <span className="text-sm text-slate-100">
            Got a minute to review?
            {pending.length > 1 ? <span className="text-cockpit-muted"> ({pending.length})</span> : null}
          </span>
        </button>
      )}
    </div>
  );
}

function Avatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cockpit-accent/15 text-cockpit-accent">
      {pulse ? (
        <span className="absolute inset-0 animate-ping rounded-full bg-cockpit-accent/20" />
      ) : null}
      <span className="relative text-base">🤖</span>
    </span>
  );
}
