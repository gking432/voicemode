import { resolveModelForUser } from "@vco/orchestrator";
import { getCurrentUser } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve a requested model against the current user's plan (spec §28.3),
 * returning the model that will actually be used plus any fallback notice.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { requested?: string };
  const requested = (body.requested ?? "").trim();
  if (!requested) return Response.json({ error: "requested model is required" }, { status: 400 });

  const user = await getCurrentUser();
  const result = await resolveModelForUser(user.id, requested);
  return Response.json(result);
}
