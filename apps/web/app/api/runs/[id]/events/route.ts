import { prisma } from "@vco/db";
import { subscribeRun } from "@vco/orchestrator";
import type { RunEvent, RunStatus } from "@vco/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** SSE stream of run events (spec §24). */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RunEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      // Send the current status immediately so a late subscriber syncs up.
      const run = await prisma.run.findUnique({ where: { id }, select: { status: true } });
      if (run) {
        send({ type: "status", status: run.status as RunStatus, message: "" });
      }

      unsubscribe = subscribeRun(id, send);
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
