import path from "node:path";
import { prisma } from "@vco/db";
import { loadConfig } from "@vco/orchestrator";
import {
  resolveProjectPath,
  PathSafetyError,
  fileExists,
  detectPackageManager,
  git,
} from "@vco/project-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const cfg = loadConfig();
  const checks: Check[] = [];

  let projectPath: string | null = null;
  try {
    projectPath = resolveProjectPath(cfg.workspaceRoot, project.localPath);
    checks.push({ name: "Path within workspace root", ok: true, detail: projectPath });
  } catch (err) {
    const detail = err instanceof PathSafetyError ? err.message : String(err);
    checks.push({ name: "Path within workspace root", ok: false, detail });
    return Response.json({ ok: false, checks });
  }

  const exists = await fileExists(projectPath);
  checks.push({ name: "Directory exists", ok: exists, detail: exists ? projectPath : "not found" });

  const isRepo = exists && (await git.hasGitDir(projectPath));
  checks.push({ name: "Git repository", ok: isRepo, detail: isRepo ? "found .git" : "no git repo" });

  const hasPkg = exists && (await fileExists(path.join(projectPath, "package.json")));
  checks.push({ name: "package.json present", ok: hasPkg, detail: hasPkg ? "found" : "missing" });

  const pm = exists ? await detectPackageManager(projectPath) : null;
  checks.push({
    name: "Package manager detected",
    ok: Boolean(pm),
    detail: pm ?? "could not detect",
  });

  const vercelReady = Boolean(project.vercelProjectId || cfg.vercel.token);
  checks.push({
    name: "Vercel configured (for deploys)",
    ok: vercelReady,
    detail: vercelReady ? "ready" : "no project id or token (preview deploys will be skipped)",
  });

  const ok = checks.filter((c) => c.name !== "Vercel configured (for deploys)").every((c) => c.ok);
  return Response.json({ ok, checks });
}
