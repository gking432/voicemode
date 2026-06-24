import { z } from "zod";

/** Final implementation brief Codex executes (spec §17). */
export const DeployPlanSchema = z.object({
  preview: z.boolean(),
  production: z.boolean(),
  requiresUserConfirmation: z.boolean(),
});

export const FinalImplementationBriefSchema = z.object({
  title: z.string(),
  userIntent: z.string(),
  requestedChanges: z.array(z.string()),
  acceptedCodexRecommendations: z.array(z.string()),
  acceptedClaudeRecommendations: z.array(z.string()),
  rejectedRecommendations: z.array(z.string()),
  finalImplementationPlan: z.array(z.string()),
  filesLikelyAffected: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  safetyConstraints: z.array(z.string()),
  testPlan: z.array(z.string()),
  deployPlan: DeployPlanSchema,
});

export type DeployPlan = z.infer<typeof DeployPlanSchema>;
export type FinalImplementationBrief = z.infer<typeof FinalImplementationBriefSchema>;
