import { Queue } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config.js";

/**
 * Queue names (spec §23). The MVP runs the whole pipeline as one `run-pipeline`
 * job (the pipeline sequences the phases internally and updates run status);
 * the per-phase names are reserved for future granular processing.
 */
export const QUEUE_NAMES = [
  "voice-notes",
  "codex-analysis",
  "claude-review",
  "decision-merge",
  "codex-implementation",
  "verification",
  "deployment",
  "status-summary",
  "run-pipeline",
] as const;

export const RUN_QUEUE = "run-pipeline";

export interface RunJobData {
  runId: string;
}

let connection: IORedis | undefined;
let runQueue: Queue<RunJobData> | undefined;

export function getConnection(): IORedis {
  const cfg = loadConfig();
  if (!cfg.redisUrl) throw new Error("REDIS_URL is not configured.");
  connection ??= new IORedis(cfg.redisUrl, { maxRetriesPerRequest: null });
  return connection;
}

export function getRunQueue(): Queue<RunJobData> {
  runQueue ??= new Queue<RunJobData>(RUN_QUEUE, { connection: getConnection() });
  return runQueue;
}

export async function enqueueRun(runId: string): Promise<void> {
  await getRunQueue().add(
    "run",
    { runId },
    { attempts: 1, removeOnComplete: 100, removeOnFail: 200 },
  );
}
