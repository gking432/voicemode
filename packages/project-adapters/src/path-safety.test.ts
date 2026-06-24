import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isPathWithinRoot,
  resolveProjectPath,
  assertPathWithinRoot,
  PathSafetyError,
} from "./path-safety.js";

describe("isPathWithinRoot (lexical)", () => {
  const root = "/home/user/projects";

  it("accepts the root itself", () => {
    expect(isPathWithinRoot(root, root)).toBe(true);
  });

  it("accepts a descendant", () => {
    expect(isPathWithinRoot("/home/user/projects/crm/app", root)).toBe(true);
  });

  it("accepts a relative child resolved against the root", () => {
    expect(isPathWithinRoot("crm-demo", root)).toBe(true);
  });

  it("rejects a parent-traversal escape", () => {
    expect(isPathWithinRoot("/home/user/projects/../secrets", root)).toBe(false);
    expect(isPathWithinRoot("../secrets", root)).toBe(false);
  });

  it("rejects a sibling directory that shares a prefix", () => {
    expect(isPathWithinRoot("/home/user/projects-evil", root)).toBe(false);
  });

  it("rejects an unrelated absolute path", () => {
    expect(isPathWithinRoot("/etc/passwd", root)).toBe(false);
  });

  it("rejects null bytes and empty inputs", () => {
    expect(isPathWithinRoot("/home/user/projects/\0/x", root)).toBe(false);
    expect(isPathWithinRoot("", root)).toBe(false);
    expect(isPathWithinRoot(root, "")).toBe(false);
  });
});

describe("resolveProjectPath (with a real workspace)", () => {
  let root: string;
  let inside: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vco-ws-"));
    inside = path.join(root, "crm-demo");
    fs.mkdirSync(inside);
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("returns the canonical path for a child", () => {
    expect(resolveProjectPath(root, "crm-demo")).toBe(fs.realpathSync(inside));
  });

  it("accepts a not-yet-existing child path", () => {
    const resolved = resolveProjectPath(root, "new-project");
    expect(resolved.startsWith(fs.realpathSync(root))).toBe(true);
  });

  it("throws for traversal outside the root", () => {
    expect(() => resolveProjectPath(root, "../escape")).toThrow(PathSafetyError);
  });

  it("throws for an absolute path outside the root", () => {
    expect(() => resolveProjectPath(root, "/etc")).toThrow(PathSafetyError);
  });

  it("throws when the root is not configured", () => {
    expect(() => resolveProjectPath("", "crm-demo")).toThrow(PathSafetyError);
  });

  it("assertPathWithinRoot throws for escapes", () => {
    expect(() => assertPathWithinRoot("../escape", root)).toThrow(PathSafetyError);
    expect(() => assertPathWithinRoot("crm-demo", root)).not.toThrow();
  });
});
