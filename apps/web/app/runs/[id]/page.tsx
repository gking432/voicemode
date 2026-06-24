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
      <RunLiveView run={view} />
    </div>
  );
}
