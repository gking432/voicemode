import { describe, it, expect } from "vitest";
import { ReviewNarrationPlanSchema, type FinalImplementationBrief } from "@vco/shared";
import { buildReviewNarration } from "./review-narration-service.js";
import { explainFile } from "./code-diff-explanation-service.js";

const brief: FinalImplementationBrief = {
  title: "Add inline email validation to signup",
  userIntent: "validate the email field as the user types and show a friendly error",
  requestedChanges: ["Validate email on blur"],
  acceptedCodexRecommendations: [],
  acceptedClaudeRecommendations: ["Reuse the existing error styling"],
  rejectedRecommendations: ["Add a whole new form library"],
  finalImplementationPlan: ["Add a validator to SignupForm", "Show an error message"],
  filesLikelyAffected: ["src/components/SignupForm.tsx", "src/lib/validators.ts"],
  acceptanceCriteria: ["Invalid emails show an error"],
  safetyConstraints: [],
  testPlan: [],
  deployPlan: { preview: true, production: false, requiresUserConfirmation: true },
};

describe("buildReviewNarration", () => {
  it("produces a schema-valid plan with 2–4 steps and a preview point", () => {
    const plan = buildReviewNarration({
      title: brief.title,
      userIntent: brief.userIntent,
      brief,
      claudeReview: null,
      changedFiles: brief.filesLikelyAffected,
      previewUrl: "https://preview.example.com",
    });

    expect(() => ReviewNarrationPlanSchema.parse(plan)).not.toThrow();
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.steps.length).toBeLessThanOrEqual(4);
    expect(plan.headline).toContain(brief.title);

    // The first step is always the summary; a preview point exists when deployed.
    expect(plan.steps[0]?.kind).toBe("summary");
    expect(plan.steps.some((s) => s.kind === "preview_point")).toBe(true);
  });

  it("surfaces a rejected recommendation as an assumption", () => {
    const plan = buildReviewNarration({
      title: brief.title,
      userIntent: brief.userIntent,
      brief,
      changedFiles: [],
    });
    expect(plan.assumptions.join(" ")).toMatch(/chose not to/i);
  });

  it("omits the preview point when nothing was deployed", () => {
    const plan = buildReviewNarration({
      title: brief.title,
      userIntent: brief.userIntent,
      brief,
      changedFiles: brief.filesLikelyAffected,
    });
    expect(plan.steps.some((s) => s.kind === "preview_point")).toBe(false);
  });
});

describe("explainFile", () => {
  it("categorizes a component file and ties it to the plan", () => {
    const exp = explainFile("src/components/SignupForm.tsx", brief);
    expect(exp.category).toBe("ui");
    expect(exp.sentence).toContain("SignupForm.tsx");
  });

  it("categorizes the prisma schema as a data change", () => {
    const exp = explainFile("packages/db/prisma/schema.prisma", brief);
    expect(exp.category).toBe("data");
  });
});
