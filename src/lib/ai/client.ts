import { getAIConfig } from "@/lib/ai/config";
import type { LLMConnectionConfig } from "@/lib/ai/connection-config";
import { LLMError } from "@/lib/ai/errors";
import { parseJSONFromMessage } from "@/lib/ai/parse-json";

export { LLMError } from "@/lib/ai/errors";

interface ChatCompletionOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  content?: string | null;
  reasoning_content?: string | null;
}

export async function chatCompletionJSON<T>(
  options: ChatCompletionOptions,
  override?: LLMConnectionConfig | null
): Promise<T> {
  try {
    return await requestChatCompletionJSON<T>(options, override);
  } catch (error) {
    if (error instanceof LLMError) throw error;
    throw new LLMError(error instanceof Error ? error.message : "大模型请求异常");
  }
}

async function requestChatCompletionJSON<T>(
  options: ChatCompletionOptions,
  override?: LLMConnectionConfig | null
): Promise<T> {
  const config = getAIConfig(override);
  if (!config.apiKey) throw new LLMError("尚未配置大模型 API Key，请点击顶部「大模型接入」进行配置");
  if (!config.baseUrl || !/^https:\/\//i.test(config.baseUrl)) {
    throw new LLMError("Base URL 必须是有效的 HTTPS 地址");
  }
  if (!config.model) throw new LLMError("请填写模型名称");

  const data = await callChatCompletions(config, options);
  const choice = data.choices?.[0];
  const contents = extractMessageContents(choice?.message);

  try {
    return parseJSONFromMessage<T>(contents);
  } catch (parseError) {
    const raw = contents.join("\n\n");
    if (!raw) throw new LLMError("大模型返回内容为空");

    const fixed = await callChatCompletions(config, {
      ...options,
      temperature: 0,
      system: "你是 JSON 修复器。将输入修复为合法 JSON，只输出 JSON，不要任何解释。",
      user: `修复以下 JSON：\n${raw.slice(0, 14000)}`,
    });

    const fixedContents = extractMessageContents(fixed.choices?.[0]?.message);
    try {
      return parseJSONFromMessage<T>(fixedContents);
    } catch {
      if (choice?.finish_reason === "length") {
        throw new LLMError("大模型输出被截断，请缩短 JD/简历内容后重试");
      }
      throw parseError instanceof LLMError ? parseError : new LLMError("大模型返回的 JSON 无法解析");
    }
  }
}

async function callChatCompletions(
  config: ReturnType<typeof getAIConfig>,
  options: ChatCompletionOptions
) {
  const anthropic = config.provider === "anthropic";
  const response = await fetch(
    anthropic
      ? `${config.baseUrl}/v1/messages`
      : `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(anthropic
          ? {
              "x-api-key": config.apiKey,
              "anthropic-version": "2023-06-01",
            }
          : { Authorization: `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        model: config.model,
        ...(anthropic
          ? {
              max_tokens: options.maxTokens ?? 8192,
              temperature: options.temperature ?? 0.3,
              system: options.system,
              messages: [{ role: "user", content: options.user }],
            }
          : {
              temperature: options.temperature ?? 0.3,
              max_tokens: options.maxTokens ?? 8192,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: options.system },
                { role: "user", content: options.user },
              ],
            }),
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new LLMError(
      detail
        ? `大模型请求失败 (${response.status}): ${detail.slice(0, 300)}`
        : `大模型请求失败 (${response.status})`,
      response.status
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ finish_reason?: string; message?: ChatMessage }>;
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
  };
  if (anthropic) {
    return {
      choices: [{
        finish_reason: data.stop_reason,
        message: {
          content: data.content
            ?.filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join("\n") ?? "",
        },
      }],
    };
  }
  return data;
}

function extractMessageContents(message?: ChatMessage): string[] {
  const results: string[] = [];
  const content = message?.content?.trim();
  if (content) results.push(content);

  const reasoning = message?.reasoning_content?.trim();
  if (reasoning) {
    const jsonMatch = reasoning.match(/\{[\s\S]*\}/);
    if (jsonMatch?.[0]) results.push(jsonMatch[0]);
  }

  return results;
}
