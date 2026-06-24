import { finishVoiceSession } from "@vco/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await finishVoiceSession(id);
  return Response.json(session);
}
