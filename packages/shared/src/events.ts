import type { RunStatus } from "./run-status.js";
import type { CheckStatus } from "./checks.js";

/** SSE run events streamed to the frontend (spec §24). */
export type RunEvent =
  | { type: "status"; status: RunStatus; message: string }
  | { type: "log"; level: string; source: string; message: string }
  | { type: "agent_output"; agent: "realtime" | "codex" | "claude"; summary: string }
  | { type: "check_result"; name: string; status: CheckStatus | string }
  | { type: "deployment"; url: string; status: string }
  | { type: "error"; message: string };

export type RunEventType = RunEvent["type"];

/** Log levels and sources used across the orchestrator (spec §12.7). */
export type LogLevel = "info" | "warn" | "error" | "debug";
export type LogSource = "system" | "realtime" | "codex" | "claude" | "git" | "vercel";
