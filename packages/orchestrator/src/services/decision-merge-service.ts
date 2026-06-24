import { prisma } from "@vco/db";
import { Prisma } from "@vco/db";
import { mergeDecision, type MergeInput, type MergeResult } from "../decision-merge.js";

/**
 * Decision Merger Service (spec §8.2.6). Runs the deterministic merge and
 * persists the resulting brief on the run.
 */
export async function buildAndStoreFinalBrief(runId: string, input: MergeInput): Promise<MergeResult> {
  const result = mergeDecision(input);
  await prisma.run.update({
    where: { id: runId },
    data: { finalBrief: result.brief as unknown as Prisma.InputJsonValue },
  });
  return result;
}
