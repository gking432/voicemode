import { prisma } from "@vco/db";

/**
 * Voice Session Service (spec §8.2.1). Thin persistence helpers for voice
 * sessions and their utterances; the realtime audio stream itself runs
 * browser↔OpenAI via the ephemeral token.
 */
export async function createVoiceSession(opts: { userId: string; projectId?: string }) {
  return prisma.voiceSession.create({
    data: { userId: opts.userId, projectId: opts.projectId, status: "active" },
  });
}

export async function addUtterance(opts: {
  voiceSessionId: string;
  speaker: "user" | "assistant";
  rawText: string;
  cleanedText?: string;
}) {
  return prisma.utterance.create({
    data: {
      voiceSessionId: opts.voiceSessionId,
      speaker: opts.speaker,
      rawText: opts.rawText,
      cleanedText: opts.cleanedText,
    },
  });
}

export async function finishVoiceSession(voiceSessionId: string) {
  return prisma.voiceSession.update({
    where: { id: voiceSessionId },
    data: { status: "ended", endedAt: new Date() },
  });
}
