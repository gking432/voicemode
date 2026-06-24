import fs from "node:fs/promises";
import path from "node:path";
import {
  detectPackageManager,
  readPackageJson,
  defaultCheckCommands,
} from "@vco/project-adapters";
import type { CheckCommand } from "@vco/shared";

export interface ProjectLike {
  name: string;
  slug?: string | null;
  defaultBranch?: string | null;
  packageManager?: string | null;
  buildCommand?: string | null;
  testCommand?: string | null;
  lintCommand?: string | null;
  typecheckCommand?: string | null;
}

export interface ProjectContext {
  summary: string;
  checkCommands: CheckCommand[];
  previousRunSummaries: string[];
}

/** Build check commands from explicit project config, falling back to package.json detection. */
export async function resolveCheckCommands(
  projectPath: string,
  project: ProjectLike,
): Promise<CheckCommand[]> {
  const explicit: CheckCommand[] = [];
  const add = (name: CheckCommand["name"], cmd: string | null | undefined, required: boolean) => {
    if (cmd && cmd.trim()) explicit.push({ name, command: cmd.trim(), required });
  };
  add("typecheck", project.typecheckCommand, true);
  add("lint", project.lintCommand, false);
  add("test", project.testCommand, false);
  add("build", project.buildCommand, true);

  if (explicit.length > 0) return explicit;
  return defaultCheckCommands(projectPath);
}

/**
 * Project Context Service (spec §8.2.3). Summarizes the active project for the
 * agents and resolves the check commands and prior-decision context.
 */
export async function loadProjectContext(opts: {
  projectPath: string;
  project: ProjectLike;
  previousRunSummaries?: string[];
}): Promise<ProjectContext> {
  const { projectPath, project } = opts;
  const pkg = await readPackageJson(projectPath);
  const pm = (await detectPackageManager(projectPath)) ?? project.packageManager ?? "unknown";

  let topLevel: string[] = [];
  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    topLevel = entries
      .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .slice(0, 40);
  } catch {
    /* ignore */
  }

  const scripts = pkg?.scripts ? Object.keys(pkg.scripts) : [];
  const summary = [
    `Project: ${pkg?.name ?? project.name}`,
    `Default branch: ${project.defaultBranch ?? "main"}`,
    `Package manager: ${pm}`,
    `Top-level entries: ${topLevel.join(", ") || "(unknown)"}`,
    `package.json scripts: ${scripts.join(", ") || "(none)"}`,
  ].join("\n");

  const checkCommands = await resolveCheckCommands(projectPath, project);

  return {
    summary,
    checkCommands,
    previousRunSummaries: opts.previousRunSummaries ?? [],
  };
}
