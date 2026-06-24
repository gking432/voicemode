import { prisma } from "@vco/db";
import { runCommand, CommandPolicyError } from "@vco/project-adapters";
import type { CheckCommand, CheckStatus } from "@vco/shared";
import { emitCheckResult, recordLog } from "../events.js";

export interface CheckOutcome {
  name: string;
  command: string;
  status: CheckStatus;
  required: boolean;
}

export interface VerificationResult {
  outcomes: CheckOutcome[];
  allRequiredPassed: boolean;
}

const MAX_OUTPUT = 8_000;

/**
 * Verification Service (spec §8.2.8). Runs the project's check commands through
 * the policy-gated command runner, persists {@link CheckResult} rows, and
 * decides whether deployment is allowed (all required checks passed).
 */
export async function runChecks(opts: {
  runId: string;
  projectPath: string;
  workspaceRoot: string;
  checks: CheckCommand[];
}): Promise<VerificationResult> {
  const { runId, projectPath, workspaceRoot, checks } = opts;
  const outcomes: CheckOutcome[] = [];
  let allRequiredPassed = true;

  for (const check of checks) {
    const startedAt = new Date();
    let status: CheckStatus = "passed";
    let output = "";

    try {
      const result = await runCommand(check.command, {
        cwd: projectPath,
        workspaceRoot,
        timeoutMs: 10 * 60 * 1000,
      });
      output = `${result.stdout}\n${result.stderr}`.trim().slice(0, MAX_OUTPUT);
      status = result.exitCode === 0 && !result.timedOut ? "passed" : "failed";
    } catch (err) {
      // A denied/unconfirmed command is recorded as skipped rather than crashing the run.
      status = err instanceof CommandPolicyError ? "skipped" : "failed";
      output = err instanceof Error ? err.message : String(err);
    }

    await prisma.checkResult
      .create({
        data: {
          runId,
          name: check.name,
          command: check.command,
          status,
          output,
          startedAt,
          endedAt: new Date(),
        },
      })
      .catch(() => undefined);

    emitCheckResult(runId, check.name, status);
    await recordLog(runId, status === "failed" ? "error" : "info", "system", `Check ${check.name}: ${status}`);

    if (check.required && status !== "passed") allRequiredPassed = false;
    outcomes.push({ name: check.name, command: check.command, status, required: check.required });
  }

  return { outcomes, allRequiredPassed };
}
