import { loadConfig, type OrchestratorConfig } from "./config.js";
import { runPipeline } from "./run-orchestrator.js";

/**
 * Kick off processing for a run. With Redis configured the job is enqueued for
 * the BullMQ worker; otherwise (local-first default) the pipeline runs in-process
 * fire-and-forget — appropriate for a long-lived `pnpm dev` / `pnpm start` server.
 */
export async function startRun(runId: string, cfg: OrchestratorConfig = loadConfig()): Promise<void> {
  if (cfg.redisUrl) {
    const { enqueueRun } = await import("./queues.js");
    await enqueueRun(runId);
    return;
  }
  void runPipeline(runId, cfg).catch((err) => {
    // The pipeline marks the run failed internally; this guards the floating promise.
    console.error(`[voicedev] run ${runId} crashed:`, err);
  });
}
