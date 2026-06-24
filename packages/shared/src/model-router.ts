import { getPlanDefinition, type PlanDefinition } from "./plan.js";

/**
 * Model router (spec §28.3). Resolves a *requested* model to one the user's
 * plan actually allows. If the requested model isn't allowed, it falls back to
 * the best allowed model and returns a human-readable notice so the UI can be
 * honest about the downgrade ("Using Haiku instead of Opus on the Free plan").
 */

export interface ResolveModelInput {
  requested: string;
  plan: PlanDefinition;
}

export interface ResolveModelResult {
  model: string;
  requested: string;
  fallbackApplied: boolean;
  notice?: string;
}

export function resolveModel(input: ResolveModelInput): ResolveModelResult {
  const { requested, plan } = input;
  const allowed = plan.allowedModels;

  if (allowed.includes(requested)) {
    return { model: requested, requested, fallbackApplied: false };
  }

  // Best allowed model is the first in the (best → fallback) ordered list.
  const fallback = allowed[0];
  if (!fallback) {
    // Pathological: a plan with no allowed models. Honor the request rather
    // than returning nothing, but flag it.
    return {
      model: requested,
      requested,
      fallbackApplied: false,
      notice: `No models are configured for the ${plan.displayName} plan.`,
    };
  }

  return {
    model: fallback,
    requested,
    fallbackApplied: true,
    notice: `${requested} isn't available on the ${plan.displayName} plan — using ${fallback} instead.`,
  };
}

/** Convenience wrapper that resolves from a plan key string. */
export function resolveModelForPlanKey(
  requested: string,
  planKey: string | null | undefined,
): ResolveModelResult {
  return resolveModel({ requested, plan: getPlanDefinition(planKey) });
}
