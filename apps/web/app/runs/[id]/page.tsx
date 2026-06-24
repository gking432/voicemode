import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@vco/db";
import { RunLiveView, type RunView } from "@/components/RunLiveView";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      project: true,
      logs: { orderBy: { createdAt: "asc" }, take: 300 },
      checks: { orderBy: { startedAt: "asc" } },
      reviewSession: { select: { id: true, status: true } },
    },
  });
  if (!run) notFound();

  const view: RunView = {
    id: run.id,
    status: run.status,
    workflowMode: run.workflowMode,
    userTranscript: run.userTranscript,
    structuredNotes: (run.structuredNotes as RunView["structuredNotes"]) ?? null,
    codexAnalysis: (run.codexAnalysis as RunView["codexAnalysis"]) ?? null,
    claudeReview: (run.claudeReview as RunView["claudeReview"]) ?? null,
    finalBrief: (run.finalBrief as RunView["finalBrief"]) ?? null,
    branchName: run.branchName,
    commitSha: run.commitSha,
    previewUrl: run.previewUrl,
    productionUrl: run.productionUrl,
    diffSummary: run.diffSummary,
    errorMessage: run.errorMessage,
    logs: run.logs.map((l) => ({ level: l.level, source: l.source, message: l.message })),
    checks: run.checks.map((c) => ({ name: c.name, status: c.status })),
  };

  return (
    <div className="space-y-4">
      <Link href={`/projects/${run.projectId}`} className="btn">
        ← {run.project.name}
      </Link>
      {run.reviewSession && run.reviewSession.status !== "dismissed" ? (
        <Link
          href={`/reviews/${run.reviewSession.id}`}
          className="flex items-center justify-between rounded-xl border border-cockpit-accent/40 bg-cockpit-accent/10 px-4 py-3"
        >
          <span className="text-sm text-slate-100">
            🤖 Your teammate is ready to walk you through this — got a minute?
          </span>
          <span className="text-sm font-medium text-cockpit-accent">Review with me →</span>
        </Link>
      ) : null}
      <RunLiveView run={view} />
    </div>
  );
}
