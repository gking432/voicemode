import type { StructuredNotes } from "@vco/shared";

function List({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-slate-300">{title}</div>
      <ul className="ml-4 list-disc text-sm text-slate-400">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function StructuredNotesPanel({ notes }: { notes: StructuredNotes | null }) {
  if (!notes) {
    return <p className="text-sm text-cockpit-muted">No structured notes yet.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">{notes.intentSummary}</p>
      <div className="flex flex-wrap gap-2 text-xs text-cockpit-muted">
        <span className="badge">{notes.workflowMode.replace(/_/g, " ")}</span>
        <span className="badge">confidence {(notes.confidence * 100).toFixed(0)}%</span>
        {notes.targetProject ? <span className="badge">{notes.targetProject}</span> : null}
      </div>
      <List title="Requested changes" items={notes.requestedChanges} />
      <List title="Design preferences" items={notes.designPreferences} />
      <List title="Business logic" items={notes.businessLogicChanges} />
      <List title="Constraints" items={notes.technicalConstraints} />
      <List title="Acceptance criteria" items={notes.acceptanceCriteria} />
      <List title="Non-goals" items={notes.explicitNonGoals} />
      <List title="Open questions" items={notes.blockingQuestions} />
    </div>
  );
}
