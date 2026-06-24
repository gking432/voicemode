import type { CodexProvider } from "@vco/agents";

export interface OrchestratorConfig {
  workspaceRoot: string;
  redisUrl?: string;
  codex: {
    provider: CodexProvider;
    cliPath?: string;
    model?: string;
    sandboxMode: string;
  };
  claude: {
    provider: "api" | "cli";
    apiKey?: string;
    model: string;
    cliPath?: string;
  };
  openai: {
    apiKey?: string;
    realtimeModel: string;
  };
  vercel: {
    token?: string;
    teamId?: string;
    cliPath?: string;
  };
  git: {
    authorName: string;
    authorEmail: string;
  };
  safety: {
    allowProductionDeploy: boolean;
    requireConfirmationForProd: boolean;
    maxRunMinutes: number;
  };
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "true" || v === "1" || v === "yes";
}

/** Load orchestrator config from environment (spec §13). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): OrchestratorConfig {
  return {
    workspaceRoot: env.CODEX_WORKSPACE_ROOT ?? process.cwd(),
    redisUrl: env.REDIS_URL || undefined,
    codex: {
      provider: (env.CODEX_PROVIDER as CodexProvider) ?? "cli",
      cliPath: env.CODEX_CLI_PATH || undefined,
      model: env.CODEX_DEFAULT_MODEL || undefined,
      sandboxMode: env.CODEX_SANDBOX_MODE ?? "workspace-write",
    },
    claude: {
      provider: (env.CLAUDE_CODE_PROVIDER as "api" | "cli") ?? "api",
      apiKey: env.ANTHROPIC_API_KEY || undefined,
      model: env.CLAUDE_MODEL ?? "claude-opus-4-8",
      cliPath: env.CLAUDE_CODE_PATH || undefined,
    },
    openai: {
      apiKey: env.OPENAI_API_KEY || undefined,
      realtimeModel: env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-mini",
    },
    vercel: {
      token: env.VERCEL_TOKEN || undefined,
      teamId: env.VERCEL_TEAM_ID || undefined,
      cliPath: env.VERCEL_CLI_PATH || undefined,
    },
    git: {
      authorName: env.GIT_AUTHOR_NAME ?? "VoiceDev Bot",
      authorEmail: env.GIT_AUTHOR_EMAIL ?? "voicedev@example.com",
    },
    safety: {
      allowProductionDeploy: bool(env.ALLOW_PRODUCTION_DEPLOY, false),
      requireConfirmationForProd: bool(env.REQUIRE_CONFIRMATION_FOR_PROD, true),
      maxRunMinutes: Number(env.MAX_RUN_MINUTES ?? "45"),
    },
  };
}
