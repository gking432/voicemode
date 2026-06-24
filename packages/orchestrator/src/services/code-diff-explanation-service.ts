import path from "node:path";
import type { FinalImplementationBrief } from "@vco/shared";

/**
 * Code-diff explanation service (spec §27.4). Turns a changed file (and its
 * brief context) into a short, plain-English sentence a non-expert can follow.
 *
 * Deterministic by design — it does not call an LLM. It maps the file to the
 * most relevant line in the implementation plan and adds a friendly note about
 * what kind of file it is, so the teammate's narration stays honest and cheap.
 */

export interface FileExplanation {
  filePath: string;
  sentence: string;
  category: string;
}

const CATEGORY_BY_HINT: Array<{ test: RegExp; category: string; phrase: string }> = [
  { test: /\.test\.|\.spec\.|__tests__/, category: "tests", phrase: "added or updated tests" },
  { test: /\.(css|scss|sass|less)$|tailwind|styles?/i, category: "styling", phrase: "adjusted styling" },
  { test: /\.(tsx|jsx)$|components?\//i, category: "ui", phrase: "changed a UI component" },
  { test: /route\.|controller|\/api\//i, category: "api", phrase: "updated an API endpoint" },
  { test: /schema\.prisma$|migrations?\//i, category: "data", phrase: "changed the data model" },
  { test: /\.(json|ya?ml|toml|env)$|config/i, category: "config", phrase: "updated configuration" },
  { test: /\.(ts|js|mjs|cjs)$/, category: "logic", phrase: "changed application logic" },
];

function categorize(filePath: string): { category: string; phrase: string } {
  for (const hint of CATEGORY_BY_HINT) {
    if (hint.test.test(filePath)) return { category: hint.category, phrase: hint.phrase };
  }
  return { category: "other", phrase: "made a change" };
}

/** Find the plan/recommendation line that best matches a file by shared keywords. */
function bestPlanLineFor(filePath: string, brief: FinalImplementationBrief): string | undefined {
  const base = path.basename(filePath).toLowerCase();
  const stem = base.replace(/\.[^.]+$/, "");
  const candidates = [
    ...brief.finalImplementationPlan,
    ...brief.acceptedClaudeRecommendations,
    ...brief.requestedChanges,
  ];
  // Prefer a plan line that mentions the file name; otherwise the first plan line.
  const mentioned = candidates.find(
    (line) => stem.length > 2 && line.toLowerCase().includes(stem),
  );
  return mentioned ?? candidates[0];
}

export function explainFile(filePath: string, brief: FinalImplementationBrief): FileExplanation {
  const { category, phrase } = categorize(filePath);
  const planLine = bestPlanLineFor(filePath, brief);
  const tail = planLine ? ` to ${lowerFirst(planLine.replace(/\.$/, ""))}.` : ".";
  return {
    filePath,
    category,
    sentence: `In \`${filePath}\` I ${phrase}${tail}`,
  };
}

export function explainFiles(
  files: string[],
  brief: FinalImplementationBrief,
  limit = 3,
): FileExplanation[] {
  return files.slice(0, limit).map((f) => explainFile(f, brief));
}

function lowerFirst(s: string): string {
  return s.length ? s[0]!.toLowerCase() + s.slice(1) : s;
}
