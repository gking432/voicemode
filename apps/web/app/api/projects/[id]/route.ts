import { prisma } from "@vco/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const opt = (v: unknown): string | null | undefined =>
  v === undefined ? undefined : typeof v === "string" && v.trim() ? v.trim() : null;

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(project);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const project = await prisma.project.update({
    where: { id },
    data: {
      name: typeof body.name === "string" ? body.name : undefined,
      localPath: typeof body.localPath === "string" ? body.localPath : undefined,
      defaultBranch: typeof body.defaultBranch === "string" ? body.defaultBranch : undefined,
      packageManager: opt(body.packageManager),
      buildCommand: opt(body.buildCommand),
      testCommand: opt(body.testCommand),
      lintCommand: opt(body.lintCommand),
      typecheckCommand: opt(body.typecheckCommand),
      vercelProjectId: opt(body.vercelProjectId),
      workflowMode: typeof body.workflowMode === "string" ? body.workflowMode : undefined,
    },
  });
  return Response.json(project);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  // Runs, notes, logs, checks, and deployments cascade (see schema onDelete).
  await prisma.project.delete({ where: { id } });
  return Response.json({ ok: true });
}
