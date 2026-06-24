import path from "node:path";
import fs from "node:fs";

/**
 * Path safety (spec §22.3). Project paths must live under the configured
 * workspace root; anything outside is rejected. Containment is checked
 * lexically (after resolving `.`/`..`) so it works for paths that do not exist
 * yet. When the target exists, symlinks are additionally resolved to prevent
 * a symlink inside the root from pointing outside it.
 */
export class PathSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathSafetyError";
  }
}

function hasNullByte(p: string): boolean {
  return p.includes("\0");
}

function realpathIfExists(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    // Walk up to the nearest existing ancestor and resolve that, then re-append
    // the non-existent tail. This keeps symlink resolution meaningful for paths
    // that don't fully exist yet (e.g. a branch worktree about to be created).
    const parent = path.dirname(p);
    if (parent === p) return p;
    const base = path.basename(p);
    return path.join(realpathIfExists(parent), base);
  }
}

/** Lexical containment test: is `targetPath` the root or a descendant of it? */
export function isPathWithinRoot(targetPath: string, root: string): boolean {
  if (!root || !targetPath) return false;
  if (hasNullByte(targetPath) || hasNullByte(root)) return false;

  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, targetPath);

  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel === "") return true; // target === root
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/**
 * Resolve `candidate` (absolute or relative to `root`) and guarantee it lives
 * under `root`, returning the canonical absolute path. Throws
 * {@link PathSafetyError} otherwise.
 */
export function resolveProjectPath(root: string, candidate: string): string {
  if (!root) throw new PathSafetyError("Workspace root is not configured.");
  if (!candidate) throw new PathSafetyError("Project path is empty.");
  if (hasNullByte(candidate) || hasNullByte(root)) {
    throw new PathSafetyError("Path contains a null byte.");
  }

  const resolvedRoot = realpathIfExists(path.resolve(root));
  const resolvedTarget = realpathIfExists(path.resolve(path.resolve(root), candidate));

  if (!isPathWithinRoot(resolvedTarget, resolvedRoot)) {
    throw new PathSafetyError(
      `Path "${candidate}" resolves outside the allowed workspace root "${root}".`,
    );
  }
  return resolvedTarget;
}

/** Assert `targetPath` is within `root`; throws {@link PathSafetyError}. */
export function assertPathWithinRoot(targetPath: string, root: string): void {
  if (!isPathWithinRoot(realpathIfExists(path.resolve(root, targetPath)), realpathIfExists(path.resolve(root)))) {
    throw new PathSafetyError(
      `Path "${targetPath}" is outside the allowed workspace root "${root}".`,
    );
  }
}
