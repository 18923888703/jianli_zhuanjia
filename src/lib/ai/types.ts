import type { LLMConnectionConfig } from "@/lib/ai/connection-config";

export const STYLE_LABELS = {
  concise: "更简洁",
  "reduce-exaggeration": "降低夸张",
  "ai-product": "更偏 AI 产品",
  "tob-saas": "更偏 ToB SaaS",
} as const;

export type AIMode = "mock" | "llm";

export interface AIStatus {
  mode: AIMode;
  model?: string;
  provider?: string;
  reason?: "missing_api_key" | "forced";
}

export interface AnalyzeRequestBody {
  input: import("@/types/resume").UserInput;
  optimizeStyle?: import("@/types/resume").OptimizeStyle;
  llmConfig?: LLMConnectionConfig;
}

export interface OptimizeRequestBody {
  input: import("@/types/resume").UserInput;
  style: import("@/types/resume").OptimizeStyle;
  llmConfig?: LLMConnectionConfig;
}

export interface FollowUpBulletRequestBody {
  input: import("@/types/resume").UserInput;
  question: string;
  purpose: string;
  userAnswer: string;
  llmConfig?: LLMConnectionConfig;
}

export interface FollowUpContinueRequestBody {
  input: import("@/types/resume").UserInput;
  question: string;
  purpose: string;
  messages: import("@/types/resume").FollowUpMessage[];
  llmConfig?: LLMConnectionConfig;
}

export interface APIErrorResponse {
  error: string;
}

export interface AnalyzeResponseBody {
  result: import("@/types/resume").AnalysisResult;
  mode: AIMode;
}

export interface OptimizeResponseBody {
  optimizedItems: import("@/types/resume").OptimizedItem[];
  mode: AIMode;
}

export interface FollowUpBulletResponseBody {
  bullet: string;
  mode: AIMode;
}

export interface FollowUpContinueResponseBody {
  nextQuestion: string | null;
  readyToGenerate: boolean;
  mode: AIMode;
}
