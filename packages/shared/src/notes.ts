import { z } from "zod";
import { WorkflowModeSchema, WORKFLOW_MODES, DEFAULT_WORKFLOW_MODE } from "./workflow.js";

/**
 * Canonical structured notes (spec §17). This is the internal, camelCase shape
 * the orchestrator works with. The Realtime intake model may emit a looser
 * snake_case object (spec §9.1); {@link parseStructuredNotes} normalizes both.
 */
export const StructuredNotesSchema = z.object({
  rawTranscript: z.string(),
  cleanedTranscript: z.string(),
  targetProject: z.string().optional(),
  intentSummary: z.string(),
  requestedChanges: z.array(z.string()),
  designPreferences: z.array(z.string()),
  businessLogicChanges: z.array(z.string()),
  technicalConstraints: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  explicitNonGoals: z.array(z.string()),
  workflowMode: WorkflowModeSchema,
  blockingQuestions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type StructuredNotes = z.infer<typeof StructuredNotesSchema>;

const STRING_ARRAY_FIELDS = [
  "requestedChanges",
  "designPreferences",
  "businessLogicChanges",
  "technicalConstraints",
  "acceptanceCriteria",
  "explicitNonGoals",
  "blockingQuestions",
] as const;

/** Map the snake_case keys the Realtime model emits onto canonical camelCase. */
const SNAKE_ALIASES: Record<string, string> = {
  raw_transcript: "rawTranscript",
  cleaned_transcript: "cleanedTranscript",
  clean_summary: "intentSummary",
  clean_transcript: "cleanedTranscript",
  intent_summary: "intentSummary",
  target_project: "targetProject",
  requested_changes: "requestedChanges",
  design_preferences: "designPreferences",
  business_logic_changes: "businessLogicChanges",
  technical_constraints: "technicalConstraints",
  acceptance_criteria: "acceptanceCriteria",
  explicit_non_goals: "explicitNonGoals",
  implementation_mode: "workflowMode",
  workflow_mode: "workflowMode",
  blocking_questions: "blockingQuestions",
};

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * Normalize an arbitrary object (snake_case or camelCase, possibly partial)
 * into canonical {@link StructuredNotes}, applying safe defaults. Throws via
 * zod only if the normalized object is still structurally invalid (which
 * should not happen given the defaults below).
 */
export function parseStructuredNotes(input: unknown): StructuredNotes {
  const src: Record<string, unknown> =
    input && typeof input === "object" ? { ...(input as Record<string, unknown>) } : {};

  // Fold snake_case aliases onto their canonical keys (without clobbering an
  // already-present canonical value).
  for (const [snake, camel] of Object.entries(SNAKE_ALIASES)) {
    if (snake in src && !(camel in src)) {
      src[camel] = src[snake];
    }
  }

  const rawTranscript = typeof src.rawTranscript === "string" ? src.rawTranscript : "";
  const cleanedTranscript =
    typeof src.cleanedTranscript === "string" && src.cleanedTranscript.trim()
      ? src.cleanedTranscript
      : rawTranscript;
  const intentSummary =
    typeof src.intentSummary === "string" && src.intentSummary.trim()
      ? src.intentSummary
      : cleanedTranscript.slice(0, 280);

  const workflowMode = WORKFLOW_MODES.includes(src.workflowMode as never)
    ? (src.workflowMode as StructuredNotes["workflowMode"])
    : DEFAULT_WORKFLOW_MODE;

  const normalized: StructuredNotes = {
    rawTranscript,
    cleanedTranscript,
    targetProject:
      typeof src.targetProject === "string" && src.targetProject.trim()
        ? src.targetProject.trim()
        : undefined,
    intentSummary,
    requestedChanges: coerceStringArray(src.requestedChanges),
    designPreferences: coerceStringArray(src.designPreferences),
    businessLogicChanges: coerceStringArray(src.businessLogicChanges),
    technicalConstraints: coerceStringArray(src.technicalConstraints),
    acceptanceCriteria: coerceStringArray(src.acceptanceCriteria),
    explicitNonGoals: coerceStringArray(src.explicitNonGoals),
    workflowMode,
    blockingQuestions: coerceStringArray(src.blockingQuestions),
    confidence: clampConfidence(src.confidence),
  };

  // Belt-and-suspenders: validate the normalized object.
  return StructuredNotesSchema.parse(normalized);
}

export function safeParseStructuredNotes(
  input: unknown,
): { ok: true; notes: StructuredNotes } | { ok: false; error: string } {
  try {
    return { ok: true, notes: parseStructuredNotes(input) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export { STRING_ARRAY_FIELDS };
