import { describe, it, expect } from "vitest";
import {
  parseStructuredNotes,
  FinalImplementationBriefSchema,
  type CodexAnalyzeOutput,
  type ClaudeReviewOutput,
} from "@vco/shared";
import { mergeDecision } from "./decision-merge.js";

function notes(overrides: Record<string, unknown> = {}) {
  return parseStructuredNotes({
    raw_transcript: "move the AI summary above the timeline and deploy a preview",
    clean_summary: "Reorganize the lead detail page",
    requested_changes: ["Move AI summary above timeline", "Make follow-up draft collapsible"],
    design_preferences: ["Cleaner hierarchy"],
    implementation_mode: "implement_and_preview_deploy",
    ...overrides,
  });
}

const codex: CodexAnalyzeOutput = {
  summary: "Reorder components on the lead detail page.",
  likelyFiles: ["app/leads/[id]/page.tsx", "components/LeadDetail.tsx"],
  implementationPlan: ["Move AISummary above Timeline", "Wrap FollowUpDraft in a collapsible"],
  risks: ["None significant"],
  blockingQuestions: [],
  estimatedComplexity: "small",
};

const claude: ClaudeReviewOutput = {
  executiveSummary: "Reasonable, low-risk reorg.",
  productRecommendations: ["Keep urgency score visible above the fold"],
  technicalRecommendations: ["Use an existing Collapsible primitive"],
  uxRecommendations: ["Animate the collapse"],
  risks: [],
  disagreementsWithCodex: ["Codex suggested a new component; reuse the existing one instead"],
  finalSuggestedPlan: [
    "Reuse Collapsible for FollowUpDraft",
    "Move AISummary above Timeline",
    "Bump urgency score prominence",
  ],
  shouldProceed: true,
  blockingQuestions: [],
};

describe("mergeDecision (spec §18.4)", () => {
  it("produces a schema-valid brief", () => {
    const { brief } = mergeDecision({ notes: notes(), codexAnalysis: codex, claudeReview: claude });
    expect(() => FinalImplementationBriefSchema.parse(brief)).not.toThrow();
  });

  it("proceeds when Claude approves and there are no blocking questions", () => {
    const { shouldProceed, blockingQuestions } = mergeDecision({
      notes: notes(),
      codexAnalysis: codex,
      claudeReview: claude,
    });
    expect(shouldProceed).toBe(true);
    expect(blockingQuestions).toEqual([]);
  });

  it("prefers Claude's final plan when proceeding", () => {
    const { brief } = mergeDecision({ notes: notes(), codexAnalysis: codex, claudeReview: claude });
    expect(brief.finalImplementationPlan).toEqual(claude.finalSuggestedPlan);
    expect(brief.rejectedRecommendations).toEqual(claude.disagreementsWithCodex);
  });

  it("falls back to Codex's plan when Claude gives no final plan", () => {
    const { brief } = mergeDecision({
      notes: notes(),
      codexAnalysis: codex,
      claudeReview: { ...claude, finalSuggestedPlan: [] },
    });
    expect(brief.finalImplementationPlan).toEqual(codex.implementationPlan);
  });

  it("aggregates blocking questions and refuses to proceed", () => {
    const { shouldProceed, blockingQuestions } = mergeDecision({
      notes: notes({ blocking_questions: ["Which timeline component?"] }),
      codexAnalysis: { ...codex, blockingQuestions: ["Is there a design system?"] },
      claudeReview: { ...claude, shouldProceed: false, blockingQuestions: ["Confirm scope"] },
    });
    expect(shouldProceed).toBe(false);
    expect(blockingQuestions).toHaveLength(3);
  });

  it("derives acceptance criteria from requested changes when none are given", () => {
    const { brief } = mergeDecision({
      notes: notes({ acceptance_criteria: [] }),
      codexAnalysis: codex,
      claudeReview: claude,
    });
    expect(brief.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(brief.acceptanceCriteria[0]).toMatch(/^Verify:/);
  });

  it("reflects the workflow mode in the deploy plan", () => {
    const preview = mergeDecision({ notes: notes(), codexAnalysis: codex, claudeReview: claude });
    expect(preview.brief.deployPlan).toEqual({
      preview: true,
      production: false,
      requiresUserConfirmation: false,
    });

    const planOnly = mergeDecision({
      notes: notes({ implementation_mode: "plan_only" }),
      codexAnalysis: codex,
      claudeReview: claude,
    });
    expect(planOnly.brief.deployPlan.preview).toBe(false);

    const prod = mergeDecision({
      notes: notes({ implementation_mode: "production_deploy_requires_confirmation" }),
      codexAnalysis: codex,
      claudeReview: claude,
    });
    expect(prod.brief.deployPlan.requiresUserConfirmation).toBe(true);
    expect(prod.brief.deployPlan.production).toBe(false);
  });
});
