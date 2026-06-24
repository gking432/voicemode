import { runCommand } from "./command-runner.js";
import type {
  DeploymentAdapter,
  DeployPreviewInput,
  DeployPreviewOutput,
  DeployProductionInput,
  DeployProductionOutput,
} from "@vco/shared";

export interface VercelAdapterConfig {
  cliPath?: string;
  /** Passed to the CLI via the VERCEL_TOKEN env var (never on the command line). */
  token?: string;
  teamId?: string;
  workspaceRoot?: string;
}

const URL_RE = /https?:\/\/[^\s"']+\.vercel\.app/g;

function extractDeploymentUrl(text: string): string | undefined {
  const matches = text.match(URL_RE);
  return matches?.[matches.length - 1];
}

/**
 * Deployment via the Vercel CLI (spec §16.4, §21). Preview deploys run
 * `vercel deploy --yes`; production runs `vercel deploy --prod --yes` and is
 * only ever reached after explicit user confirmation, which the caller signals
 * by this adapter passing `productionConfirmed: true` to the command runner.
 */
export class VercelCliAdapter implements DeploymentAdapter {
  private readonly cfg: VercelAdapterConfig;

  constructor(cfg: VercelAdapterConfig = {}) {
    this.cfg = cfg;
  }

  private env(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    if (this.cfg.token) env.VERCEL_TOKEN = this.cfg.token;
    return env;
  }

  private scopeFlag(): string {
    return this.cfg.teamId ? ` --scope ${this.cfg.teamId}` : "";
  }

  async deployPreview(input: DeployPreviewInput): Promise<DeployPreviewOutput> {
    const cli = this.cfg.cliPath ?? "vercel";
    const command = `${cli} deploy --yes${this.scopeFlag()}`;
    try {
      const result = await runCommand(command, {
        cwd: input.projectPath,
        workspaceRoot: this.cfg.workspaceRoot,
        env: this.env(),
      });
      const url = extractDeploymentUrl(result.stdout) ?? extractDeploymentUrl(result.stderr);
      const logs = `${result.stdout}\n${result.stderr}`.trim();
      if (result.exitCode === 0 && url) return { status: "ready", url, logs };
      return { status: "failed", url, logs };
    } catch (err) {
      return { status: "failed", logs: err instanceof Error ? err.message : String(err) };
    }
  }

  async deployProduction(input: DeployProductionInput): Promise<DeployProductionOutput> {
    const cli = this.cfg.cliPath ?? "vercel";
    const command = `${cli} deploy --prod --yes${this.scopeFlag()}`;
    try {
      const result = await runCommand(command, {
        cwd: input.projectPath,
        workspaceRoot: this.cfg.workspaceRoot,
        env: this.env(),
        productionConfirmed: true, // caller has already collected explicit confirmation
      });
      const url = extractDeploymentUrl(result.stdout) ?? extractDeploymentUrl(result.stderr);
      const logs = `${result.stdout}\n${result.stderr}`.trim();
      if (result.exitCode === 0 && url) return { status: "ready", url, logs };
      return { status: "failed", url, logs };
    } catch (err) {
      return { status: "failed", logs: err instanceof Error ? err.message : String(err) };
    }
  }
}
