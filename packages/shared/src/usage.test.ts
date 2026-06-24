import { describe, it, expect } from "vitest";
import { computePlanUsageStatus, startOfCurrentMonth } from "./usage.js";

describe("computePlanUsageStatus", () => {
  it("reports remaining runs/reviews under the limit", () => {
    const s = computePlanUsageStatus("free", { runs: 5, reviews: 2, modelCalls: 11 });
    expect(s.plan.key).toBe("free");
    expect(s.runsRemaining).toBe(15); // free = 20
    expect(s.reviewsRemaining).toBe(18);
    expect(s.runLimitReached).toBe(false);
  });

  it("clamps remaining at zero and flags the limit when reached", () => {
    const s = computePlanUsageStatus("free", { runs: 25, reviews: 20, modelCalls: 0 });
    expect(s.runsRemaining).toBe(0);
    expect(s.runLimitReached).toBe(true);
    expect(s.reviewLimitReached).toBe(true);
  });

  it("uses pro limits for the pro plan", () => {
    const s = computePlanUsageStatus("pro", { runs: 25, reviews: 0, modelCalls: 0 });
    expect(s.runLimitReached).toBe(false);
    expect(s.runsRemaining).toBe(275); // pro = 300
  });
});

describe("startOfCurrentMonth", () => {
  it("returns the first day of the month in UTC", () => {
    const d = startOfCurrentMonth(new Date("2026-06-24T18:30:00Z"));
    expect(d.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});
