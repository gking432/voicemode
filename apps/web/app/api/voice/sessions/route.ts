import { createVoiceSession } from "@vco/orchestrator";
import { getCurrentUser } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => ({}))) as { projectId?: string };
  const session = await createVoiceSession({ userId: user.id, projectId: body.projectId || undefined });
  return Response.json(session, { status: 201 });
}
