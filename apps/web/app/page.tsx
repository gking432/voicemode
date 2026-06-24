import Link from "next/link";
import { prisma } from "@vco/db";
import { getCurrentUser } from "@/lib/current-user";
import { statusClasses, statusLabel, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getCurrentUser();
  const [projects, runs] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    prisma.run.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { project: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-medium text-slate-100">Projects</h1>
          <Link href="/projects/new" className="btn btn-primary">
            + New project
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="panel text-sm text-cockpit-muted">
            No projects yet. Add a local project to start a voice session.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="panel hover:border-cockpit-accent">
                <div className="font-medium text-slate-100">{p.name}</div>
                <div className="mt-1 truncate font-mono text-xs text-cockpit-muted">{p.localPath}</div>
                <div className="mt-2 text-xs text-cockpit-muted">{p.workflowMode.replace(/_/g, " ")}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-100">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="panel text-sm text-cockpit-muted">No runs yet.</p>
        ) : (
          <div className="panel overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cockpit-border text-xs uppercase tracking-wider text-cockpit-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Preview</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-cockpit-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-cockpit-muted">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">{r.project.name}</td>
                    <td className="px-4 py-3">
                      <Link href={`/runs/${r.id}`} className="text-cockpit-accent hover:underline">
                        {r.userTranscript.slice(0, 60) || "(run)"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusClasses(r.status)}`}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.previewUrl ? (
                        <a href={r.previewUrl} target="_blank" rel="noreferrer" className="text-cockpit-accent underline">
                          open
                        </a>
                      ) : (
                        <span className="text-cockpit-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
