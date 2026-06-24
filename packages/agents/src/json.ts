/**
 * Extract a JSON object from an LLM text response. Models often wrap JSON in
 * ```json fences or add prose around it; this pulls out the first balanced
 * object and parses it. Throws if no parseable JSON is found.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // 1. Fenced ```json … ``` (or bare ``` … ```) block.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const parsed = tryParse(fence[1].trim());
    if (parsed !== undefined) return parsed;
  }

  // 2. The whole thing is already JSON.
  const whole = tryParse(trimmed);
  if (whole !== undefined) return whole;

  // 3. First balanced { … } span.
  const span = firstBalancedObject(trimmed);
  if (span) {
    const parsed = tryParse(span);
    if (parsed !== undefined) return parsed;
  }

  throw new Error("No parseable JSON object found in model response.");
}

function tryParse(s: string): unknown | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function firstBalancedObject(s: string): string | undefined {
  const start = s.indexOf("{");
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return undefined;
}
