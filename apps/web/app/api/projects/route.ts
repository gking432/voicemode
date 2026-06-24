import { prisma } from "@vco/db";
import { slugify, WORKFLOW_MODES, DEFAULT_WORKFLOW_MODE } from "@vco/shared";
import { getCurrentUser } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const opt = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export async function GET() {
  const user = await getCurrentUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json(projects);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = opt(body.name);
  const localPath = opt(body.localPath);
  if (!name || !localPath) {
    return Response.json({ error: "name and localPath are required" }, { status: 400 });
  }

  const workflowMode = WORKFLOW_MODES.includes(body.workflowMode as never)
    ? (body.workflowMode as string)
    : DEFAULT_WORKFLOW_MODE;

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name,
      slug: slugify(name),
      localPath,
      defaultBranch: opt(body.defaultBranch) ?? "main",
      packageManager: opt(body.packageManager),
      buildCommand: opt(body.buildCommand),
      testCommand: opt(body.testCommand),
      lintCommand: opt(body.lintCommand),
      typecheckCommand: opt(body.typecheckCommand),
      vercelProjectId: opt(body.vercelProjectId),
      workflowMode,
    },
  });

  return Response.json(project, { status: 201 });
}
