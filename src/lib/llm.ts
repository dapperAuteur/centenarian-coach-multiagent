// src/lib/llm.ts
// Provider-agnostic chat-model factory. The coach can run on Anthropic Claude
// or Google Gemini, with per-role model IDs. Which provider and models are
// active is runtime configuration (src/lib/settings.ts), editable from the
// /admin dashboard — no redeploy needed.
//
// Two roles, three slots: "supervisor" routes (accuracy matters), "composer"
// writes specialist findings (cheaper model), "synthesizer" weaves the final
// answer.

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getSettings } from "@/lib/settings";

export type LlmProvider = "anthropic" | "google";
export type LlmRole = "supervisor" | "composer" | "synthesizer";

/**
 * Built-in model matrix. The fallback when the DB has no app_settings row
 * (e.g. before the migration runs) or a model slot is left blank. The /admin
 * dashboard overrides these per provider and role.
 */
export const DEFAULT_MODELS: Record<LlmProvider, Record<LlmRole, string>> = {
  anthropic: {
    supervisor: "claude-sonnet-4-6",
    composer: "claude-haiku-4-5-20251001",
    synthesizer: "claude-sonnet-4-6",
  },
  google: {
    // gemini-2.5-pro has little/no free-tier quota (429s); flash works on the
    // free tier and routes well. Move supervisor/synthesizer to
    // "gemini-2.5-pro" once on a paid Gemini tier.
    supervisor: "gemini-2.5-flash",
    composer: "gemini-2.5-flash",
    synthesizer: "gemini-2.5-flash",
  },
};

export interface BuildChatOptions {
  role: LlmRole;
  /** Overrides the settings-level temperature default for this call. */
  temperature?: number;
  /** Overrides the settings-level max-tokens default for this call. */
  maxTokens?: number;
}

/**
 * Build the chat model for a role, using the active runtime settings (cached;
 * see getSettings). Async because settings may come from the database.
 */
export async function buildChatModel(
  options: BuildChatOptions,
): Promise<BaseChatModel> {
  const settings = await getSettings();
  const provider = settings.provider;
  const model =
    settings.models[provider]?.[options.role] ||
    DEFAULT_MODELS[provider][options.role];
  const temperature = options.temperature ?? settings.temperature;
  const maxTokens = options.maxTokens ?? settings.maxTokens;

  if (provider === "google") {
    const apiKey =
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set (required for the Google provider)",
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
  return new ChatAnthropic({
    apiKey,
    model,
    temperature,
    maxTokens,
    maxRetries: 2,
  });
}
