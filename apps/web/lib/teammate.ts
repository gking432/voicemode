import type { ReviewDecision, ReviewSessionStatus, WalkthroughStepKind } from "@vco/shared";

/** Shapes returned by the review-session API routes (serialized Prisma rows). */

export interface OpenReviewSession {
  id: string;
  runId: string;
  status: ReviewSessionStatus;
  headline: string;
  previewUrl: string | null;
  createdAt: string;
}

export interface WalkthroughStepDTO {
  id: string;
  order: number;
  kind: WalkthroughStepKind;
  title: string;
  narration: string;
  filePath: string | null;
  diffHunk: string | null;
  pointerSelector: string | null;
  pointerLabel: string | null;
}

export interface ReviewSessionDTO {
  id: string;
  runId: string;
  status: ReviewSessionStatus;
  headline: string;
  openingLine: string;
  summary: string;
  assumptions: string[];
  previewUrl: string | null;
  diffStat: string | null;
  steps: WalkthroughStepDTO[];
  run: { id: string; projectId: string; previewUrl: string | null; diffSummary: string | null; status: string };
}

export interface FeedbackResponse {
  decision: ReviewDecision;
  followUpRunId?: string;
}

export async function fetchOpenReviewSessions(): Promise<OpenReviewSession[]> {
  const res = await fetch("/api/review-sessions", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { sessions: OpenReviewSession[] };
  return data.sessions ?? [];
}

/**
 * Browser text-to-speech for the walkthrough narration. The MVP uses the Web
 * Speech API rather than streaming TTS — no extra infra, and it makes the
 * teammate genuinely *talk you through* the review. Returns true if speech was
 * started.
 */
export function speak(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
