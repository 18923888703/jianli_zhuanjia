"use client";

import { useEffect, useState } from "react";
import { FileText, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchAIStatus } from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";

export function TopNav() {
  const { aiMode, setAiMode } = useResumeStore();
  const [mockReason, setMockReason] = useState<string | null>(null);

  useEffect(() => {
    fetchAIStatus()
      .then((status) => {
        setAiMode(status.mode);
        if (status.reason === "missing_api_key") {
          setMockReason("未配置 LLM_API_KEY");
        } else if (status.reason === "forced") {
          setMockReason("已强制 Mock");
        } else {
          setMockReason(null);
        }
      })
      .catch(() => setAiMode("mock"));
  }, [setAiMode]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm shadow-blue-900/15">
          <FileText className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-slate-900">简历专家</h1>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
          JD 定制简历优化 Agent
        </span>
        {aiMode && (
          <Badge variant={aiMode === "llm" ? "success" : "secondary"} className="font-normal">
            {aiMode === "llm" ? "AI 模式" : mockReason ? `Mock · ${mockReason}` : "Mock 模式"}
          </Badge>
        )}
        <Badge variant="outline" className="hidden items-center gap-1.5 font-normal text-slate-600 sm:inline-flex">
          <HardDrive className="h-3 w-3 text-blue-600" />
          自动保存在此浏览器
        </Badge>
      </div>
      <p className="hidden text-xs text-slate-500 sm:block">
        基于目标岗位 JD · 诊断 · 匹配 · 优化 · 面试准备
      </p>
    </header>
  );
}
