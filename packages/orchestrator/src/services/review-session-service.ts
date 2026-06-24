import { prisma } from "@vco/db";
import {
  type ClaudeReviewOutput,
  type FinalImplementationBrief,
  type ReviewDecision,
  type ReviewSessionStatus,
} from "@vco/shared";
import { buildReviewNarration } from "./review-narration-service.js";
import { recordUsage } from "./usage-ledger-service.js";

/**
 * Review-session service (spec §25–§26). Builds and persists the teammate's
 * "got a minute?" review for a finished run, and handles the user's response
 * (approve / revise / dismiss). A revision spawns a linked follow-up run so the
 * conversation keeps its thread.
 */

export interface CreateReviewSessionInput {
  runId: string;
}

/** Build a review session from a run's stored brief/review/diff and persist it. */
export async function createReviewSessionForRun(runId: string): Promise<string | null> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return null;

  // One review session per run (the relation is unique). Reuse if it exists.
  const existing = await prisma.reviewSession.findUnique({ where: { runId } });
  if (existing) return existing.id;

  const brief = (run.finalBrief as FinalImplementationBrief | null) ?? null;
  const claudeReview = (run.claudeReview as ClaudeReviewOutput | null) ?? null;

  // Without a brief we can't produce a meaningful walkthrough.
  if (!brief) return null;

  const changedFiles = brief.filesLikelyAffected ?? [];
  const narration = buildReviewNarration({
    title: brief.title,
    userIntent: brief.userIntent || run.userTranscript,
    brief,
    claudeReview,
    changedFiles,
    previewUrl: run.previewUrl ?? undefined,
    diffStat: run.diffSummary ?? undefined,
  });

  const session = await prisma.reviewSession.create({
    data: {
      runId: run.id,
      userId: run.userId,
      status: "ready",
      headline: narration.headline,
      openingLine: narration.openingLine,
      summary: narration.summary,
      assumptions: narration.assumptions,
      previewUrl: narration.previewUrl ?? null,
      diffStat: narration.diffStat ?? null,
      steps: {
        create: narration.steps.map((s) => ({
          order: s.order,
          kind: s.kind,
          title: s.title,
          narration: s.narration,
          filePath: s.filePath ?? null,
          diffHunk: s.diffHunk ?? null,
          pointerSelector: s.pointerSelector ?? null,
          pointerLabel: s.pointerLabel ?? null,
        })),
      },
    },
  });

  await recordUsage({ userId: run.userId, runId: run.id, kind: "review" });
  return session.id;
}

export function getReviewSession(id: string) {
  return prisma.reviewSession.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: "asc" } },
      run: { select: { id: true, projectId: true, previewUrl: true, diffSummary: true, status: true } },
      feedback: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** Sessions the teammate is waiting on (for the bubble). Most recent first. */
export function listOpenReviewSessions(userId: string, limit = 5) {
  return prisma.reviewSession.findMany({
    where: { userId, status: { in: ["ready", "in_progress"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      runId: true,
      status: true,
      headline: true,
      previewUrl: true,
      createdAt: true,
    },
  });
}

export async function setReviewSessionStatus(
  id: string,
  status: ReviewSessionStatus,
): Promise<void> {
  await prisma.reviewSession.update({ where: { id }, data: { status } });
}

export interface ReviewFeedbackResult {
  decision: ReviewDecision;
  followUpRunId?: string;
}

/**
 * Record the user's response. `revise` creates a linked follow-up run that
 * carries the prior context forward; `approve`/`dismiss` just close the session.
 */
export async function recordReviewFeedback(
  sessionId: string,
  decision: ReviewDecision,
  transcript?: string,
): Promise<ReviewFeedbackResult> {
  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
    include: { run: true },
  });
  if (!session) throw new Error(`Review session ${sessionId} not found`);

  let followUpRunId: string | undefined;

  if (decision === "revise") {
    const text = (transcript ?? "").trim();
    if (!text) throw new Error("A revision needs something to act on.");
    const parent = session.run;
    const child = await prisma.run.create({
      data: {
        userId: parent.userId,
        projectId: parent.projectId,
        voiceSessionId: parent.voiceSessionId,
        parentRunId: parent.id,
        status: "created",
        workflowMode: parent.workflowMode,
        userTranscript: text,
      },
    });
    followUpRunId = child.id;
  }

  await prisma.reviewFeedback.create({
    data: {
      reviewSessionId: sessionId,
      decision,
      transcript: transcript ?? null,
      followUpRunId: followUpRunId ?? null,
    },
  });

  await prisma.reviewSession.update({
    where: { id: sessionId },
    data: { status: decision === "dismiss" ? "dismissed" : "completed" },
  });

  // Kick off the follow-up after the session is settled so a slow start can't
  // leave the review hanging. Lazy import avoids a static cycle with the
  // run-orchestrator (which builds review sessions).
  if (followUpRunId) {
    const { startRun } = await import("../start-run.js");
    await startRun(followUpRunId);
  }

  return { decision, followUpRunId };
}
