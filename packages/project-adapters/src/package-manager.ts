import fs from "node:fs/promises";
import path from "node:path";
import type { CheckCommand } from "@vco/shared";

export type PackageManager = "pnpm" | "yarn" | "npm";

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function detectPackageManager(projectPath: string): Promise<PackageManager | null> {
  if (await fileExists(path.join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(path.join(projectPath, "yarn.lock"))) return "yarn";
  if (await fileExists(path.join(projectPath, "package-lock.json"))) return "npm";

  const pkg = await readPackageJson(projectPath);
  if (pkg?.packageManager && typeof pkg.packageManager === "string") {
    const name = pkg.packageManager.split("@")[0];
    if (name === "pnpm" || name === "yarn" || name === "npm") return name;
  }
  return null;
}

export interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  packageManager?: string;
  [key: string]: unknown;
}

export async function readPackageJson(projectPath: string): Promise<PackageJson | null> {
  try {
    const raw = await fs.readFile(path.join(projectPath, "package.json"), "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

export function runScript(pm: PackageManager, script: string): string {
  return `${pm} run ${script}`;
}

export function installCommand(pm: PackageManager): string {
  return pm === "npm" ? "npm install" : `${pm} install`;
}

const CHECK_SCRIPT_CANDIDATES: Record<CheckCommand["name"], { scripts: string[]; required: boolean }> =
  {
    lint: { scripts: ["lint"], required: false },
    typecheck: { scripts: ["typecheck", "type-check"], required: true },
    test: { scripts: ["test"], required: false },
    build: { scripts: ["build"], required: true },
  };

/**
 * Derive default check commands from a project's package.json scripts. Only
 * checks whose script actually exists are returned (spec §14.2 validation,
 * §17 CheckCommand).
 */
export async function defaultCheckCommands(projectPath: string): Promise<CheckCommand[]> {
  const pm = (await detectPackageManager(projectPath)) ?? "npm";
  const pkg = await readPackageJson(projectPath);
  const scripts = pkg?.scripts ?? {};
  const checks: CheckCommand[] = [];

  (Object.keys(CHECK_SCRIPT_CANDIDATES) as CheckCommand["name"][]).forEach((name) => {
    const { scripts: candidates, required } = CHECK_SCRIPT_CANDIDATES[name];
    const found = candidates.find((s) => s in scripts);
    if (found) {
      checks.push({ name, command: runScript(pm, found), required });
    }
  });

  return checks;
}
