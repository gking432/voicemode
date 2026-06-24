import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewSession } from "@vco/orchestrator";
import { ReviewWalkthrough } from "@/components/ReviewWalkthrough";
import type { ReviewSessionDTO } from "@/lib/teammate";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getReviewSession(id);
  if (!session) notFound();

  const dto: ReviewSessionDTO = {
    id: session.id,
    runId: session.runId,
    status: session.status as ReviewSessionDTO["status"],
    headline: session.headline,
    openingLine: session.openingLine,
    summary: session.summary,
    assumptions: session.assumptions,
    previewUrl: session.previewUrl,
    diffStat: session.diffStat,
    steps: session.steps.map((s) => ({
      id: s.id,
      order: s.order,
      kind: s.kind as ReviewSessionDTO["steps"][number]["kind"],
      title: s.title,
      narration: s.narration,
      filePath: s.filePath,
      diffHunk: s.diffHunk,
      pointerSelector: s.pointerSelector,
      pointerLabel: s.pointerLabel,
    })),
    run: {
      id: session.run.id,
      projectId: session.run.projectId,
      previewUrl: session.run.previewUrl,
      diffSummary: session.run.diffSummary,
      status: session.run.status,
    },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-100">Review with your teammate</h1>
          <p className="text-sm text-cockpit-muted">{session.summary}</p>
        </div>
        <Link href={`/runs/${session.runId}`} className="btn">
          Run details →
        </Link>
      </div>
      <ReviewWalkthrough session={dto} />
    </div>
  );
}
