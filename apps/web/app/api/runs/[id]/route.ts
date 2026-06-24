import { prisma } from "@vco/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      logs: { orderBy: { createdAt: "asc" }, take: 300 },
      checks: { orderBy: { startedAt: "asc" } },
      deployments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(run);
}
