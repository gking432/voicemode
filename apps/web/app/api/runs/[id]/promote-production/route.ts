import { prisma } from "@vco/db";
import { loadConfig, promoteProduction, setStatus } from "@vco/orchestrator";
import { resolveProjectPath } from "@vco/project-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const CONFIRM_PHRASE = "Confirm production deploy";

/** Production promotion with an explicit typed confirmation (spec §10.2, §21.2, §22.1). */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };

  if (body.confirm !== CONFIRM_PHRASE) {
    return Response.json(
      { error: `Type the exact phrase to confirm: "${CONFIRM_PHRASE}".` },
      { status: 400 },
    );
  }

  const run = await prisma.run.findUnique({ where: { id }, include: { project: true } });
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });
  if (!run.branchName) return Response.json({ error: "No branch to promote." }, { status: 400 });

  const cfg = loadConfig();
  let projectPath: string;
  try {
    projectPath = resolveProjectPath(cfg.workspaceRoot, run.project.localPath);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Invalid path" }, { status: 400 });
  }

  try {
    const out = await promoteProduction({
      runId: id,
      projectPath,
      branchName: run.branchName,
      cfg,
      confirmed: true,
    });
    if (run.status === "awaiting_user_review") {
      await setStatus(id, "completed", "Promoted to production.").catch(() => undefined);
    }
    return Response.json(out);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Promotion failed" }, { status: 400 });
  }
}
