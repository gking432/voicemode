import { spawn } from "node:child_process";
import { classifyCommand, type CommandDecision } from "./command-policy.js";
import { isPathWithinRoot } from "./path-safety.js";

export interface RunResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export class CommandPolicyError extends Error {
  readonly decision: CommandDecision;
  readonly reason: string;
  readonly command: string;
  constructor(decision: CommandDecision, reason: string, command: string) {
    super(`Command refused (${decision}): ${reason}`);
    this.name = "CommandPolicyError";
    this.decision = decision;
    this.reason = reason;
    this.command = command;
  }
}

export interface RunOptions {
  cwd: string;
  /** Workspace root; cwd must live under it (spec §22.3). */
  workspaceRoot?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  /** When true, production deploy commands are permitted (spec §21.2). */
  productionConfirmed?: boolean;
  /** Cap captured stdout/stderr to avoid unbounded memory (default 1 MiB each). */
  maxBuffer?: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_BUFFER = 1024 * 1024;

/**
 * Run a shell command line, but only after it passes {@link classifyCommand}.
 * Denied or unconfirmed commands throw {@link CommandPolicyError} and never
 * reach the shell. This is the single execution path agents use for commands.
 */
export async function runCommand(commandLine: string, opts: RunOptions): Promise<RunResult> {
  const cls = classifyCommand(commandLine, {
    productionConfirmed: opts.productionConfirmed,
  });
  if (cls.decision !== "allow") {
    throw new CommandPolicyError(cls.decision, cls.reason, commandLine);
  }

  if (opts.workspaceRoot && !isPathWithinRoot(opts.cwd, opts.workspaceRoot)) {
    throw new CommandPolicyError(
      "deny",
      `Working directory "${opts.cwd}" is outside the workspace root.`,
      commandLine,
    );
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;
  const started = Date.now();

  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd: opts.cwd,
      shell: true,
      env: opts.env ?? process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const append = (buf: string, chunk: Buffer): string => {
      if (buf.length >= maxBuffer) return buf;
      return (buf + chunk.toString("utf8")).slice(0, maxBuffer);
    };

    child.stdout?.on("data", (c: Buffer) => (stdout = append(stdout, c)));
    child.stderr?.on("data", (c: Buffer) => (stderr = append(stderr, c)));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        command: commandLine,
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut,
      });
    });
  });
}
