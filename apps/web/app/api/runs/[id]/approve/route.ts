import { prisma } from "@vco/db";
import { setStatus } from "@vco/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const run = await prisma.run.findUnique({ where: { id }, select: { status: true } });
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });
  if (run.status !== "awaiting_user_review") {
    return Response.json({ error: "Run is not awaiting review." }, { status: 400 });
  }
  await setStatus(id, "completed", "Approved by user.");
  return Response.json({ ok: true });
}
