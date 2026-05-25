// src/lib/llm.ts
// Provider-agnostic chat-model factory. The coach runs on seven providers:
// five free (Ollama local + Cerebras / OpenRouter / Mistral / Together hosted
// free tiers) plus Anthropic and Google as paid options. Which provider and
// which model each role uses is runtime configuration (src/lib/settings.ts),
// editable from the /admin dashboard — no redeploy needed.
//
// Three roles, three slots: "supervisor" routes (accuracy matters), "composer"
// writes specialist findings (cheaper model), "synthesizer" weaves the final
// answer.

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getSettings } from "@/lib/settings";
import {
  DEFAULT_MODELS,
  type LlmProvider,
  type LlmRole,
} from "@/lib/llm-config";

// Re-export the pure config so consumers can keep importing from "@/lib/llm".
export {
  COACH_PROVIDERS,
  COACH_ROLES,
  DEFAULT_MODELS,
  PROVIDER_COST_CLASS,
  PROVIDER_LABELS,
} from "@/lib/llm-config";
export type {
  LlmProvider,
  LlmRole,
  ProviderCostClass,
} from "@/lib/llm-config";

/** OpenAI-compatible endpoints, per provider. */
const OPENAI_COMPATIBLE_BASE_URLS: Record<
  "cerebras" | "openrouter" | "together",
  string
> = {
  cerebras: "https://api.cerebras.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  together: "https://api.together.xyz/v1",
};

/** Env var -> API key, per hosted provider. */
function requireApiKey(envKey: string): string {
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `${envKey} is not set (required for the active LLM provider).`,
    );
  }
  return value;
}

export interface BuildChatOptions {
  role: LlmRole;
  /**
   * Override the settings-stored provider for this call. Used by the fallback
   * chain to build models for specific providers regardless of stored
   * settings. When passed, the model id falls back to
   * `DEFAULT_MODELS[provider][role]` unless the stored settings happen to
   * have a slot for that provider.
   */
  provider?: LlmProvider;
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
  const provider = options.provider ?? settings.provider;
  const model =
    settings.models[provider]?.[options.role] ||
    DEFAULT_MODELS[provider][options.role];
  const temperature = options.temperature ?? settings.temperature;
  const maxTokens = options.maxTokens ?? settings.maxTokens;

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        apiKey: requireApiKey("ANTHROPIC_API_KEY"),
        model,
        temperature,
        maxTokens,
        maxRetries: 2,
      });

    case "google": {
      // Accept any of three common spellings (the existing code did this).
      const apiKey =
        process.env.GEMINI_API_KEY ??
        process.env.GOOGLE_GEMINI_API_KEY ??
        process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not set (required for the Google provider).",
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

    case "ollama":
      return new ChatOllama({
        model,
        temperature,
        numPredict: maxTokens,
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      });

    case "mistral":
      return new ChatMistralAI({
        apiKey: requireApiKey("MISTRAL_API_KEY"),
        model,
        temperature,
        maxTokens,
        maxRetries: 2,
      });

    case "cerebras":
    case "openrouter":
    case "together":
      return new ChatOpenAI({
        apiKey: requireApiKey(
          provider === "cerebras"
            ? "CEREBRAS_API_KEY"
            : provider === "openrouter"
              ? "OPENROUTER_API_KEY"
              : "TOGETHER_API_KEY",
        ),
        model,
        temperature,
        maxTokens,
        maxRetries: 2,
        configuration: { baseURL: OPENAI_COMPATIBLE_BASE_URLS[provider] },
      });

    default: {
      // Compile-fail if a new provider is added to the union without a case.
      const _exhaustive: never = provider;
      throw new Error(`Unhandled provider: ${String(_exhaustive)}`);
    }
  }
}
