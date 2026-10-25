import { chatCompletionJSON } from "@/lib/ai/client";
import {
  RESUME_AGENT_SYSTEM_PROMPT,
  buildAnalyzeCorePrompt,
  buildAnalyzeDiagnosisPrompt,
  buildAnalyzeInterviewPrompt,
  buildAnalyzeOutputPrompt,
  buildContinueFollowUpPrompt,
  buildFollowUpBulletPrompt,
  buildOptimizeUserPrompt,
  normalizeAnalysisResult,
  normalizeOptimizedItems,
} from "@/lib/ai/prompts";
import type { AnalysisResult, FollowUpMessage, OptimizeStyle, UserInput } from "@/types/resume";
import type { LLMConnectionConfig } from "@/lib/ai/connection-config";

type JDAnalysisResult = Pick<AnalysisResult, "jdAnalysis">;
type DiagnosisMatchResult = Pick<
  AnalysisResult,
  "diagnosis" | "matchItems" | "followUpQuestions"
>;
type OptimizeResumeResult = Pick<AnalysisResult, "optimizedItems" | "finalResume">;
type InterviewResult = Pick<AnalysisResult, "interviewPrep">;

export async function runLLMResumeAnalysis(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "ai-product",
  config?: LLMConnectionConfig | null
): Promise<AnalysisResult> {
  const [jd, diagnosisMatch, optimizeResume, interview] = await Promise.all([
    chatCompletionJSON<JDAnalysisResult>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeCorePrompt(input),
      maxTokens: 2500,
    }, config),
    chatCompletionJSON<Partial<DiagnosisMatchResult>>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeDiagnosisPrompt(input),
      maxTokens: 3000,
    }, config),
    chatCompletionJSON<OptimizeResumeResult>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeOutputPrompt(input, optimizeStyle, ""),
      maxTokens: 3500,
    }, config),
    chatCompletionJSON<InterviewResult>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeInterviewPrompt(input, ""),
      maxTokens: 2500,
    }, config),
  ]);

  const raw: AnalysisResult = {
    jdAnalysis: jd.jdAnalysis,
    diagnosis: diagnosisMatch.diagnosis ?? {
      overallScore: 0,
      dimensionScores: [],
      mainIssues: [],
      prioritySuggestions: [],
    },
    matchItems: Array.isArray(diagnosisMatch.matchItems) ? diagnosisMatch.matchItems : [],
    followUpQuestions: Array.isArray(diagnosisMatch.followUpQuestions)
      ? diagnosisMatch.followUpQuestions
      : [],
    optimizedItems: optimizeResume.optimizedItems,
    finalResume: optimizeResume.finalResume,
    interviewPrep: interview.interviewPrep,
  };

  return normalizeAnalysisResult(raw, input);
}

export async function runLLMRegenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle,
  config?: LLMConnectionConfig | null
): Promise<AnalysisResult["optimizedItems"]> {
  const raw = await chatCompletionJSON<{ optimizedItems: AnalysisResult["optimizedItems"] }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildOptimizeUserPrompt(input, style),
    temperature: 0.5,
    maxTokens: 4000,
  }, config);

  return normalizeOptimizedItems(raw.optimizedItems);
}

export async function runLLMFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string,
  config?: LLMConnectionConfig | null
): Promise<string> {
  const raw = await chatCompletionJSON<{ bullet: string }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFollowUpBulletPrompt(input, question, purpose, userAnswer),
    temperature: 0.3,
    maxTokens: 500,
  }, config);

  return raw.bullet?.trim() ?? "";
}

export async function runLLMContinueFollowUp(
  input: UserInput,
  question: string,
  purpose: string,
  messages: FollowUpMessage[],
  config?: LLMConnectionConfig | null
): Promise<{ nextQuestion: string | null; readyToGenerate: boolean }> {
  const raw = await chatCompletionJSON<{
    nextQuestion?: unknown;
    readyToGenerate?: unknown;
  }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildContinueFollowUpPrompt(input, question, purpose, messages),
    temperature: 0.3,
    maxTokens: 300,
  }, config);

  const readyToGenerate = raw.readyToGenerate === true;
  const nextQuestion = typeof raw.nextQuestion === "string" ? raw.nextQuestion.trim() : "";
  if (readyToGenerate) return { nextQuestion: null, readyToGenerate: true };
  if (!nextQuestion) throw new Error("追问服务没有返回下一条问题，请重试");
  return { nextQuestion, readyToGenerate: false };
}
