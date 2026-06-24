import { prisma, Prisma } from "@vco/db";
import { startRun } from "@vco/orchestrator";
import { WORKFLOW_MODES } from "@vco/shared";
import { getCurrentUser } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const runs = await prisma.run.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { project: true },
  });
  return Response.json(runs);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    transcript?: string;
    workflowMode?: string;
    structuredNotes?: unknown;
    voiceSessionId?: string;
    parentRunId?: string;
  };

  if (!body.projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: body.projectId, userId: user.id },
  });
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const workflowMode = WORKFLOW_MODES.includes(body.workflowMode as never)
    ? (body.workflowMode as string)
    : project.workflowMode;

  const run = await prisma.run.create({
    data: {
      userId: user.id,
      projectId: project.id,
      voiceSessionId: body.voiceSessionId ?? null,
      parentRunId: body.parentRunId ?? null,
      status: "created",
      workflowMode,
      userTranscript: String(body.transcript ?? ""),
      structuredNotes: body.structuredNotes
        ? (body.structuredNotes as Prisma.InputJsonValue)
        : undefined,
    },
  });

  await startRun(run.id);
  return Response.json({ id: run.id }, { status: 201 });
}
