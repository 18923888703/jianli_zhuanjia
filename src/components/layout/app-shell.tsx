"use client";

import { useEffect } from "react";
import { StepSidebar } from "@/components/layout/step-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { StepContent } from "@/components/steps/step-content";
import { useResumeStore } from "@/store/resume-store";

export function AppShell() {
  useEffect(() => {
    void useResumeStore.persist.rehydrate();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <StepSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-5xl p-6 lg:p-8">
            <StepContent />
          </div>
        </main>
      </div>
    </div>
  );
}
