import { prisma } from "@vco/db";
import { VercelCliAdapter } from "@vco/project-adapters";
import type { OrchestratorConfig } from "../config.js";
import { emitDeployment, recordLog } from "../events.js";

function vercelAdapter(cfg: OrchestratorConfig): VercelCliAdapter {
  return new VercelCliAdapter({
    cliPath: cfg.vercel.cliPath,
    token: cfg.vercel.token,
    teamId: cfg.vercel.teamId,
    workspaceRoot: cfg.workspaceRoot,
  });
}

/**
 * Deployment Service (spec §8.2.9, §21). Preview deploys are automatic after
 * checks pass; production is never deployed without explicit confirmation.
 */
export async function deployPreview(opts: {
  runId: string;
  projectPath: string;
  branchName: string;
  cfg: OrchestratorConfig;
}): Promise<{ status: string; url?: string }> {
  const { runId, projectPath, branchName, cfg } = opts;
  const deployment = await prisma.deployment.create({
    data: { runId, provider: "vercel", type: "preview", status: "pending" },
  });

  const out = await vercelAdapter(cfg).deployPreview({ projectPath, branchName });

  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { url: out.url, status: out.status, logs: out.logs?.slice(0, 8_000) },
  });

  if (out.url) {
    await prisma.run.update({ where: { id: runId }, data: { previewUrl: out.url } });
    emitDeployment(runId, out.url, out.status);
  }
  await recordLog(runId, out.status === "ready" ? "info" : "error", "vercel", `Preview deploy: ${out.status}`);
  return { status: out.status, url: out.url };
}

/**
 * Promote a run's branch to production. Requires an explicit confirmation flag
 * (collected by the API after the user types the confirmation phrase) and the
 * ALLOW_PRODUCTION_DEPLOY safety setting (spec §10.2, §21.2, §22.1).
 */
export async function promoteProduction(opts: {
  runId: string;
  projectPath: string;
  branchName: string;
  cfg: OrchestratorConfig;
  confirmed: boolean;
}): Promise<{ status: string; url?: string }> {
  const { runId, projectPath, branchName, cfg, confirmed } = opts;

  if (!cfg.safety.allowProductionDeploy) {
    throw new Error("Production deploys are disabled (ALLOW_PRODUCTION_DEPLOY=false).");
  }
  if (cfg.safety.requireConfirmationForProd && !confirmed) {
    throw new Error("Production deploy requires explicit user confirmation.");
  }

  const deployment = await prisma.deployment.create({
    data: { runId, provider: "vercel", type: "production", status: "pending" },
  });

  const out = await vercelAdapter(cfg).deployProduction({ projectPath, branchName });

  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { url: out.url, status: out.status, logs: out.logs?.slice(0, 8_000) },
  });

  if (out.url) {
    await prisma.run.update({ where: { id: runId }, data: { productionUrl: out.url } });
    emitDeployment(runId, out.url, out.status);
  }
  await recordLog(runId, out.status === "ready" ? "info" : "error", "vercel", `Production deploy: ${out.status}`);
  return { status: out.status, url: out.url };
}
