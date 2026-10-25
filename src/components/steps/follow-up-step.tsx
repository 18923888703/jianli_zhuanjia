"use client";

import { useState } from "react";
import { ChevronRight, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { continueFollowUp, generateFollowUpBullet } from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";

export function FollowUpStep() {
  const {
    analysisResult,
    userInput,
    updateFollowUpAnswer,
    completeFollowUpTurn,
    setFollowUpBullet,
    setCurrentStep,
  } = useResumeStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const { followUpQuestions } = analysisResult;

  const handleGenerateBullet = async (id: string) => {
    const question = followUpQuestions.find((q) => q.id === id);
    if (!question) return;
    const answers = (question.conversation ?? [])
      .filter((message) => message.role === "user")
      .map((message) => message.content);
    if (question.userAnswer.trim()) answers.push(question.userAnswer.trim());
    const userAnswer = answers.join("；");
    if (!userAnswer) return;

    setLoadingId(id);
    setError(null);
    try {
      const bullet = await generateFollowUpBullet(
        userInput,
        question.question,
        question.purpose,
        userAnswer
      );
      setFollowUpBullet(id, bullet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bullet 生成失败");
    } finally {
      setLoadingId(null);
    }
  };

  const handleContinue = async (id: string) => {
    const question = followUpQuestions.find((q) => q.id === id);
    if (!question?.userAnswer.trim() || question.followUpComplete) return;

    const messages = question.conversation?.length
      ? [...question.conversation]
      : [{ role: "assistant" as const, content: question.question }];
    messages.push({ role: "user", content: question.userAnswer.trim() });

    setContinuingId(id);
    setError(null);
    try {
      const result = await continueFollowUp(
        userInput,
        question.question,
        question.purpose,
        messages
      );
      completeFollowUpTurn(
        id,
        question.userAnswer.trim(),
        result.nextQuestion,
        result.readyToGenerate
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "继续追问失败");
    } finally {
      setContinuingId(null);
    }
  };

  return (
    <div>
      <SectionTitle
        title="经历追问"
        description="逐轮补充经历细节、方法和结果；信息补齐后生成简历 bullet"
      />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 space-y-4">
        {followUpQuestions.map((q, index) => (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400">
                      追问 {index + 1}
                    </span>
                    <Badge variant="outline" className="font-normal">
                      {q.purpose}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">{q.question}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-500">对话记录</p>
                <div className="space-y-2">
                  {(q.conversation?.length
                    ? q.conversation
                    : [{ role: "assistant" as const, content: q.question }]
                  ).map((message, messageIndex) => (
                    <div
                      key={`${message.role}-${messageIndex}`}
                      className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        message.role === "assistant"
                          ? "bg-white text-slate-700 shadow-sm"
                          : "ml-auto bg-blue-100 text-blue-900"
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
                {q.followUpComplete && (
                  <p className="mt-3 text-xs font-medium text-emerald-700">
                    信息已补齐，可以生成简历 bullet
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`answer-${q.id}`}>你的回答</Label>
                <Textarea
                  id={`answer-${q.id}`}
                  className="min-h-[80px] text-sm"
                  disabled={q.followUpComplete}
                  placeholder={q.followUpComplete ? "追问已完成" : "回答当前问题，补充具体经历、方法或数据..."}
                  value={q.userAnswer}
                  onChange={(e) => updateFollowUpAnswer(q.id, e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!q.userAnswer.trim() || q.followUpComplete || continuingId === q.id}
                onClick={() => handleContinue(q.id)}
              >
                {continuingId === q.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在追问...
                  </>
                ) : (
                  <>
                    <MessageSquareText className="h-3.5 w-3.5" />
                    提交并继续追问
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  (!(q.conversation ?? []).some((message) => message.role === "user")
                    && !q.userAnswer.trim())
                  || loadingId === q.id
                }
                onClick={() => handleGenerateBullet(q.id)}
              >
                {loadingId === q.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    生成简历 bullet
                  </>
                )}
              </Button>
              {q.generatedBullet && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="mb-1 text-xs font-medium text-emerald-700">生成的 bullet</p>
                  <p className="text-sm leading-relaxed text-neutral-700">{q.generatedBullet}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep("optimize")}>
          下一步：简历优化
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
