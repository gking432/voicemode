import { z } from "zod";

/**
 * Subscription plans (spec §28). The static definitions here are the canonical
 * source of truth; the `SubscriptionPlan` table is an optional persisted
 * override. Limits are per calendar month.
 */

export const PLAN_KEYS = ["free", "pro", "team"] as const;
export const PlanKeySchema = z.enum(PLAN_KEYS);
export type PlanKey = z.infer<typeof PlanKeySchema>;

export const DEFAULT_PLAN_KEY: PlanKey = "free";

export interface PlanDefinition {
  key: PlanKey;
  displayName: string;
  monthlyRunLimit: number;
  monthlyReviewLimit: number;
  /** Models this plan may use, best → fallback order. */
  allowedModels: string[];
  isDefault: boolean;
}

export const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    displayName: "Free",
    monthlyRunLimit: 20,
    monthlyReviewLimit: 20,
    allowedModels: ["claude-haiku-4-5", "gpt-realtime-mini"],
    isDefault: true,
  },
  pro: {
    key: "pro",
    displayName: "Pro",
    monthlyRunLimit: 300,
    monthlyReviewLimit: 300,
    allowedModels: ["claude-opus-4-8", "claude-haiku-4-5", "gpt-realtime-mini"],
    isDefault: false,
  },
  team: {
    key: "team",
    displayName: "Team",
    monthlyRunLimit: 2000,
    monthlyReviewLimit: 2000,
    allowedModels: ["claude-opus-4-8", "claude-haiku-4-5", "gpt-realtime-mini"],
    isDefault: false,
  },
};

export function getPlanDefinition(key: string | null | undefined): PlanDefinition {
  if (key && (PLAN_KEYS as readonly string[]).includes(key)) {
    return PLAN_DEFINITIONS[key as PlanKey];
  }
  return PLAN_DEFINITIONS[DEFAULT_PLAN_KEY];
}
