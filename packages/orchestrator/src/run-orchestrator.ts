import fs from "node:fs/promises";
import path from "node:path";
import { prisma, Prisma } from "@vco/db";
import {
  type WorkflowMode,
  type StructuredNotes,
  modeImplements,
  buildBranchName,
  buildCommitMessage,
} from "@vco/shared";
import { createCodexAdapter, createClaudeAdapter } from "@vco/agents";
import { resolveProjectPath, isPathWithinRoot, git } from "@vco/project-adapters";
import { loadConfig, type OrchestratorConfig } from "./config.js";
import { setStatus, recordLog, emitAgentOutput, emitError } from "./events.js";
import { buildStructuredNotes } from "./services/note-builder-service.js";
import { loadProjectContext } from "./services/project-context-service.js";
import { buildAndStoreFinalBrief } from "./services/decision-merge-service.js";
import { runChecks, type CheckOutcome } from "./services/verification-service.js";
import { deployPreview } from "./services/deployment-service.js";
import { buildStatusSummary } from "./services/status-summary-service.js";

const DENIED_COMMANDS = ["git push --force", "vercel --prod", "rm -rf", "sudo"];

function buildAdapters(cfg: OrchestratorConfig) {
  return {
    codex: createCodexAdapter({
      provider: cfg.codex.provider,
      cliPath: cfg.codex.cliPath,
      model: cfg.codex.model,
      sandboxMode: cfg.codex.sandboxMode,
    }),
    claude: createClaudeAdapter({
      provider: cfg.claude.provider,
      apiKey: cfg.claude.apiKey,
      model: cfg.claude.model,
      cliPath: cfg.claude.cliPath,
    }),
  };
}

function patchRun(runId: string, data: Prisma.RunUpdateInput): Promise<unknown> {
  return prisma.run.update({ where: { id: runId }, data });
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

async function loadPreviousSummaries(projectId: string, excludeRunId: string): Promise<string[]> {
  const runs = await prisma.run.findMany({
    where: { projectId, id: { not: excludeRunId }, diffSummary: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { userTranscript: true, diffSummary: true },
  });
  return runs.map((r) => `"${r.userTranscript.slice(0, 120)}" → ${r.diffSummary?.slice(0, 200) ?? ""}`);
}

async function readExcerpts(
  projectPath: string,
  files: string[],
): Promise<Array<{ path: string; excerpt: string }>> {
  const out: Array<{ path: string; excerpt: string }> = [];
  for (const file of files.slice(0, 3)) {
    const abs = path.resolve(projectPath, file);
    if (!isPathWithinRoot(abs, projectPath)) continue;
    try {
      const content = await fs.readFile(abs, "utf8");
      out.push({ path: file, excerpt: content.slice(0, 3_000) });
    } catch {
      /* file may not exist yet */
    }
  }
  return out;
}

async function prepareBranch(opts: {
  projectPath: string;
  projectSlug: string;
  defaultBranch: string;
  title: string;
  runId: string;
}): Promise<string> {
  const { projectPath, projectSlug, defaultBranch, title, runId } = opts;

  if (await git.hasRemote(projectPath)) {
    await git.fetch(projectPath, "origin", defaultBranch).catch(() => undefined);
  }
  await git.checkout(projectPath, defaultBranch).catch(() => undefined);

  const branchName = buildBranchName({ projectSlug, requestSummary: title, runId });
  if (await git.branchExists(projectPath, branchName)) {
    await git.checkout(projectPath, branchName);
  } else {
    await git.createBranch(projectPath, branchName, defaultBranch);
  }
  return branchName;
}

/**
 * The full voice → notes → Codex → Claude → Codex → checks → deploy pipeline
 * (spec §3, §8.1, §11). Drives the run state machine, persists each agent's
 * output, streams progress, and stops at safe gates (blocking questions,
 * failing checks, production confirmation).
 */
export async function runPipeline(runId: string, cfg: OrchestratorConfig = loadConfig()): Promise<void> {
  const run = await prisma.run.findUnique({ where: { id: runId }, include: { project: true } });
  if (!run) throw new Error(`Run ${runId} not found`);
  const project = run.project;

  try {
    const projectPath = resolveProjectPath(cfg.workspaceRoot, project.localPath);

    // 1. Structured notes ----------------------------------------------------
    await setStatus(runId, "building_notes", "Turning your voice note into a brief…");
    const notes: StructuredNotes = buildStructuredNotes({
      transcript: run.userTranscript,
      rawNotes: run.structuredNotes ?? undefined,
      workflowMode: run.workflowMode as WorkflowMode,
    });
    await patchRun(runId, { structuredNotes: asJson(notes) });
    emitAgentOutput(runId, "realtime", notes.intentSummary);

    if (notes.workflowMode === "notes_only") {
      await recordLog(runId, "info", "system", "Notes-only run complete.");
      await setStatus(runId, "completed", "Notes captured.");
      return;
    }

    // 2. Codex analysis ------------------------------------------------------
    const previousRunSummaries = await loadPreviousSummaries(project.id, runId);
    const ctx = await loadProjectContext({ projectPath, project, previousRunSummaries });
    const adapters = buildAdapters(cfg);

    await setStatus(runId, "codex_analyzing", "Codex is inspecting the codebase…");
    const codexAnalysis = await adapters.codex.analyze({
      projectPath,
      projectSummary: ctx.summary,
      structuredNotes: notes,
      previousRunSummaries,
    });
    await patchRun(runId, { codexAnalysis: asJson(codexAnalysis) });
    emitAgentOutput(runId, "codex", codexAnalysis.summary);

    // 3. Claude review -------------------------------------------------------
    await setStatus(runId, "claude_reviewing", "Claude is reviewing the plan…");
    const relevantFiles = await readExcerpts(projectPath, codexAnalysis.likelyFiles);
    const claudeReview = await adapters.claude.review({
      rawTranscript: run.userTranscript,
      structuredNotes: notes,
      codexAnalysis,
      projectSummary: ctx.summary,
      relevantFiles,
    });
    await patchRun(runId, { claudeReview: asJson(claudeReview) });
    emitAgentOutput(runId, "claude", claudeReview.executiveSummary);

    // 4. Merge decision ------------------------------------------------------
    await setStatus(runId, "merging_decision", "Merging recommendations into a final brief…");
    const merge = await buildAndStoreFinalBrief(runId, {
      notes,
      codexAnalysis,
      claudeReview,
      checkCommandNames: ctx.checkCommands.map((c) => c.name),
    });

    if (!merge.shouldProceed) {
      await recordLog(runId, "warn", "system", `Blocking: ${merge.blockingQuestions.join(" | ")}`);
      await setStatus(runId, "needs_user_input", "I need a quick decision before continuing.");
      return;
    }

    if (notes.workflowMode === "plan_only" || !modeImplements(notes.workflowMode)) {
      await recordLog(runId, "info", "system", "Plan ready (plan-only mode).");
      await setStatus(runId, "completed", "Plan ready — nothing implemented (plan-only).");
      return;
    }

    // 5. Implementation ------------------------------------------------------
    if (!(await git.isGitRepo(projectPath))) {
      throw new Error("Project is not a git repository.");
    }
    if (!(await git.isWorkingTreeClean(projectPath))) {
      await recordLog(runId, "warn", "git", "Working tree is not clean.");
      await setStatus(
        runId,
        "needs_user_input",
        "Your working tree has uncommitted changes. Commit or stash them, then retry.",
      );
      return;
    }

    await setStatus(runId, "codex_implementing", "Codex is implementing on a new branch…");
    const defaultBranch = project.defaultBranch || (await git.detectDefaultBranch(projectPath));
    const branchName = await prepareBranch({
      projectPath,
      projectSlug: project.slug || project.name,
      defaultBranch,
      title: merge.brief.title,
      runId,
    });
    await patchRun(runId, { branchName });

    const implementResult = await adapters.codex.implement({
      projectPath,
      branchName,
      finalBrief: merge.brief,
      allowedCommands: ctx.checkCommands.map((c) => c.command),
      deniedCommands: DENIED_COMMANDS,
      checkCommands: ctx.checkCommands,
    });

    if (implementResult.status === "failed") {
      await patchRun(runId, { errorMessage: (implementResult.errors ?? []).join("\n").slice(0, 1_000) });
      emitError(runId, "Codex implementation failed.");
      await setStatus(runId, "failed", "Implementation failed — see the logs.");
      return;
    }
    emitAgentOutput(runId, "codex", implementResult.summary);
    await patchRun(runId, { diffSummary: (await git.diffStat(projectPath)).slice(0, 8_000) });

    // 6. Checks (with a single fix attempt, spec §27.3) ----------------------
    await setStatus(runId, "running_checks", "Running typecheck, lint, tests, and build…");
    let verification = await runChecks({
      runId,
      projectPath,
      workspaceRoot: cfg.workspaceRoot,
      checks: ctx.checkCommands,
    });

    if (!verification.allRequiredPassed) {
      await setStatus(runId, "fixing_errors", "Some checks failed — asking Codex to fix them once…");
      const failing = verification.outcomes.filter((o) => o.required && o.status !== "passed");
      await adapters.codex
        .implement({
          projectPath,
          branchName,
          finalBrief: {
            ...merge.brief,
            title: "Fix failing checks",
            finalImplementationPlan: failing.map((f) => `Fix the failing ${f.name} check (${f.command}).`),
          },
          allowedCommands: ctx.checkCommands.map((c) => c.command),
          deniedCommands: DENIED_COMMANDS,
          checkCommands: ctx.checkCommands,
        })
        .catch((e) => recordLog(runId, "error", "codex", `Fix attempt error: ${(e as Error).message}`));

      await setStatus(runId, "running_checks", "Re-running checks after fixes…");
      verification = await runChecks({
        runId,
        projectPath,
        workspaceRoot: cfg.workspaceRoot,
        checks: ctx.checkCommands,
      });
      await patchRun(runId, { diffSummary: (await git.diffStat(projectPath)).slice(0, 8_000) });
    }

    const changedFiles = await git.changedFiles(projectPath);

    if (!verification.allRequiredPassed) {
      await patchRun(runId, { errorMessage: "Required checks failed after one fix attempt." });
      await recordLog(
        runId,
        "warn",
        "system",
        buildStatusSummary({
          title: merge.brief.title,
          filesChanged: changedFiles,
          checks: verification.outcomes,
          failed: true,
        }),
      );
      await setStatus(runId, "needs_user_input", "A required check is still failing — I did not deploy.");
      return;
    }

    // 7. Commit --------------------------------------------------------------
    if (changedFiles.length > 0) {
      await setStatus(runId, "creating_commit", "Committing changes…");
      await git.addAll(projectPath);
      const sha = await git.commit(
        projectPath,
        buildCommitMessage({ changeSummary: merge.brief.title, runId }),
        cfg.git,
      );
      await patchRun(runId, { commitSha: sha });
    } else {
      await recordLog(runId, "warn", "codex", "No file changes were produced.");
    }

    // 8. Preview deploy ------------------------------------------------------
    let previewUrl: string | undefined;
    if (merge.brief.deployPlan.preview) {
      await setStatus(runId, "deploying_preview", "Deploying a preview to Vercel…");
      const dep = await deployPreview({ runId, projectPath, branchName, cfg });
      previewUrl = dep.url;
    }

    // 9. Await user review ---------------------------------------------------
    await recordLog(
      runId,
      "info",
      "system",
      buildStatusSummary({
        title: merge.brief.title,
        filesChanged: changedFiles,
        checks: verification.outcomes,
        previewUrl,
      }),
    );
    await setStatus(runId, "awaiting_user_review", "Ready for your review.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordLog(runId, "error", "system", message).catch(() => undefined);
    emitError(runId, message);
    await setStatus(runId, "failed", message).catch(async () => {
      // current state may already be terminal; force the fields directly
      await prisma.run
        .update({
          where: { id: runId },
          data: { status: "failed", errorMessage: message.slice(0, 1_000), completedAt: new Date() },
        })
        .catch(() => undefined);
    });
  }
}

export type { CheckOutcome };
