import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@vco/db";
import { VoiceConsole } from "@/components/VoiceConsole";
import { ValidateButton } from "@/components/ValidateButton";
import { statusClasses, statusLabel, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-100">{project.name}</h1>
          <p className="font-mono text-xs text-cockpit-muted">{project.localPath}</p>
        </div>
        <Link href="/" className="btn">
          ← Dashboard
        </Link>
      </div>

      <VoiceConsole project={{ id: project.id, name: project.name, workflowMode: project.workflowMode }} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <div className="panel-title">Project health</div>
          <ValidateButton projectId={project.id} />
        </section>

        <section className="panel">
          <div className="panel-title">Configuration</div>
          <dl className="space-y-1 text-sm">
            <Row k="Default branch" v={project.defaultBranch} />
            <Row k="Package manager" v={project.packageManager ?? "auto-detect"} />
            <Row k="Build" v={project.buildCommand ?? "—"} />
            <Row k="Test" v={project.testCommand ?? "—"} />
            <Row k="Lint" v={project.lintCommand ?? "—"} />
            <Row k="Typecheck" v={project.typecheckCommand ?? "—"} />
            <Row k="Vercel project" v={project.vercelProjectId ?? "—"} />
          </dl>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-cockpit-muted">Recent runs</h2>
        {project.runs.length === 0 ? (
          <p className="panel text-sm text-cockpit-muted">No runs yet — submit an instruction above.</p>
        ) : (
          <div className="space-y-2">
            {project.runs.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="panel flex items-center justify-between hover:border-cockpit-accent"
              >
                <span className="truncate text-sm text-slate-300">{r.userTranscript.slice(0, 80) || "(run)"}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-cockpit-muted">{formatDate(r.createdAt)}</span>
                  <span className={`badge ${statusClasses(r.status)}`}>{statusLabel(r.status)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-cockpit-muted">{k}</dt>
      <dd className="min-w-0 break-all font-mono text-xs text-slate-300">{v}</dd>
    </div>
  );
}
