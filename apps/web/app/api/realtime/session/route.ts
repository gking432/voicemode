import { OpenAiRealtimeAdapter, loadPrompt } from "@vco/agents";
import { loadConfig } from "@vco/orchestrator";
import { WORKFLOW_MODES, DEFAULT_WORKFLOW_MODE, type WorkflowMode } from "@vco/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { projectId?: string; mode?: string };
  const cfg = loadConfig();

  if (!cfg.openai.apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 400 });
  }

  const mode: WorkflowMode = WORKFLOW_MODES.includes(body.mode as never)
    ? (body.mode as WorkflowMode)
    : DEFAULT_WORKFLOW_MODE;

  const adapter = new OpenAiRealtimeAdapter({
    apiKey: cfg.openai.apiKey,
    model: cfg.openai.realtimeModel,
  });

  try {
    const out = await adapter.createSession({
      projectId: body.projectId ?? "",
      workflowMode: mode,
      systemPrompt: loadPrompt("realtime-intake"),
    });
    return Response.json({ clientSecret: out.clientSecret, model: out.model, expiresAt: out.expiresAt });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create realtime session" },
      { status: 502 },
    );
  }
}
