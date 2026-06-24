import { z } from "zod";

/** Check command descriptor (spec §17). */
export const CheckCommandSchema = z.object({
  name: z.enum(["lint", "typecheck", "test", "build"]),
  command: z.string(),
  required: z.boolean(),
});

export type CheckCommand = z.infer<typeof CheckCommandSchema>;

export type CheckStatus = "passed" | "failed" | "skipped";
