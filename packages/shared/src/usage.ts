import { z } from "zod";
import { getPlanDefinition, type PlanDefinition } from "./plan.js";

/** Usage accounting types (spec §28). */

export const USAGE_KINDS = ["run", "review", "model_call"] as const;
export const UsageKindSchema = z.enum(USAGE_KINDS);
export type UsageKind = z.infer<typeof UsageKindSchema>;

export interface MonthlyUsage {
  runs: number;
  reviews: number;
  modelCalls: number;
}

export interface PlanUsageStatus {
  plan: PlanDefinition;
  usage: MonthlyUsage;
  runsRemaining: number;
  reviewsRemaining: number;
  /** True when the user is at or over their monthly run limit. */
  runLimitReached: boolean;
  reviewLimitReached: boolean;
}

export function computePlanUsageStatus(
  planKey: string | null | undefined,
  usage: MonthlyUsage,
): PlanUsageStatus {
  const plan = getPlanDefinition(planKey);
  const runsRemaining = Math.max(0, plan.monthlyRunLimit - usage.runs);
  const reviewsRemaining = Math.max(0, plan.monthlyReviewLimit - usage.reviews);
  return {
    plan,
    usage,
    runsRemaining,
    reviewsRemaining,
    runLimitReached: usage.runs >= plan.monthlyRunLimit,
    reviewLimitReached: usage.reviews >= plan.monthlyReviewLimit,
  };
}

/** First day of the current month (UTC) — the accounting window boundary. */
export function startOfCurrentMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
