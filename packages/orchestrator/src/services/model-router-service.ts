import { type ResolveModelResult, resolveModel } from "@vco/shared";
import { resolvePlanForUser } from "./plan-limit-service.js";
import { recordUsage } from "./usage-ledger-service.js";

/**
 * Model-router service (spec §28.3). Resolves a requested model against the
 * user's plan, records the call for usage accounting, and surfaces a fallback
 * notice the UI can show ("Using Haiku instead of Opus on the Free plan").
 */
export async function resolveModelForUser(
  userId: string,
  requested: string,
  opts: { record?: boolean } = {},
): Promise<ResolveModelResult> {
  const plan = await resolvePlanForUser(userId);
  const result = resolveModel({ requested, plan });

  if (opts.record) {
    await recordUsage({
      userId,
      kind: "model_call",
      model: result.model,
      metadata: result.fallbackApplied
        ? { requested: result.requested, fallbackApplied: true }
        : undefined,
    });
  }
  return result;
}
