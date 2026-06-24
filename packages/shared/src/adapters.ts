import { z } from "zod";
import type { StructuredNotes } from "./notes.js";
import type { FinalImplementationBrief } from "./brief.js";
import type { CheckCommand } from "./checks.js";
import type { WorkflowMode } from "./workflow.js";

// ---------------------------------------------------------------------------
// Codex adapter (spec §16.1)
// ---------------------------------------------------------------------------

export const CodexAnalyzeOutputSchema = z.object({
  summary: z.string(),
  likelyFiles: z.array(z.string()),
  implementationPlan: z.array(z.string()),
  risks: z.array(z.string()),
  blockingQuestions: z.array(z.string()),
  estimatedComplexity: z.enum(["small", "medium", "large"]),
});
export type CodexAnalyzeOutput = z.infer<typeof CodexAnalyzeOutputSchema>;

export type CodexAnalyzeInput = {
  projectPath: string;
  projectSummary: string;
  structuredNotes: StructuredNotes;
  relevantFiles?: string[];
  previousRunSummaries?: string[];
};

export type CodexImplementInput = {
  projectPath: string;
  branchName: string;
  finalBrief: FinalImplementationBrief;
  allowedCommands: string[];
  deniedCommands: string[];
  checkCommands: CheckCommand[];
};

export const CodexImplementOutputSchema = z.object({
  status: z.enum(["completed", "failed", "needs_user_input"]),
  summary: z.string(),
  filesChanged: z.array(z.string()),
  diff: z.string(),
  commitSha: z.string().optional(),
  errors: z.array(z.string()).optional(),
});
export type CodexImplementOutput = z.infer<typeof CodexImplementOutputSchema>;

export type CodexReviewDiffInput = {
  projectPath: string;
  diff: string;
  finalBrief: FinalImplementationBrief;
};

export type CodexReviewDiffOutput = {
  approved: boolean;
  notes: string[];
};

export interface CodexAdapter {
  analyze(input: CodexAnalyzeInput): Promise<CodexAnalyzeOutput>;
  implement(input: CodexImplementInput): Promise<CodexImplementOutput>;
  reviewDiff?(input: CodexReviewDiffInput): Promise<CodexReviewDiffOutput>;
}

// ---------------------------------------------------------------------------
// Claude adapter (spec §16.2)
// ---------------------------------------------------------------------------

export const ClaudeReviewOutputSchema = z.object({
  executiveSummary: z.string(),
  productRecommendations: z.array(z.string()),
  technicalRecommendations: z.array(z.string()),
  uxRecommendations: z.array(z.string()),
  risks: z.array(z.string()),
  disagreementsWithCodex: z.array(z.string()),
  finalSuggestedPlan: z.array(z.string()),
  shouldProceed: z.boolean(),
  blockingQuestions: z.array(z.string()),
});
export type ClaudeReviewOutput = z.infer<typeof ClaudeReviewOutputSchema>;

export type ClaudeReviewInput = {
  rawTranscript: string;
  structuredNotes: StructuredNotes;
  codexAnalysis: CodexAnalyzeOutput;
  projectSummary: string;
  relevantFiles?: Array<{ path: string; excerpt: string }>;
};

export type ClaudeDiffReviewInput = {
  diff: string;
  finalBrief: FinalImplementationBrief;
  projectSummary: string;
};

export type ClaudeDiffReviewOutput = {
  approved: boolean;
  blockingIssues: string[];
  notes: string[];
};

export interface ClaudeAdapter {
  review(input: ClaudeReviewInput): Promise<ClaudeReviewOutput>;
  reviewDiff?(input: ClaudeDiffReviewInput): Promise<ClaudeDiffReviewOutput>;
}

// ---------------------------------------------------------------------------
// Realtime voice adapter (spec §16.3)
// ---------------------------------------------------------------------------

export type CreateRealtimeSessionInput = {
  projectId: string;
  workflowMode: WorkflowMode;
  systemPrompt: string;
};

export type CreateRealtimeSessionOutput = {
  clientSecret: string;
  model: string;
  expiresAt?: string;
};

export interface RealtimeVoiceAdapter {
  createSession(input: CreateRealtimeSessionInput): Promise<CreateRealtimeSessionOutput>;
}

// ---------------------------------------------------------------------------
// Deployment adapter (spec §16.4)
// ---------------------------------------------------------------------------

export type DeployPreviewInput = {
  projectPath: string;
  projectId?: string;
  branchName: string;
};

export type DeployPreviewOutput = {
  status: "ready" | "failed" | "pending";
  url?: string;
  logs?: string;
};

export type DeployProductionInput = {
  projectPath: string;
  projectId?: string;
  branchName: string;
  commitSha?: string;
};

export type DeployProductionOutput = {
  status: "ready" | "failed" | "pending";
  url?: string;
  logs?: string;
};

export interface DeploymentAdapter {
  deployPreview(input: DeployPreviewInput): Promise<DeployPreviewOutput>;
  deployProduction(input: DeployProductionInput): Promise<DeployProductionOutput>;
}
