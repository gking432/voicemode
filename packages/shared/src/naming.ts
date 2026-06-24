/** Slug/branch/commit naming helpers (spec §19). */

export function slugify(input: string, maxLen = 40): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return slug || "change";
}

export interface BranchNameInput {
  projectSlug: string;
  requestSummary: string;
  runId: string;
  date?: Date;
}

/** `voice/{project}/{request}-{date}` e.g. `voice/crm/lead-detail-cleanup-2026-06-22`. */
export function buildBranchName({ projectSlug, requestSummary, runId, date }: BranchNameInput): string {
  const project = slugify(projectSlug, 24);
  const request = slugify(requestSummary, 32);
  const stamp = (date ?? new Date()).toISOString().slice(0, 10);
  const shortRun = runId.slice(-6);
  return `voice/${project}/${request}-${stamp}-${shortRun}`;
}

export interface CommitMessageInput {
  changeSummary: string;
  runId: string;
}

export function buildCommitMessage({ changeSummary, runId }: CommitMessageInput): string {
  const summary = changeSummary.trim().split("\n")[0]?.slice(0, 72) || "voice-guided change";
  return `VoiceDev: ${summary}\n\nSource: voice instruction\nRun ID: ${runId}`;
}
