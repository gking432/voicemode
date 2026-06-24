import { loadConfig } from "@vco/orchestrator";

export const dynamic = "force-dynamic";

function present(v?: string): boolean {
  return Boolean(v && v.length > 0);
}

export default function SettingsPage() {
  const cfg = loadConfig();
  const env = process.env;

  const keys: Array<{ name: string; ok: boolean }> = [
    { name: "OPENAI_API_KEY", ok: present(env.OPENAI_API_KEY) },
    { name: "ANTHROPIC_API_KEY", ok: present(env.ANTHROPIC_API_KEY) },
    { name: "VERCEL_TOKEN", ok: present(env.VERCEL_TOKEN) },
    { name: "DATABASE_URL", ok: present(env.DATABASE_URL) },
    { name: "REDIS_URL", ok: present(env.REDIS_URL) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-slate-100">Settings</h1>

      <section className="panel">
        <div className="panel-title">Credentials (status only — values are never shown)</div>
        <ul className="space-y-1 text-sm">
          {keys.map((k) => (
            <li key={k.name} className={k.ok ? "text-emerald-300" : "text-cockpit-muted"}>
              {k.ok ? "✓ configured" : "○ missing"} <span className="font-mono text-slate-300">{k.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-title">Providers & models</div>
        <dl className="space-y-1 text-sm">
          <Row k="Realtime model" v={cfg.openai.realtimeModel} />
          <Row k="Codex provider" v={cfg.codex.provider} />
          <Row k="Codex sandbox" v={cfg.codex.sandboxMode} />
          <Row k="Claude provider" v={cfg.claude.provider} />
          <Row k="Claude model" v={cfg.claude.model} />
          <Row k="Workspace root" v={cfg.workspaceRoot} />
        </dl>
      </section>

      <section className="panel">
        <div className="panel-title">Safety</div>
        <dl className="space-y-1 text-sm">
          <Row k="Production deploy" v={cfg.safety.allowProductionDeploy ? "allowed" : "locked"} />
          <Row k="Require prod confirmation" v={String(cfg.safety.requireConfirmationForProd)} />
          <Row k="Max run minutes" v={String(cfg.safety.maxRunMinutes)} />
          <Row k="Execution mode" v={cfg.redisUrl ? "BullMQ worker" : "in-process"} />
        </dl>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-48 shrink-0 text-cockpit-muted">{k}</dt>
      <dd className="min-w-0 break-all font-mono text-xs text-slate-300">{v}</dd>
    </div>
  );
}
