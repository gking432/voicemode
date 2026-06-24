import { describe, it, expect } from "vitest";
import { resolveModel, resolveModelForPlanKey } from "./model-router.js";
import { PLAN_DEFINITIONS } from "./plan.js";

describe("resolveModel", () => {
  it("passes through when the requested model is allowed", () => {
    const r = resolveModel({ requested: "claude-opus-4-8", plan: PLAN_DEFINITIONS.pro });
    expect(r.model).toBe("claude-opus-4-8");
    expect(r.fallbackApplied).toBe(false);
    expect(r.notice).toBeUndefined();
  });

  it("falls back to the best allowed model with a notice when not allowed", () => {
    const r = resolveModel({ requested: "claude-opus-4-8", plan: PLAN_DEFINITIONS.free });
    expect(r.model).toBe("claude-haiku-4-5");
    expect(r.fallbackApplied).toBe(true);
    expect(r.notice).toContain("Free");
    expect(r.notice).toContain("claude-opus-4-8");
  });

  it("resolves from a plan key string, defaulting unknown keys to free", () => {
    const free = resolveModelForPlanKey("claude-opus-4-8", "free");
    expect(free.model).toBe("claude-haiku-4-5");

    const unknown = resolveModelForPlanKey("claude-opus-4-8", "enterprise-zzz");
    expect(unknown.model).toBe("claude-haiku-4-5"); // unknown → default (free)

    const pro = resolveModelForPlanKey("claude-opus-4-8", "pro");
    expect(pro.fallbackApplied).toBe(false);
  });
});
