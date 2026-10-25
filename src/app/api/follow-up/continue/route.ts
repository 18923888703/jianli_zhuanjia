import { NextResponse } from "next/server";
import { LLMError } from "@/lib/ai/client";
import type { FollowUpContinueRequestBody } from "@/lib/ai/types";
import type { FollowUpMessage } from "@/types/resume";
import { continueFollowUpServer } from "@/services/ai/resumeAgent.server";

const MAX_MESSAGES = 5;
const MAX_MESSAGE_LENGTH = 3000;

function isValidMessages(value: unknown): value is FollowUpMessage[] {
  return Array.isArray(value)
    && value.length >= 2
    && value.length <= MAX_MESSAGES
    && value.every((message) =>
      message
      && (message.role === "assistant" || message.role === "user")
      && typeof message.content === "string"
      && message.content.trim().length > 0
      && message.content.length <= MAX_MESSAGE_LENGTH
    )
    && value[value.length - 1].role === "user";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FollowUpContinueRequestBody;
    const { input, question, purpose, messages, llmConfig } = body;

    if (!input?.targetRole?.trim() || !input?.originalResume?.trim()) {
      return NextResponse.json({ error: "请先填写目标岗位和原始简历" }, { status: 400 });
    }
    if (!question?.trim() || !purpose?.trim() || !isValidMessages(messages)) {
      return NextResponse.json({ error: "追问内容不完整，请检查回答后重试" }, { status: 400 });
    }

    const result = await continueFollowUpServer(input, question, purpose, messages, llmConfig);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof LLMError
      ? error.message
      : error instanceof Error
        ? error.message
        : "继续追问失败，请稍后重试";
    console.error("[follow-up/continue]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
