export type LLMProtocol = "openai-compatible" | "anthropic";

export interface LLMConnectionConfig {
  protocol: LLMProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "resume-expert-llm-config-v1";

export function getSavedLLMConfig(): LLMConnectionConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LLMConnectionConfig>;
    if (
      (value.protocol !== "openai-compatible" && value.protocol !== "anthropic") ||
      typeof value.baseUrl !== "string" ||
      typeof value.apiKey !== "string" ||
      typeof value.model !== "string"
    ) return null;
    return value as LLMConnectionConfig;
  } catch {
    return null;
  }
}

export function saveLLMConfig(config: LLMConnectionConfig): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearLLMConfig(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function normalizeLLMBaseUrl(protocol: LLMProtocol, value: string): string {
  let baseUrl = value.trim().replace(/\/+$/, "");
  if (protocol === "openai-compatible") {
    baseUrl = baseUrl.replace(/\/chat\/completions$/i, "");
  } else {
    baseUrl = baseUrl.replace(/\/v1\/messages$/i, "");
  }
  return baseUrl;
}
