import { listOpenReviewSessions } from "@vco/orchestrator";
import { getCurrentUser } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open review sessions for the current user — polled by the teammate bubble. */
export async function GET() {
  const user = await getCurrentUser();
  const sessions = await listOpenReviewSessions(user.id);
  return Response.json({ sessions });
}
