import type {
  CodexAdapter,
  CodexAnalyzeInput,
  CodexAnalyzeOutput,
  CodexImplementInput,
  CodexImplementOutput,
} from "@vco/shared";

export interface CodexSdkAdapterConfig {
  model?: string;
}

/**
 * Placeholder for the Codex SDK provider (spec §13 CODEX_PROVIDER=sdk). The
 * Codex SDK surface is intentionally not implemented here; the CLI provider is
 * the supported default. Wire this up when adopting the SDK and update the
 * factory in `codex-adapter.ts`.
 */
export class CodexSdkAdapter implements CodexAdapter {
  constructor(_cfg: CodexSdkAdapterConfig = {}) {}

  private notImplemented(): never {
    throw new Error(
      "Codex SDK provider is not implemented in the MVP. Set CODEX_PROVIDER=cli to use the Codex CLI.",
    );
  }

  analyze(_input: CodexAnalyzeInput): Promise<CodexAnalyzeOutput> {
    return Promise.reject(this.safeError());
  }

  implement(_input: CodexImplementInput): Promise<CodexImplementOutput> {
    return Promise.reject(this.safeError());
  }

  private safeError(): Error {
    try {
      this.notImplemented();
    } catch (err) {
      return err as Error;
    }
    return new Error("unreachable");
  }
}
