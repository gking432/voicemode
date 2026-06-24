import { spawn } from "node:child_process";

export interface CliRunOptions {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Run a trusted agent CLI (codex / claude) directly via argv — these are
 * orchestrator-owned tools, not agent-proposed commands, so they bypass the
 * command policy. Prompt text is delivered on stdin to avoid argv limits.
 */
export async function runCli(
  command: string,
  args: string[],
  opts: CliRunOptions = {},
): Promise<CliResult> {
  return await new Promise<CliResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout?.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr?.on("data", (c: Buffer) => (stderr += c.toString("utf8")));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });

    if (opts.input !== undefined) {
      child.stdin?.write(opts.input);
    }
    child.stdin?.end();
  });
}
