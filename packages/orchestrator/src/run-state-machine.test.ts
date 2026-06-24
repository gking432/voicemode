import { describe, it, expect } from "vitest";
import { RUN_STATUSES, type RunStatus } from "@vco/shared";
import { canTransition, assertTransition, InvalidTransitionError } from "./run-state-machine.js";

describe("run state machine (spec §11)", () => {
  it("follows the documented happy path", () => {
    const happyPath: RunStatus[] = [
      "created",
      "building_notes",
      "codex_analyzing",
      "claude_reviewing",
      "merging_decision",
      "codex_implementing",
      "running_checks",
      "creating_commit",
      "deploying_preview",
      "awaiting_user_review",
      "completed",
    ];
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(canTransition(happyPath[i]!, happyPath[i + 1]!)).toBe(true);
    }
  });

  it("allows the check → fix → re-check loop", () => {
    expect(canTransition("running_checks", "fixing_errors")).toBe(true);
    expect(canTransition("fixing_errors", "running_checks")).toBe(true);
  });

  it("allows failure and cancellation from any active state", () => {
    for (const status of RUN_STATUSES) {
      const terminal = status === "completed" || status === "failed" || status === "cancelled";
      expect(canTransition(status, "failed")).toBe(!terminal);
      expect(canTransition(status, "cancelled")).toBe(!terminal);
    }
  });

  it("forbids leaving terminal states", () => {
    expect(canTransition("completed", "listening")).toBe(false);
    expect(canTransition("failed", "codex_analyzing")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
  });

  it("forbids skipping ahead (e.g. notes → implementing)", () => {
    expect(canTransition("building_notes", "codex_implementing")).toBe(false);
    expect(canTransition("created", "deploying_preview")).toBe(false);
  });

  it("forbids a no-op self transition", () => {
    expect(canTransition("running_checks", "running_checks")).toBe(false);
  });

  it("can resume from needs_user_input back into the pipeline", () => {
    expect(canTransition("needs_user_input", "codex_implementing")).toBe(true);
    expect(canTransition("needs_user_input", "completed")).toBe(true);
  });

  it("assertTransition throws on an invalid edge", () => {
    expect(() => assertTransition("completed", "listening")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("created", "building_notes")).not.toThrow();
  });
});
