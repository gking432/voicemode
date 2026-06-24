import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

/**
 * Trusted git operations performed by the orchestrator itself (spec §19).
 * These run via `git` argv directly (no shell) and are distinct from the
 * policy-gated {@link runCommand} path used for agent-proposed commands.
 */
export interface GitAuthor {
  name: string;
  email: string;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.trim();
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const out = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return out === "true";
  } catch {
    return false;
  }
}

export async function hasGitDir(projectPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectPath, ".git"));
    return true;
  } catch {
    return isGitRepo(projectPath);
  }
}

export async function currentBranch(cwd: string): Promise<string> {
  return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export async function isWorkingTreeClean(cwd: string): Promise<boolean> {
  const out = await git(cwd, ["status", "--porcelain"]);
  return out.length === 0;
}

export async function headSha(cwd: string): Promise<string> {
  return git(cwd, ["rev-parse", "HEAD"]);
}

export async function hasRemote(cwd: string, remote = "origin"): Promise<boolean> {
  try {
    const out = await git(cwd, ["remote"]);
    return out.split(/\s+/).includes(remote);
  } catch {
    return false;
  }
}

export async function fetch(cwd: string, remote = "origin", branch?: string): Promise<void> {
  const args = ["fetch", remote];
  if (branch) args.push(branch);
  await git(cwd, args);
}

export async function checkout(cwd: string, branch: string): Promise<void> {
  await git(cwd, ["checkout", branch]);
}

export async function createBranch(cwd: string, branch: string, from?: string): Promise<void> {
  const args = ["checkout", "-b", branch];
  if (from) args.push(from);
  await git(cwd, args);
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await git(cwd, ["rev-parse", "--verify", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

export async function addAll(cwd: string): Promise<void> {
  await git(cwd, ["add", "-A"]);
}

export async function commit(cwd: string, message: string, author?: GitAuthor): Promise<string> {
  const args = ["commit", "-m", message];
  if (author) {
    args.unshift("-c", `user.name=${author.name}`, "-c", `user.email=${author.email}`);
  }
  await git(cwd, args);
  return headSha(cwd);
}

/** `git restore .` — drop uncommitted changes (spec §22.4 rollback). */
export async function restoreAll(cwd: string): Promise<void> {
  await git(cwd, ["restore", "."]);
  await git(cwd, ["clean", "-fd"]).catch(() => undefined);
}

export async function revertCommit(cwd: string, sha: string): Promise<string> {
  await git(cwd, ["revert", "--no-edit", sha]);
  return headSha(cwd);
}

export async function diff(cwd: string, ref?: string): Promise<string> {
  const args = ["diff"];
  if (ref) args.push(ref);
  return git(cwd, args);
}

export async function diffStat(cwd: string, ref?: string): Promise<string> {
  const args = ["diff", "--stat"];
  if (ref) args.push(ref);
  return git(cwd, args);
}

export async function changedFiles(cwd: string, ref?: string): Promise<string[]> {
  const args = ["diff", "--name-only"];
  if (ref) args.push(ref);
  const out = await git(cwd, args);
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

export async function detectDefaultBranch(cwd: string): Promise<string> {
  // Prefer the remote HEAD, fall back to common names, then current branch.
  try {
    const out = await git(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
    const name = out.replace(/^origin\//, "");
    if (name) return name;
  } catch {
    /* ignore */
  }
  for (const candidate of ["main", "master"]) {
    if (await branchExists(cwd, candidate)) return candidate;
  }
  return currentBranch(cwd).catch(() => "main");
}
