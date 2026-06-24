import { prisma } from "@vco/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await prisma.voiceSession.findUnique({
    where: { id },
    include: { utterances: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(session);
}
