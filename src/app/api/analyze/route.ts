import { NextResponse } from "next/server";
import { LLMError } from "@/lib/ai/client";
import type { AnalyzeRequestBody } from "@/lib/ai/types";
import { analyzeResumeServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  let body: AnalyzeRequestBody;
  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "请求内容无法解析" },
      { status: 400 }
    );
  }

  const { input, optimizeStyle = "ai-product" } = body;
  if (!input?.targetRole?.trim() || !input?.jobDescription?.trim() || !input?.originalResume?.trim()) {
    return NextResponse.json({ error: "请填写目标岗位、JD 和原始简历" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (value: string) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(value));
        } catch {
          cancelled = true;
        }
      };

      // Send whitespace heartbeats so the browser connection stays active while
      // the model completes its multi-stage analysis. JSON parsers ignore them.
      enqueue(" ");
      heartbeat = setInterval(() => enqueue(" \n"), 5_000);

      try {
        const { result, mode } = await analyzeResumeServer(input, optimizeStyle);
        enqueue(JSON.stringify({ result, mode }));
      } catch (error) {
        const message =
          error instanceof LLMError
            ? error.message
            : error instanceof Error
              ? error.message
              : "分析失败，请稍后重试";
        console.error("[analyze]", error);
        enqueue(JSON.stringify({ error: message }));
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        if (!cancelled) {
          try {
            controller.close();
          } catch {
            cancelled = true;
          }
        }
      }
    },
    cancel() {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
