import { prisma } from "@vco/db";
import { startRun } from "@vco/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Voice/text feedback loop (spec §8.2.10, §25.3). Creates a follow-up run
 * linked to its predecessor; the orchestrator pulls the project's prior-run
 * summaries as context automatically.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { transcript?: string };
  const transcript = (body.transcript ?? "").trim();
  if (!transcript) return Response.json({ error: "transcript is required" }, { status: 400 });

  const parent = await prisma.run.findUnique({ where: { id } });
  if (!parent) return Response.json({ error: "Not found" }, { status: 404 });

  const child = await prisma.run.create({
    data: {
      userId: parent.userId,
      projectId: parent.projectId,
      voiceSessionId: parent.voiceSessionId,
      parentRunId: parent.id,
      status: "created",
      workflowMode: parent.workflowMode,
      userTranscript: transcript,
    },
  });

  await startRun(child.id);
  return Response.json({ id: child.id }, { status: 201 });
}
