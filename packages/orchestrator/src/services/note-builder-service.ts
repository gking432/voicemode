import { parseStructuredNotes, type StructuredNotes, type WorkflowMode } from "@vco/shared";

export interface BuildNotesInput {
  transcript: string;
  /** Raw notes JSON from the Realtime intake agent (snake_case or camelCase). */
  rawNotes?: unknown;
  /** Explicit workflow mode from the request, overrides whatever the model chose. */
  workflowMode?: WorkflowMode;
  targetProject?: string;
}

/**
 * Note Builder Service (spec §8.2.2, §9.1). Normalizes the Realtime model's
 * output (or a bare transcript) into canonical {@link StructuredNotes}. Purely
 * deterministic — the LLM intake happens client-side during the voice session.
 */
export function buildStructuredNotes(input: BuildNotesInput): StructuredNotes {
  const src: Record<string, unknown> =
    input.rawNotes && typeof input.rawNotes === "object"
      ? { ...(input.rawNotes as Record<string, unknown>) }
      : {};

  if (input.transcript && !("rawTranscript" in src) && !("raw_transcript" in src)) {
    src.raw_transcript = input.transcript;
  }
  if (input.workflowMode) src.workflowMode = input.workflowMode;
  if (input.targetProject && !src.targetProject && !src.target_project) {
    src.targetProject = input.targetProject;
  }

  return parseStructuredNotes(src);
}
