import { describe, it, expect } from "vitest";
import { extractJson } from "./json.js";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a fenced ```json block", () => {
    const text = 'Here you go:\n```json\n{"ok": true, "items": [1,2]}\n```\nthanks';
    expect(extractJson(text)).toEqual({ ok: true, items: [1, 2] });
  });

  it("extracts the first balanced object amid prose", () => {
    const text = 'Sure! {"summary":"x","risks":[]} — let me know.';
    expect(extractJson(text)).toEqual({ summary: "x", risks: [] });
  });

  it("handles braces inside strings", () => {
    expect(extractJson('{"note":"use {curly} braces"}')).toEqual({
      note: "use {curly} braces",
    });
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
