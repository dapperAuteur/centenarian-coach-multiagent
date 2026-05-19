// src/lib/llm.ts
// Claude chat-model factory. The supervisor + synthesizer use Sonnet 4.6;
// specialist composers use the cheaper Haiku 4.5.

import { ChatAnthropic } from "@langchain/anthropic";

export const SUPERVISOR_MODEL = "claude-sonnet-4-6";
export const COMPOSER_MODEL = "claude-haiku-4-5-20251001";

export interface BuildChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function buildChatAnthropic(options: BuildChatOptions): ChatAnthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new ChatAnthropic({
    apiKey,
    model: options.model,
    temperature: options.temperature ?? 0,
    maxTokens: options.maxTokens ?? 1024,
  });
}
