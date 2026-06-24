import { describe, it, expect } from "vitest";
import { parseStructuredNotes, safeParseStructuredNotes } from "./notes.js";

describe("parseStructuredNotes", () => {
  it("normalizes the snake_case shape emitted by the Realtime model (spec §9.1)", () => {
    const realtimeOutput = {
      raw_transcript: "move the AI summary above the timeline and deploy a preview",
      clean_summary: "Reorganize the lead detail page",
      target_project: "home-services-crm-demo",
      requested_changes: [
        "Move AI summary above customer timeline",
        "Make follow-up draft collapsible",
        "Make urgency score more prominent",
      ],
      design_preferences: ["Cleaner", "Less messy", "More obvious hierarchy"],
      implementation_mode: "implement_and_preview_deploy",
      blocking_questions: [],
      confidence: 0.86,
    };

    const notes = parseStructuredNotes(realtimeOutput);

    expect(notes.targetProject).toBe("home-services-crm-demo");
    expect(notes.requestedChanges).toHaveLength(3);
    expect(notes.designPreferences).toContain("Cleaner");
    expect(notes.workflowMode).toBe("implement_and_preview_deploy");
    expect(notes.intentSummary).toBe("Reorganize the lead detail page");
    // cleanedTranscript falls back to rawTranscript when not provided.
    expect(notes.cleanedTranscript).toBe(realtimeOutput.raw_transcript);
    expect(notes.confidence).toBeCloseTo(0.86);
  });

  it("accepts the canonical camelCase shape unchanged", () => {
    const notes = parseStructuredNotes({
      rawTranscript: "x",
      cleanedTranscript: "x",
      intentSummary: "y",
      requestedChanges: ["a"],
      designPreferences: [],
      businessLogicChanges: [],
      technicalConstraints: [],
      acceptanceCriteria: [],
      explicitNonGoals: [],
      workflowMode: "plan_only",
      blockingQuestions: [],
      confidence: 0.5,
    });
    expect(notes.workflowMode).toBe("plan_only");
    expect(notes.requestedChanges).toEqual(["a"]);
  });

  it("defaults missing fields and clamps confidence into [0,1]", () => {
    const notes = parseStructuredNotes({
      raw_transcript: "just do something",
      confidence: 5,
    });
    expect(notes.requestedChanges).toEqual([]);
    expect(notes.designPreferences).toEqual([]);
    expect(notes.blockingQuestions).toEqual([]);
    expect(notes.confidence).toBe(1);
    // Unknown/missing mode falls back to the default workflow mode.
    expect(notes.workflowMode).toBe("implement_and_preview_deploy");
  });

  it("falls back to default mode for an invalid implementation_mode", () => {
    const notes = parseStructuredNotes({
      raw_transcript: "hi",
      implementation_mode: "yolo_to_prod",
    });
    expect(notes.workflowMode).toBe("implement_and_preview_deploy");
  });

  it("coerces a single string into a one-element array and trims/drops empties", () => {
    const notes = parseStructuredNotes({
      raw_transcript: "hi",
      requested_changes: "make it nicer",
      design_preferences: ["  bold  ", "", "   "],
    });
    expect(notes.requestedChanges).toEqual(["make it nicer"]);
    expect(notes.designPreferences).toEqual(["bold"]);
  });

  it("safeParse never throws and reports ok", () => {
    const res = safeParseStructuredNotes({ raw_transcript: "hi" });
    expect(res.ok).toBe(true);
  });
});
