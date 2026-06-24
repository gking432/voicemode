/**
 * Browser-side OpenAI Realtime (WebRTC) helper (spec §9.1, §15.3). Mints a
 * peer connection using the ephemeral client secret from
 * `POST /api/realtime/session`, streams mic audio to the model, and surfaces
 * transcript text. This is best-effort; the typed-instruction path is the
 * reliable fallback in the UI.
 */
export interface RealtimeSessionHandle {
  stop: () => void;
}

export interface StartRealtimeOptions {
  clientSecret: string;
  model: string;
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (err: Error) => void;
}

export async function startRealtimeSession(
  opts: StartRealtimeOptions,
): Promise<RealtimeSessionHandle> {
  const pc = new RTCPeerConnection();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) pc.addTrack(track, stream);

  const channel = pc.createDataChannel("oai-events");
  channel.onmessage = (e: MessageEvent<string>) => {
    try {
      const evt = JSON.parse(e.data) as { type?: string; delta?: string; transcript?: string };
      if (typeof evt.type !== "string") return;
      if (evt.type.endsWith("transcription.delta") || evt.type === "response.audio_transcript.delta") {
        if (evt.delta) opts.onTranscript(evt.delta, false);
      } else if (
        evt.type.endsWith("transcription.completed") ||
        evt.type === "response.audio_transcript.done"
      ) {
        if (evt.transcript) opts.onTranscript(evt.transcript, true);
      }
    } catch {
      /* ignore */
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const res = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(opts.model)}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${opts.clientSecret}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Realtime handshake failed (${res.status}): ${text.slice(0, 200)}`);
    opts.onError?.(err);
    pc.close();
    throw err;
  }

  const answer = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  return {
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
      channel.close();
      pc.close();
    },
  };
}
