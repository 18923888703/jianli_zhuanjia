import { getAIConfig } from "@/lib/ai/config";
import type { AIMode } from "@/lib/ai/types";
import type { LLMConnectionConfig } from "@/lib/ai/connection-config";
import {
  runMockFollowUpBullet,
  runMockContinueFollowUp,
  runMockRegenerateOptimizedItems,
  runMockResumeAnalysis,
} from "@/services/ai/resumeAgent.mock";
import {
  runLLMFollowUpBullet,
  runLLMContinueFollowUp,
  runLLMRegenerateOptimizedItems,
  runLLMResumeAnalysis,
} from "@/services/ai/resumeAgent.llm";
import type { AnalysisResult, FollowUpMessage, OptimizeStyle, UserInput } from "@/types/resume";

function currentMode(config?: LLMConnectionConfig | null): AIMode {
  return getAIConfig(config).mode;
}

export async function analyzeResumeServer(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "ai-product",
  config?: LLMConnectionConfig | null
): Promise<{ result: AnalysisResult; mode: AIMode }> {
  const mode = currentMode(config);

  if (mode === "llm") {
    const result = await runLLMResumeAnalysis(input, optimizeStyle, config);
    return { result, mode };
  }

  const result = await runMockResumeAnalysis(input, optimizeStyle);
  return { result, mode };
}

export async function regenerateOptimizedItemsServer(
  input: UserInput,
  style: OptimizeStyle,
  config?: LLMConnectionConfig | null
): Promise<{ optimizedItems: AnalysisResult["optimizedItems"]; mode: AIMode }> {
  const mode = currentMode(config);

  if (mode === "llm") {
    const optimizedItems = await runLLMRegenerateOptimizedItems(input, style, config);
    return { optimizedItems, mode };
  }

  const optimizedItems = await runMockRegenerateOptimizedItems(style);
  return { optimizedItems, mode };
}

export async function generateFollowUpBulletServer(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string,
  config?: LLMConnectionConfig | null
): Promise<{ bullet: string; mode: AIMode }> {
  const mode = currentMode(config);

  if (mode === "llm") {
    const bullet = await runLLMFollowUpBullet(input, question, purpose, userAnswer, config);
    return { bullet, mode };
  }

  const bullet = await runMockFollowUpBullet(purpose, userAnswer);
  return { bullet, mode };
}

export async function continueFollowUpServer(
  input: UserInput,
  question: string,
  purpose: string,
  messages: FollowUpMessage[],
  config?: LLMConnectionConfig | null
): Promise<{ nextQuestion: string | null; readyToGenerate: boolean; mode: AIMode }> {
  const mode = currentMode(config);
  const result = mode === "llm"
    ? await runLLMContinueFollowUp(input, question, purpose, messages, config)
    : await runMockContinueFollowUp(purpose, messages);
  return { ...result, mode };
}
