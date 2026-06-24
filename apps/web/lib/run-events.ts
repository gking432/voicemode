import type { RunEvent } from "@vco/shared";

/**
 * Subscribe to a run's server-sent event stream (spec §24). Returns an
 * unsubscribe function.
 */
export function subscribeRunEvents(runId: string, onEvent: (event: RunEvent) => void): () => void {
  const source = new EventSource(`/api/runs/${runId}/events`);
  source.onmessage = (e: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(e.data) as RunEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  source.onerror = () => {
    // EventSource auto-reconnects; nothing to do here.
  };
  return () => source.close();
}
