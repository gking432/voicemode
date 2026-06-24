import {
  type StructuredNotes,
  type CodexAnalyzeOutput,
  type ClaudeReviewOutput,
  type FinalImplementationBrief,
  type WorkflowMode,
  modeDeploysPreview,
  modeRequiresProductionConfirmation,
} from "@vco/shared";

export interface MergeInput {
  notes: StructuredNotes;
  codexAnalysis: CodexAnalyzeOutput;
  claudeReview: ClaudeReviewOutput;
  /** Names of the project's check commands, used to seed the test plan. */
  checkCommandNames?: string[];
}

export interface MergeResult {
  brief: FinalImplementationBrief;
  shouldProceed: boolean;
  blockingQuestions: string[];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = raw.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

function deriveTitle(notes: StructuredNotes): string {
  const base = notes.intentSummary || notes.requestedChanges[0] || notes.cleanedTranscript;
  const firstSentence = base.split(/[.\n]/)[0]?.trim() ?? base;
  return firstSentence.slice(0, 80) || "Voice-guided change";
}

function deployPlan(mode: WorkflowMode): FinalImplementationBrief["deployPlan"] {
  return {
    preview: modeDeploysPreview(mode),
    // Production is never set automatically at merge time (spec §10.2, §21.2);
    // promotion is a separate, explicitly-confirmed step.
    production: false,
    requiresUserConfirmation: modeRequiresProductionConfirmation(mode),
  };
}

const BASE_SAFETY_CONSTRAINTS = [
  "Do not modify unrelated files.",
  "Do not remove existing functionality unless explicitly requested.",
  "Do not expose or commit secrets.",
  "Do not deploy to production without explicit user confirmation.",
];

/**
 * Deterministically combine the user transcript, structured notes, Codex
 * analysis, and Claude review into the final implementation brief (spec §18.4,
 * §16, §17). User intent wins; when Codex and Claude disagree, Claude's
 * `finalSuggestedPlan` is preferred when it says to proceed, otherwise Codex's
 * plan stands. Claude's recorded disagreements become rejected recommendations.
 */
export function mergeDecision(input: MergeInput): MergeResult {
  const { notes, codexAnalysis, claudeReview } = input;

  const blockingQuestions = dedupe([
    ...notes.blockingQuestions,
    ...codexAnalysis.blockingQuestions,
    ...claudeReview.blockingQuestions,
  ]);

  const shouldProceed = claudeReview.shouldProceed && blockingQuestions.length === 0;

  const finalPlan =
    claudeReview.shouldProceed && claudeReview.finalSuggestedPlan.length > 0
      ? claudeReview.finalSuggestedPlan
      : codexAnalysis.implementationPlan;

  const acceptanceCriteria =
    notes.acceptanceCriteria.length > 0
      ? notes.acceptanceCriteria
      : notes.requestedChanges.map((c) => `Verify: ${c}`);

  const checkNames = input.checkCommandNames?.length
    ? input.checkCommandNames
    : ["typecheck", "lint", "test", "build"];

  const brief: FinalImplementationBrief = {
    title: deriveTitle(notes),
    userIntent: notes.intentSummary || notes.cleanedTranscript,
    requestedChanges: dedupe([...notes.requestedChanges, ...notes.designPreferences]),
    acceptedCodexRecommendations: dedupe(codexAnalysis.implementationPlan),
    acceptedClaudeRecommendations: dedupe([
      ...claudeReview.finalSuggestedPlan,
      ...claudeReview.technicalRecommendations,
      ...claudeReview.uxRecommendations,
      ...claudeReview.productRecommendations,
    ]),
    rejectedRecommendations: dedupe(claudeReview.disagreementsWithCodex),
    finalImplementationPlan: dedupe(finalPlan),
    filesLikelyAffected: dedupe(codexAnalysis.likelyFiles),
    acceptanceCriteria: dedupe(acceptanceCriteria),
    safetyConstraints: dedupe([...BASE_SAFETY_CONSTRAINTS, ...notes.technicalConstraints]),
    testPlan: dedupe([
      ...checkNames.map((n) => `Run ${n}`),
      ...notes.acceptanceCriteria.map((c) => `Confirm: ${c}`),
    ]),
    deployPlan: deployPlan(notes.workflowMode),
  };

  return { brief, shouldProceed, blockingQuestions };
}
