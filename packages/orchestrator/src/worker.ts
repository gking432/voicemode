import { Worker, type Job } from "bullmq";
import { loadConfig } from "./config.js";
import { getConnection, RUN_QUEUE, type RunJobData } from "./queues.js";
import { runPipeline } from "./run-orchestrator.js";

/**
 * BullMQ worker entrypoint (spec §23). Run with `pnpm worker` when REDIS_URL is
 * configured. Without Redis, runs execute in-process (see start-run.ts) and this
 * worker is unnecessary.
 */
const cfg = loadConfig();
if (!cfg.redisUrl) {
  console.error("REDIS_URL is not set — runs execute in-process and no worker is needed.");
  process.exit(1);
}

const worker = new Worker<RunJobData>(
  RUN_QUEUE,
  async (job: Job<RunJobData>) => {
    await runPipeline(job.data.runId, cfg);
  },
  { connection: getConnection(), concurrency: 1 },
);

worker.on("completed", (job) => console.log(`[voicedev] run ${job.data.runId} processed`));
worker.on("failed", (job, err) => console.error(`[voicedev] run ${job?.data.runId} failed:`, err));

console.log(`[voicedev] worker listening on "${RUN_QUEUE}"`);
