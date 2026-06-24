import { getPlanUsageStatus } from "@vco/orchestrator";
import { getCurrentUser } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current user's plan + monthly usage (spec §28). */
export async function GET() {
  const user = await getCurrentUser();
  const status = await getPlanUsageStatus(user.id);
  return Response.json(status);
}
