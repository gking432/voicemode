import type {
  RealtimeVoiceAdapter,
  CreateRealtimeSessionInput,
  CreateRealtimeSessionOutput,
} from "@vco/shared";

export interface OpenAiRealtimeAdapterConfig {
  apiKey?: string;
  /** Defaults to gpt-realtime-mini (spec §13 OPENAI_REALTIME_MODEL). */
  model?: string;
  /** Ephemeral-key endpoint; override if OpenAI changes the path. */
  endpoint?: string;
}

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/realtime/client_secrets";

/**
 * Mints short-lived client secrets so the browser can open a WebRTC/WebSocket
 * Realtime session directly with OpenAI without ever seeing the API key
 * (spec §9.1, §15.3, §16.3). Handles both documented response shapes:
 * `{ value, expires_at }` and `{ client_secret: { value, expires_at } }`.
 */
export class OpenAiRealtimeAdapter implements RealtimeVoiceAdapter {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly endpoint: string;

  constructor(cfg: OpenAiRealtimeAdapterConfig = {}) {
    this.apiKey = cfg.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = cfg.model ?? process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-mini";
    this.endpoint = cfg.endpoint ?? DEFAULT_ENDPOINT;
  }

  async createSession(input: CreateRealtimeSessionInput): Promise<CreateRealtimeSessionOutput> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: this.model,
          instructions: input.systemPrompt,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI realtime session request failed (${res.status}): ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      value?: string;
      expires_at?: number | string;
      client_secret?: { value?: string; expires_at?: number | string };
    };

    const value = data.value ?? data.client_secret?.value;
    const expiresRaw = data.expires_at ?? data.client_secret?.expires_at;
    if (!value) {
      throw new Error("OpenAI realtime response did not include a client secret.");
    }

    return {
      clientSecret: value,
      model: this.model,
      expiresAt: expiresRaw !== undefined ? String(expiresRaw) : undefined,
    };
  }
}
