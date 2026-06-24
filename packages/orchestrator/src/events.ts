import { EventEmitter } from "node:events";
import { prisma } from "@vco/db";
import {
  type RunEvent,
  type RunStatus,
  type LogLevel,
  type LogSource,
  type CheckStatus,
} from "@vco/shared";
import { assertTransition } from "./run-state-machine.js";

/**
 * In-process pub/sub for run events, consumed by the SSE endpoint
 * (`GET /api/runs/:id/events`, spec §24). Each runId is an event channel.
 * For multi-process deployments this would be backed by Redis pub/sub; the
 * in-process emitter is sufficient for the local-first MVP.
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);

export function subscribeRun(runId: string, cb: (event: RunEvent) => void): () => void {
  const handler = (event: RunEvent) => cb(event);
  bus.on(runId, handler);
  return () => bus.off(runId, handler);
}

function emit(runId: string, event: RunEvent): void {
  bus.emit(runId, event);
}

/** Persist a run log line (spec §12.7) and stream it to subscribers. Secrets must be masked by callers. */
export async function recordLog(
  runId: string,
  level: LogLevel,
  source: LogSource,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.runLog
    .create({ data: { runId, level, source, message, metadata: metadata as object } })
    .catch(() => undefined);
  emit(runId, { type: "log", level, source, message });
}

/** Transition a run's status (validated against the state machine) and stream it. */
export async function setStatus(runId: string, status: RunStatus, message: string): Promise<void> {
  const run = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
  if (run) assertTransition(run.status as RunStatus, status);

  const completedAt =
    status === "completed" || status === "failed" || status === "cancelled" ? new Date() : undefined;

  await prisma.run.update({
    where: { id: runId },
    data: { status, ...(completedAt ? { completedAt } : {}) },
  });
  emit(runId, { type: "status", status, message });
}

export function emitAgentOutput(
  runId: string,
  agent: "realtime" | "codex" | "claude",
  summary: string,
): void {
  emit(runId, { type: "agent_output", agent, summary });
}

export function emitCheckResult(runId: string, name: string, status: CheckStatus): void {
  emit(runId, { type: "check_result", name, status });
}

export function emitDeployment(runId: string, url: string, status: string): void {
  emit(runId, { type: "deployment", url, status });
}

export function emitError(runId: string, message: string): void {
  emit(runId, { type: "error", message });
}
