"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORKFLOW_MODES, DEFAULT_WORKFLOW_MODE } from "@vco/shared";
import { postJson } from "@/lib/api-client";

interface FormState {
  name: string;
  localPath: string;
  defaultBranch: string;
  packageManager: string;
  buildCommand: string;
  testCommand: string;
  lintCommand: string;
  typecheckCommand: string;
  vercelProjectId: string;
  workflowMode: string;
}

const initial: FormState = {
  name: "",
  localPath: "",
  defaultBranch: "main",
  packageManager: "",
  buildCommand: "",
  testCommand: "",
  lintCommand: "",
  typecheckCommand: "",
  vercelProjectId: "",
  workflowMode: DEFAULT_WORKFLOW_MODE,
};

export function ProjectForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const project = await postJson<{ id: string }>("/api/projects", form);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Project name" required>
          <input className="input" value={form.name} onChange={set("name")} required placeholder="home-services-crm-demo" />
        </Field>
        <Field label="Local path (under workspace root)" required>
          <input className="input" value={form.localPath} onChange={set("localPath")} required placeholder="crm-demo" />
        </Field>
        <Field label="Default branch">
          <input className="input" value={form.defaultBranch} onChange={set("defaultBranch")} />
        </Field>
        <Field label="Package manager">
          <input className="input" value={form.packageManager} onChange={set("packageManager")} placeholder="pnpm / npm / yarn" />
        </Field>
        <Field label="Build command">
          <input className="input" value={form.buildCommand} onChange={set("buildCommand")} placeholder="pnpm build" />
        </Field>
        <Field label="Test command">
          <input className="input" value={form.testCommand} onChange={set("testCommand")} placeholder="pnpm test" />
        </Field>
        <Field label="Lint command">
          <input className="input" value={form.lintCommand} onChange={set("lintCommand")} placeholder="pnpm lint" />
        </Field>
        <Field label="Typecheck command">
          <input className="input" value={form.typecheckCommand} onChange={set("typecheckCommand")} placeholder="pnpm typecheck" />
        </Field>
        <Field label="Vercel project ID">
          <input className="input" value={form.vercelProjectId} onChange={set("vercelProjectId")} />
        </Field>
        <Field label="Default workflow mode">
          <select className="input" value={form.workflowMode} onChange={set("workflowMode")}>
            {WORKFLOW_MODES.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save project"}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
