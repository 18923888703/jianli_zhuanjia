import type { AIMode } from "@/lib/ai/types";
import type { LLMConnectionConfig } from "@/lib/ai/connection-config";
import { normalizeLLMBaseUrl } from "@/lib/ai/connection-config";

export interface AIConfig {
  mode: AIMode;
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: LLMConnectionConfig["protocol"];
}

export function getAIConfig(override?: LLMConnectionConfig | null): AIConfig {
  const useOverride = typeof override?.apiKey === "string" && override.apiKey.trim().length > 0;
  const apiKey = (useOverride ? override?.apiKey : process.env.LLM_API_KEY)?.trim() ?? "";
  const forceMock = !useOverride && process.env.USE_MOCK_AI === "true";
  const mode: AIMode = !forceMock && apiKey ? "llm" : "mock";
  const provider = useOverride
    ? override!.protocol
    : process.env.LLM_PROVIDER?.trim() === "anthropic"
      ? "anthropic"
      : "openai-compatible";
  const baseUrl = useOverride
    ? override!.baseUrl
    : process.env.LLM_BASE_URL?.trim() || "https://api.openai.com/v1";

  return {
    mode,
    apiKey,
    baseUrl: normalizeLLMBaseUrl(provider, baseUrl),
    model: (useOverride ? override?.model : process.env.LLM_MODEL)?.trim() || "gpt-4o-mini",
    provider,
  };
}

export function getPublicAIStatus() {
  const config = getAIConfig();
  const forceMock = process.env.USE_MOCK_AI === "true";
  const missingApiKey = !config.apiKey;

  return {
    mode: config.mode,
    model: config.mode === "llm" ? config.model : undefined,
    provider: config.mode === "llm" ? config.provider : undefined,
    reason:
      config.mode === "mock"
        ? forceMock
          ? "forced"
          : missingApiKey
            ? "missing_api_key"
            : undefined
        : undefined,
  };
}
