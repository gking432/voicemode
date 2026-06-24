import { getReviewSession, setReviewSessionStatus } from "@vco/orchestrator";
import { ReviewSessionStatusSchema } from "@vco/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getReviewSession(id);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(session);
}

/** Update session status (e.g. mark in_progress when the user opens it). */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const parsed = ReviewSessionStatusSchema.safeParse(body.status);
  if (!parsed.success) return Response.json({ error: "Invalid status" }, { status: 400 });

  await setReviewSessionStatus(id, parsed.data);
  return Response.json({ ok: true });
}
