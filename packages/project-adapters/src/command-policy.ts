/**
 * Command policy (spec §20, §22.1). Every command an agent wants to run is
 * classified before execution:
 *
 *   - "allow"   → safe, runs automatically (git read ops, install, checks, …)
 *   - "confirm" → needs explicit human approval (production deploy, anything
 *                 outside the allow-list)
 *   - "deny"    → destructive, never run (rm -rf /, sudo, pipe-to-shell, …)
 *
 * The classifier is conservative: when in doubt it requires confirmation
 * rather than allowing, and a destructive token anywhere in a compound command
 * denies the whole line.
 */
export type CommandDecision = "allow" | "confirm" | "deny";

export interface CommandClassification {
  decision: CommandDecision;
  reason: string;
  /** Name of the rule that produced the decision. */
  rule: string;
}

interface NamedRule {
  name: string;
  pattern: RegExp;
}

/** §20.2 / §22.1 — destructive commands that are blocked by default. */
export const DENY_RULES: NamedRule[] = [
  { name: "sudo", pattern: /\bsudo\b/ },
  { name: "chmod-777", pattern: /\bchmod\b[^\n;|&]*\b777\b/ },
  { name: "dd", pattern: /\bdd\b[^\n;|&]*\b(if|of)=/ },
  { name: "mkfs", pattern: /\bmkfs(\.\w+)?\b/ },
  { name: "killall", pattern: /\bkillall\b/ },
  { name: "shutdown", pattern: /\bshutdown\b/ },
  { name: "reboot", pattern: /\breboot\b/ },
  { name: "force-push", pattern: /\bgit\s+push\b[^\n;|&]*(--force(-with-lease)?\b|\s-f\b)/ },
  { name: "npm-publish", pattern: /\b(npm|pnpm|yarn)\s+publish\b/ },
];

/** §20.3 / §21.2 — production deploy commands require explicit confirmation. */
export const PRODUCTION_RULES: NamedRule[] = [
  { name: "vercel-prod", pattern: /\bvercel\b[^\n;|&]*--prod\b/ },
  { name: "vercel-promote", pattern: /\bvercel\s+promote\b/ },
];

/** §20.1 — safe commands that run automatically. */
export const ALLOW_RULES: NamedRule[] = [
  {
    name: "git-readonly",
    pattern:
      /^git\s+(status|checkout|switch|branch|diff|add|commit|log|restore|stash|fetch|pull|rev-parse|show|merge-base|config)\b/,
  },
  { name: "pkg-install", pattern: /^(npm|pnpm|yarn)\s+(install|i|ci)\b/ },
  {
    name: "pkg-run-script",
    pattern: /^(npm|pnpm|yarn)\s+(run\s+)?(lint|typecheck|type-check|test|build)\b/,
  },
  { name: "npm-test", pattern: /^(npm|pnpm|yarn)\s+test\b/ },
  { name: "check-bins", pattern: /^(tsc|eslint|vitest|jest|prettier|next\s+(lint|build))\b/ },
  // Preview deploy only — `--prod` is caught earlier by PRODUCTION_RULES.
  { name: "vercel-deploy", pattern: /^vercel(\s+deploy)?\b/ },
];

function normalize(commandLine: string): string {
  return commandLine.replace(/\s+/g, " ").trim();
}

/** `... | sh`, `curl … | bash`, etc. */
function pipesToShell(cmd: string): boolean {
  return (
    /\|\s*(sudo\s+)?(sh|bash|zsh|dash|ksh)\b/.test(cmd) ||
    /\b(curl|wget|fetch)\b[^|]*\|\s*\w*sh\b/.test(cmd)
  );
}

/** Recursive+force rm aimed at a root-ish target. */
function isDangerousRm(cmd: string): boolean {
  const segments = cmd.match(/\brm\b[^\n;|&]*/g);
  if (!segments) return false;
  for (const seg of segments) {
    const hasRecursive = /\s-\w*r/i.test(seg) || /--recursive\b/.test(seg);
    const hasForce = /\s-\w*f/i.test(seg) || /--force\b/.test(seg);
    if (!hasRecursive || !hasForce) continue;
    // Targets root, home, current/parent dir, or a top-level wildcard.
    if (/\s(\/|\/\*|~|\*|\.|\.\.)(\s|$)/.test(seg)) return true;
  }
  return false;
}

/** Split a compound command into individually-classifiable segments. */
function splitSegments(cmd: string): string[] {
  return cmd
    .split(/&&|\|\||;|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchRule(rules: NamedRule[], text: string): NamedRule | undefined {
  return rules.find((r) => r.pattern.test(text));
}

export interface ClassifyOptions {
  /** When true, production deploy commands are allowed instead of requiring confirmation. */
  productionConfirmed?: boolean;
}

export function classifyCommand(
  commandLine: string,
  opts: ClassifyOptions = {},
): CommandClassification {
  const cmd = normalize(commandLine);
  if (!cmd) {
    return { decision: "deny", reason: "Empty command.", rule: "empty" };
  }

  // 1. Whole-line destructive detectors take absolute priority.
  if (pipesToShell(cmd)) {
    return {
      decision: "deny",
      reason: "Piping a download into a shell interpreter is not allowed.",
      rule: "pipe-to-shell",
    };
  }
  if (isDangerousRm(cmd)) {
    return {
      decision: "deny",
      reason: "Recursive force-remove of a root-level target is not allowed.",
      rule: "dangerous-rm",
    };
  }
  const denyHit = matchRule(DENY_RULES, cmd);
  if (denyHit) {
    return {
      decision: "deny",
      reason: `Command matches a denied pattern (${denyHit.name}).`,
      rule: denyHit.name,
    };
  }

  // 2. Production deploy → confirm (or allow if the user already confirmed).
  const prodHit = matchRule(PRODUCTION_RULES, cmd);
  const needsProdConfirm = Boolean(prodHit);

  // 3. Every segment must be on the allow-list, otherwise it is "outside the
  //    allow-list" and requires human approval (§22.1).
  const segments = splitSegments(cmd);
  for (const seg of segments) {
    const allowed = matchRule(ALLOW_RULES, seg);
    const isProdSeg = matchRule(PRODUCTION_RULES, seg);
    if (!allowed && !isProdSeg) {
      return {
        decision: "confirm",
        reason: `Command segment "${seg}" is outside the allow-list and needs approval.`,
        rule: "outside-allowlist",
      };
    }
  }

  if (needsProdConfirm) {
    if (opts.productionConfirmed) {
      return {
        decision: "allow",
        reason: "Production deploy explicitly confirmed by user.",
        rule: prodHit!.name,
      };
    }
    return {
      decision: "confirm",
      reason: "Production deploy requires explicit user confirmation.",
      rule: prodHit!.name,
    };
  }

  return { decision: "allow", reason: "Command is on the allow-list.", rule: "allow-list" };
}

export function isAllowed(commandLine: string, opts?: ClassifyOptions): boolean {
  return classifyCommand(commandLine, opts).decision === "allow";
}

export function isDenied(commandLine: string): boolean {
  return classifyCommand(commandLine).decision === "deny";
}
