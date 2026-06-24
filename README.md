# VoiceDev Orchestrator

> Internal codename: `voice-codex-claude-loop`

A local-first web app that lets you **speak** product/code changes into a realtime
voice assistant, turns the dictation into structured project notes, runs those
notes through **Codex** (technical analyst) and **Claude / Opus 4.8** (second-opinion
architect), has **Codex implement** the agreed solution, runs tests/lint/build,
deploys a **Vercel preview**, and returns a concise status update — then lets you
keep talking to iterate.

It is not a chatbot. It is a **voice-operated AI development cockpit**: you stay in
control of taste, direction, approval, and shipping; the agents handle translation,
planning, implementation, checking, and preview deployment.

```
User voice → OpenAI Realtime Mini → structured notes
          → Codex analysis → Claude review → merged brief
          → Codex implementation → checks → Vercel preview → you review → iterate
```

---

## Architecture

A pnpm + Turborepo monorepo. Workspace packages are consumed directly from
TypeScript source (via `transpilePackages` / path aliases), so there is no build
step between packages.

```
voice-codex-claude-loop/
  apps/
    web/                      Next.js 15 cockpit (App Router, Tailwind)
      app/                    pages + API routes (§14, §15)
      components/             VoiceConsole, RunLiveView, AgentTimeline, …
      lib/                    api-client, run-events (SSE), realtime-client (WebRTC)
  packages/
    shared/                   types, zod schemas, workflow modes, run states (§17)
    db/                       Prisma schema + client singleton (§12)
    project-adapters/         path safety, command policy, command runner, git, vercel
    agents/                   Codex / Claude / Realtime adapters + prompts (§16, §18)
    orchestrator/             run state machine, decision merge, services, queues (§8, §11, §23)
```

**The agent loop** lives in `packages/orchestrator/src/run-orchestrator.ts`. It drives
the run state machine, persists each agent's output, streams progress over SSE, and
stops at safe gates (blocking questions, failing checks, production confirmation).

---

## Setup

### Prerequisites

- Node 20+ and `pnpm` (`corepack enable` to get the pinned version)
- PostgreSQL (for Prisma)
- Redis (optional — only needed for the background worker; otherwise runs in-process)
- `codex` CLI and `claude` CLI on your PATH (or set `CODEX_PROVIDER`/`CLAUDE_CODE_PROVIDER`)
- `vercel` CLI (optional — for preview/production deploys)

### Install

```bash
pnpm install
cp .env.example .env          # then fill in the values
pnpm db:generate              # generate the Prisma client
pnpm db:push                  # create the schema in your database
```

### Validate locally

Run these in order to confirm the foundation is healthy before starting the app:

```bash
pnpm test                     # vitest — unit suites (notes, decision merge, path/command safety, state machine)
pnpm typecheck                # turbo run typecheck across all packages
pnpm build                    # turbo run build (Next.js production build + package checks)
```

> **Note:** `pnpm typecheck` / `pnpm build` for the `db`, `orchestrator`, and `web`
> packages require the generated Prisma client, so run `pnpm db:generate` first.

### Run

```bash
pnpm dev                      # Next.js dev server on http://localhost:3000
# optional, only if REDIS_URL is set:
pnpm worker                   # BullMQ worker that processes runs
```

If `REDIS_URL` is **not** set, runs execute **in-process** (fire-and-forget) inside
the Next.js server — fine for a local-first single-user setup. Set `REDIS_URL` and run
`pnpm worker` to process runs in a separate worker.

---

## Required environment variables

See [`.env.example`](./.env.example) for the full list. The essentials:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Prisma) |
| `OPENAI_API_KEY` / `OPENAI_REALTIME_MODEL` | Realtime voice intake (`gpt-realtime-mini`) |
| `ANTHROPIC_API_KEY` / `CLAUDE_MODEL` | Claude reviewer (`claude-opus-4-8`) |
| `CODEX_PROVIDER` / `CODEX_CLI_PATH` / `CODEX_SANDBOX_MODE` | Codex analyst + implementer |
| `CODEX_WORKSPACE_ROOT` | **Safety boundary** — project paths must live under this root |
| `VERCEL_TOKEN` / `VERCEL_TEAM_ID` | Preview / production deploys |
| `ALLOW_PRODUCTION_DEPLOY` / `REQUIRE_CONFIRMATION_FOR_PROD` | Production safety locks |
| `REDIS_URL` | Optional — enables the BullMQ worker path |

---

## How to add a project

1. Open the app and click **New project**.
2. Fill in the project name and **local path** (relative to `CODEX_WORKSPACE_ROOT`, or
   an absolute path *within* that root — anything outside is rejected, §22.3).
3. Optionally set build / test / lint / typecheck commands, the Vercel project id, and
   the default workflow mode.
4. Open the project and click **Run health check** to validate that the path exists,
   it's a git repo, `package.json` is present, and the package manager is detected.

## How to run a voice session

1. Open a project. The **voice console** shows the active project and workflow mode.
2. Click **🎤 Start talking** (uses OpenAI Realtime over WebRTC) or just **type** the
   instruction — both fill the same transcript box.
3. Click **Submit instruction →**. You're taken to the run page, which streams the
   live agent timeline, structured notes, Codex analysis, Claude review, the merged
   brief, check results, and the preview link.
4. When the run reaches **awaiting review**, open the preview and either **Approve**,
   send **follow-up feedback** (creates a linked iteration with prior context), or
   **promote to production** (requires typing the exact confirmation phrase).

---

## Workflow modes (§10)

```
notes_only | plan_only | implement_local
implement_and_preview_deploy   ← default
create_pr | production_deploy_requires_confirmation
```

The default is `implement_and_preview_deploy`: *"make the changes, run checks, deploy a
preview, I'll review it."*

---

## Safety rules (§20, §22)

- **Command allow/deny policy** — every agent-proposed command is classified before it
  runs. Destructive commands (`rm -rf /`, `sudo`, pipe-to-shell, force push, `*publish`,
  `dd`, `mkfs`, …) are **denied**; anything outside the allow-list **requires
  confirmation**; only the safe set (git read ops, install, checks, preview deploy) runs
  automatically. See `packages/project-adapters/src/command-policy.ts`.
- **Path safety** — project paths are confined to `CODEX_WORKSPACE_ROOT`; traversal and
  out-of-root paths are rejected (`path-safety.ts`).
- **Production deploys never happen automatically.** Promotion requires
  `ALLOW_PRODUCTION_DEPLOY=true` *and* the typed phrase `Confirm production deploy`.
- **Secrets are never rendered** — the Vercel token is passed via env, not the command
  line, and the settings screen shows credential *status* only.
- **Rollback** — `git restore` / revert helpers in `project-adapters/src/git.ts`; the
  pipeline refuses to run on a dirty working tree so it never clobbers uncommitted work.

---

## Testing

```bash
pnpm test         # vitest
```

The suite covers the §30-required areas:

- **Structured notes parsing** (`packages/shared/src/notes.test.ts`) — incl. the
  snake_case Realtime shape and camelCase canonical shape.
- **Decision merge** (`packages/orchestrator/src/decision-merge.test.ts`).
- **Project path safety** (`packages/project-adapters/src/path-safety.test.ts`).
- **Command allow/deny list** (`packages/project-adapters/src/command-policy.test.ts`).
- **Run state transitions** (`packages/orchestrator/src/run-state-machine.test.ts`).
- Plus the LLM JSON extractor (`packages/agents/src/json.test.ts`).

84 tests, all green.

---

## Known limitations (MVP)

- **Single user, one local machine, one project at a time** (§6). No auth — a default
  local user is created automatically.
- **Codex SDK provider is a stub** — use `CODEX_PROVIDER=cli` (the default). The Codex
  and Claude CLI invocations are best-effort against the documented CLIs.
- **Realtime WebRTC capture is best-effort**; the typed-instruction path is the reliable
  fallback and always works.
- **Status summaries are deterministic** (not LLM-written) for reliability; the
  `user-status-summary.md` prompt is included for a future LLM variant.
- **In-process execution** is fire-and-forget and suited to a long-lived local server;
  use Redis + `pnpm worker` for durable background processing.
- The decision-merge step is deterministic (rules in §18.4) rather than a separate LLM
  call — predictable and testable.

---

## Agent roles

| Agent | Role | Implementation |
| --- | --- | --- |
| Realtime Mini | Voice intake → structured notes | browser WebRTC + `OpenAiRealtimeAdapter` |
| Codex | Initial technical analyst | `CodexCliAdapter.analyze` (read-only) |
| Claude / Opus 4.8 | Second-opinion architect/reviewer | `AnthropicApiAdapter.review` (adaptive thinking) |
| Codex | Final implementer | `CodexCliAdapter.implement` (workspace-write) |
| Verifier | Deterministic checks + optional AI diff review | `verification-service.ts` |
| Deployment | Vercel preview / gated production | `deployment-service.ts` + `VercelCliAdapter` |

Prompts live in `packages/agents/src/prompts/*.md` (§18).
