import { ProjectForm } from "@/components/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-medium text-slate-100">New project</h1>
        <p className="text-sm text-cockpit-muted">
          Point VoiceDev at a local repository under your configured workspace root.
        </p>
      </div>
      <div className="panel">
        <ProjectForm />
      </div>
    </div>
  );
}
