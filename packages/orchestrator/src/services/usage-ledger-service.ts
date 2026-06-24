import { prisma } from "@vco/db";
import { type MonthlyUsage, type UsageKind, startOfCurrentMonth } from "@vco/shared";

/**
 * Usage-ledger service (spec §28). Append-only events plus a monthly rollup
 * used for plan-limit accounting.
 */

export interface RecordUsageInput {
  userId: string;
  kind: UsageKind;
  runId?: string;
  model?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export async function recordUsage(input: RecordUsageInput): Promise<void> {
  await prisma.usageLedger
    .create({
      data: {
        userId: input.userId,
        kind: input.kind,
        runId: input.runId ?? null,
        model: input.model ?? null,
        amount: input.amount ?? 1,
        metadata: (input.metadata as object) ?? undefined,
      },
    })
    .catch(() => undefined); // usage accounting must never break the pipeline
}

export async function getMonthlyUsage(
  userId: string,
  now: Date = new Date(),
): Promise<MonthlyUsage> {
  const since = startOfCurrentMonth(now);
  const rows = await prisma.usageLedger.groupBy({
    by: ["kind"],
    where: { userId, createdAt: { gte: since } },
    _sum: { amount: true },
  });

  const usage: MonthlyUsage = { runs: 0, reviews: 0, modelCalls: 0 };
  for (const row of rows) {
    const total = row._sum.amount ?? 0;
    if (row.kind === "run") usage.runs = total;
    else if (row.kind === "review") usage.reviews = total;
    else if (row.kind === "model_call") usage.modelCalls = total;
  }
  return usage;
}
