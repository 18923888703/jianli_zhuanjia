"use client";

import {
  Brain,
  Check,
  Circle,
  ClipboardList,
  Download,
  FileSearch,
  FileText,
  GitCompare,
  MessageSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/resume-store";
import type { StepId } from "@/types/resume";

const STEPS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: "input", label: "输入材料", icon: FileText },
  { id: "jd-analysis", label: "JD 解析", icon: FileSearch },
  { id: "diagnosis", label: "简历诊断", icon: Target },
  { id: "match", label: "匹配分析", icon: GitCompare },
  { id: "follow-up", label: "经历追问", icon: MessageSquare },
  { id: "optimize", label: "简历优化", icon: Sparkles },
  { id: "final-resume", label: "最终简历", icon: ClipboardList },
  { id: "interview", label: "面试准备", icon: Brain },
  { id: "export", label: "导出结果", icon: Download },
];

export function StepSidebar() {
  const { setCurrentStep, getStepStatus, analysisResult } = useResumeStore();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-[#f3f6fc]">
      <div className="border-b border-border px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">分析流程</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          const isDisabled = status === "disabled";

          return (
            <button
              key={step.id}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) setCurrentStep(step.id);
              }}
              className={cn(
                "mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                status === "active" && "bg-blue-100/80 font-semibold text-blue-800 shadow-sm shadow-blue-900/5",
                status === "completed" && "text-slate-700 hover:bg-white/80",
                status === "pending" && "text-slate-500 hover:bg-white/70",
                status === "disabled" && "cursor-not-allowed text-neutral-300"
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {status === "completed" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : status === "active" ? (
                  <Icon className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span className="flex-1 truncate">{step.label}</span>
              <span className="text-[10px] tabular-nums text-slate-400">{index + 1}</span>
            </button>
          );
        })}
      </nav>
      {analysisResult && (
        <div className="border-t border-border bg-white/60 p-4">
          <p className="text-xs font-medium text-slate-500">整体匹配度</p>
          <p className="text-2xl font-semibold tabular-nums text-blue-700">
            {analysisResult.diagnosis.overallScore}
            <span className="text-sm font-normal text-neutral-400">/100</span>
          </p>
        </div>
      )}
    </aside>
  );
}
