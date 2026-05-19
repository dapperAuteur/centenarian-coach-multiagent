// src/lib/llm.ts
// Provider-agnostic chat-model factory. The coach can run on Anthropic Claude
// or Google Gemini, selected at runtime by the COACH_LLM_PROVIDER env var
// (default: anthropic). This lets us A/B the answer quality of each provider.
//
// Two roles: "supervisor" uses the stronger model (routing accuracy matters);
// "composer" uses the cheaper model for specialist answer composition.

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type LlmProvider = "anthropic" | "google";
export type LlmRole = "supervisor" | "composer";

const MODELS: Record<LlmProvider, Record<LlmRole, string>> = {
  anthropic: {
    supervisor: "claude-sonnet-4-6",
    composer: "claude-haiku-4-5-20251001",
  },
  google: {
    // gemini-2.5-pro has little/no free-tier quota (429s); flash works on the
    // free tier and routes well. Move supervisor to "gemini-2.5-pro" once on a
    // paid Gemini tier.
    supervisor: "gemini-2.5-flash",
    composer: "gemini-2.5-flash",
  },
};

/** Active provider, from COACH_LLM_PROVIDER (default: anthropic). */
export function getLlmProvider(): LlmProvider {
  return (process.env.COACH_LLM_PROVIDER ?? "").toLowerCase() === "google"
    ? "google"
    : "anthropic";
}

export interface BuildChatOptions {
  role: LlmRole;
  temperature?: number;
  maxTokens?: number;
}

/** Build the chat model for a role, using the active provider. */
export function buildChatModel(options: BuildChatOptions): BaseChatModel {
  const provider = getLlmProvider();
  const model = MODELS[provider][options.role];
  const temperature = options.temperature ?? 0;
  const maxTokens = options.maxTokens ?? 1024;

  if (provider === "google") {
    const apiKey =
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set (required for COACH_LLM_PROVIDER=google)",
      );
    }
    return new ChatGoogleGenerativeAI({
      apiKey,
      model,
      temperature,
      maxOutputTokens: maxTokens,
      maxRetries: 2,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new ChatAnthropic({ apiKey, model, temperature, maxTokens, maxRetries: 2 });
}
