import { addUtterance } from "@vco/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    speaker?: string;
    rawText?: string;
    cleanedText?: string;
  };
  const utterance = await addUtterance({
    voiceSessionId: id,
    speaker: body.speaker === "assistant" ? "assistant" : "user",
    rawText: String(body.rawText ?? ""),
    cleanedText: body.cleanedText,
  });
  return Response.json(utterance, { status: 201 });
}
