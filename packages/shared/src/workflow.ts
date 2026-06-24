import { z } from "zod";

/**
 * Workflow modes (spec §10). Determines how far a run is allowed to proceed,
 * from "just take notes" up to "production deploy (with confirmation)".
 */
export const WORKFLOW_MODES = [
  "notes_only",
  "plan_only",
  "implement_local",
  "implement_and_preview_deploy",
  "create_pr",
  "production_deploy_requires_confirmation",
] as const;

export const WorkflowModeSchema = z.enum(WORKFLOW_MODES);
export type WorkflowMode = z.infer<typeof WorkflowModeSchema>;

/** Spec §10.1 — the default mode matches "make the changes and bring me a preview". */
export const DEFAULT_WORKFLOW_MODE: WorkflowMode = "implement_and_preview_deploy";

/** Whether a mode results in the agents editing files at all. */
export function modeImplements(mode: WorkflowMode): boolean {
  return (
    mode === "implement_local" ||
    mode === "implement_and_preview_deploy" ||
    mode === "create_pr" ||
    mode === "production_deploy_requires_confirmation"
  );
}

/** Whether a mode deploys a preview to Vercel. */
export function modeDeploysPreview(mode: WorkflowMode): boolean {
  return (
    mode === "implement_and_preview_deploy" ||
    mode === "production_deploy_requires_confirmation"
  );
}

/** Whether a mode opens a PR. */
export function modeCreatesPr(mode: WorkflowMode): boolean {
  return mode === "create_pr";
}

/**
 * Production deploy never happens automatically (spec §10.2, §21.2). Even in
 * `production_deploy_requires_confirmation` the orchestrator must pause for an
 * explicit, typed user confirmation before promoting.
 */
export function modeRequiresProductionConfirmation(mode: WorkflowMode): boolean {
  return mode === "production_deploy_requires_confirmation";
}
