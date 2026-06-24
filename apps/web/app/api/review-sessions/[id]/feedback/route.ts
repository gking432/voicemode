import { recordReviewFeedback } from "@vco/orchestrator";
import { ReviewFeedbackInputSchema } from "@vco/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The user's response to a review (spec §27). `revise` spawns a linked
 * follow-up run and returns its id so the UI can navigate to it.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = ReviewFeedbackInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "decision must be approve, revise, or dismiss" }, { status: 400 });
  }

  try {
    const result = await recordReviewFeedback(id, parsed.data.decision, parsed.data.transcript);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
