import { prisma } from "@vco/db";
import {
  type PlanDefinition,
  type PlanUsageStatus,
  computePlanUsageStatus,
  getPlanDefinition,
} from "@vco/shared";
import { getMonthlyUsage } from "./usage-ledger-service.js";

/**
 * Plan-limit service (spec §28). Resolves the user's active plan (DB override
 * if present, otherwise the static definition) and reports remaining quota.
 */

export async function resolvePlanForUser(userId: string): Promise<PlanDefinition> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activePlanKey: true },
  });
  const key = user?.activePlanKey;

  // Prefer a persisted plan row so plans can be tuned without a deploy; fall
  // back to the canonical static definition.
  const persisted = key
    ? await prisma.subscriptionPlan.findUnique({ where: { key } }).catch(() => null)
    : null;

  if (persisted) {
    return {
      key: persisted.key as PlanDefinition["key"],
      displayName: persisted.displayName,
      monthlyRunLimit: persisted.monthlyRunLimit,
      monthlyReviewLimit: persisted.monthlyReviewLimit,
      allowedModels: persisted.allowedModels,
      isDefault: persisted.isDefault,
    };
  }
  return getPlanDefinition(key);
}

export async function getPlanUsageStatus(userId: string): Promise<PlanUsageStatus> {
  const [plan, usage] = await Promise.all([resolvePlanForUser(userId), getMonthlyUsage(userId)]);
  return computePlanUsageStatus(plan.key, usage);
}

export interface RunAllowance {
  allowed: boolean;
  remaining: number;
  notice?: string;
}

/** Whether the user may start another run this month. */
export async function checkRunAllowed(userId: string): Promise<RunAllowance> {
  const status = await getPlanUsageStatus(userId);
  if (status.runLimitReached) {
    return {
      allowed: false,
      remaining: 0,
      notice: `You've used all ${status.plan.monthlyRunLimit} runs on the ${status.plan.displayName} plan this month.`,
    };
  }
  return { allowed: true, remaining: status.runsRemaining };
}
