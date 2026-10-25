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

type JDAnalysisResult = Pick<AnalysisResult, "jdAnalysis">;
type DiagnosisMatchResult = Pick<
  AnalysisResult,
  "diagnosis" | "matchItems" | "followUpQuestions"
>;
type OptimizeResumeResult = Pick<AnalysisResult, "optimizedItems" | "finalResume">;
type InterviewResult = Pick<AnalysisResult, "interviewPrep">;

function buildCoreSummary(parts: DiagnosisMatchResult): string {
  return [
    `匹配度：${parts.diagnosis.overallScore}/100`,
    `主要问题：${parts.diagnosis.mainIssues.slice(0, 3).join("；") || "无"}`,
    `优先建议：${parts.diagnosis.prioritySuggestions.slice(0, 3).join("；") || "无"}`,
    `关键缺口：${parts.matchItems
      .filter((item) => item.needsSupplement)
      .slice(0, 4)
      .map((item) => item.jdRequirement)
      .join("；") || "无"}`,
  ].join("\n");
}

export async function runLLMResumeAnalysis(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "ai-product"
): Promise<AnalysisResult> {
  const jd = await chatCompletionJSON<JDAnalysisResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeCorePrompt(input),
    maxTokens: 3000,
  });

  const diagnosisMatch = await chatCompletionJSON<DiagnosisMatchResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeDiagnosisPrompt(input),
    maxTokens: 4000,
  });

  const coreSummary = buildCoreSummary(diagnosisMatch);

  const [optimizeResume, interview] = await Promise.all([
    chatCompletionJSON<OptimizeResumeResult>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeOutputPrompt(input, optimizeStyle, coreSummary),
      maxTokens: 4500,
    }),
    chatCompletionJSON<InterviewResult>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeInterviewPrompt(input, coreSummary),
      maxTokens: 3500,
    }),
  ]);

  const raw: AnalysisResult = {
    jdAnalysis: jd.jdAnalysis,
    diagnosis: diagnosisMatch.diagnosis,
    matchItems: diagnosisMatch.matchItems,
    followUpQuestions: diagnosisMatch.followUpQuestions,
    optimizedItems: optimizeResume.optimizedItems,
    finalResume: optimizeResume.finalResume,
    interviewPrep: interview.interviewPrep,
  };

  return normalizeAnalysisResult(raw, input);
}

export async function runLLMRegenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle
): Promise<AnalysisResult["optimizedItems"]> {
  const raw = await chatCompletionJSON<{ optimizedItems: AnalysisResult["optimizedItems"] }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildOptimizeUserPrompt(input, style),
    temperature: 0.5,
    maxTokens: 4000,
  });

  return normalizeOptimizedItems(raw.optimizedItems);
}

export async function runLLMFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string
): Promise<string> {
  const raw = await chatCompletionJSON<{ bullet: string }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFollowUpBulletPrompt(input, question, purpose, userAnswer),
    temperature: 0.3,
    maxTokens: 500,
  });

  return raw.bullet?.trim() ?? "";
}

export async function runLLMContinueFollowUp(
  input: UserInput,
  question: string,
  purpose: string,
  messages: FollowUpMessage[]
): Promise<{ nextQuestion: string | null; readyToGenerate: boolean }> {
  const raw = await chatCompletionJSON<{
    nextQuestion?: unknown;
    readyToGenerate?: unknown;
  }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildContinueFollowUpPrompt(input, question, purpose, messages),
    temperature: 0.3,
    maxTokens: 300,
  });

  const readyToGenerate = raw.readyToGenerate === true;
  const nextQuestion = typeof raw.nextQuestion === "string" ? raw.nextQuestion.trim() : "";
  if (readyToGenerate) return { nextQuestion: null, readyToGenerate: true };
  if (!nextQuestion) throw new Error("追问服务没有返回下一条问题，请重试");
  return { nextQuestion, readyToGenerate: false };
}
