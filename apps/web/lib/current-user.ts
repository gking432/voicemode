import "server-only";
import { prisma } from "@vco/db";

/**
 * MVP is single-user, one local machine (spec §6). We resolve (or create) a
 * default local user instead of implementing auth.
 */
export async function getCurrentUser() {
  const email = process.env.VOICEDEV_USER_EMAIL ?? "local@voicedev.dev";
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Local Builder" },
  });
}
