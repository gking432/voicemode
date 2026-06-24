import { describe, it, expect } from "vitest";
import {
  ReviewNarrationPlanSchema,
  orderWalkthroughSteps,
  ReviewFeedbackInputSchema,
} from "./review.js";

describe("ReviewNarrationPlanSchema", () => {
  it("parses a well-formed narration plan", () => {
    const plan = ReviewNarrationPlanSchema.parse({
      headline: "Done with the signup tweak — got a minute?",
      openingLine: "I added the inline email validation you asked for.",
      summary: "Email field now validates on blur and shows a friendly error.",
      assumptions: ["Used the existing error styling rather than inventing a new one."],
      previewUrl: "https://preview.example.com",
      steps: [
        { order: 0, kind: "summary", title: "Overview", narration: "Here's the gist." },
        {
          order: 1,
          kind: "change",
          title: "SignupForm.tsx",
          narration: "Added a validator.",
          filePath: "src/SignupForm.tsx",
        },
      ],
    });
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1]?.kind).toBe("change");
  });

  it("rejects an unknown step kind", () => {
    const bad = {
      headline: "h",
      openingLine: "o",
      summary: "s",
      assumptions: [],
      steps: [{ order: 0, kind: "explode", title: "t", narration: "n" }],
    };
    expect(ReviewNarrationPlanSchema.safeParse(bad).success).toBe(false);
  });
});

describe("orderWalkthroughSteps", () => {
  it("sorts steps by order without mutating the input", () => {
    const input = [
      { order: 2, label: "c" },
      { order: 0, label: "a" },
      { order: 1, label: "b" },
    ];
    const sorted = orderWalkthroughSteps(input);
    expect(sorted.map((s) => s.label)).toEqual(["a", "b", "c"]);
    expect(input[0]?.label).toBe("c"); // original untouched
  });
});

describe("ReviewFeedbackInputSchema", () => {
  it("accepts a valid decision and trims the transcript", () => {
    const parsed = ReviewFeedbackInputSchema.parse({ decision: "revise", transcript: "  tweak  " });
    expect(parsed.decision).toBe("revise");
    expect(parsed.transcript).toBe("tweak");
  });

  it("rejects an invalid decision", () => {
    expect(ReviewFeedbackInputSchema.safeParse({ decision: "maybe" }).success).toBe(false);
  });
});
