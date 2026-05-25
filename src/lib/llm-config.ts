// src/lib/llm-config.ts
// Pure model configuration: providers, roles, cost class, default per-role
// models. ZERO imports on purpose.
//
// lib/llm.ts (the factory) and lib/settings.ts (the DB-backed store) both
// pull in server-only deps. A "use client" component (e.g. SettingsForm)
// imports types and value-level constants from HERE so the server
// dependency chain never reaches a browser bundle.

/**
 * Display order: free providers first, then paid. Also the single source of
 * truth for the LlmProvider union — `as const` preserves the literal tuple
 * so `z.enum(COACH_PROVIDERS)` picks up the exact union.
 */
export const COACH_PROVIDERS = [
  "ollama",
  "cerebras",
  "openrouter",
  "mistral",
  "together",
  "anthropic",
  "google",
] as const;

export type LlmProvider = (typeof COACH_PROVIDERS)[number];

export type LlmRole = "supervisor" | "composer" | "synthesizer";

export const COACH_ROLES: readonly LlmRole[] = [
  "supervisor",
  "composer",
  "synthesizer",
];

export type ProviderCostClass = "free" | "paid";

/** Cost-class per provider — drives the free-vs-paid UI in /admin. */
export const PROVIDER_COST_CLASS: Record<LlmProvider, ProviderCostClass> = {
  ollama: "free",
  cerebras: "free",
  openrouter: "free",
  mistral: "free",
  together: "free",
  anthropic: "paid",
  google: "paid",
};

/** Human-readable label per provider. */
export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  ollama: "Ollama (local)",
  cerebras: "Cerebras",
  openrouter: "OpenRouter",
  mistral: "Mistral",
  together: "Together AI",
  anthropic: "Anthropic Claude",
  google: "Google Gemini",
};

/**
 * Built-in per-role model matrix. The fallback when the app_settings row has
 * no entry for a (provider, role) slot. The /admin dashboard overrides these.
 *
 * - Claude: Sonnet 4.6 supervises + synthesises (reasoning); Haiku 4.5 composes (cheaper).
 * - Gemini: pinned to 2.5 Flash for every role; 2.5 Pro has near-zero free quota.
 * - Free open-weight providers: one model per provider for all three roles by default.
 *   Operators can mix and match in /admin (e.g. supervisor on Cerebras 70B,
 *   composer on OpenRouter Qwen).
 */
export const DEFAULT_MODELS: Record<LlmProvider, Record<LlmRole, string>> = {
  anthropic: {
    supervisor: "claude-sonnet-4-6",
    composer: "claude-haiku-4-5-20251001",
    synthesizer: "claude-sonnet-4-6",
  },
  google: {
    supervisor: "gemini-2.5-flash",
    composer: "gemini-2.5-flash",
    synthesizer: "gemini-2.5-flash",
  },
  ollama: {
    supervisor: "llama3.1:8b",
    composer: "llama3.1:8b",
    synthesizer: "llama3.1:8b",
  },
  cerebras: {
    supervisor: "llama-3.3-70b",
    composer: "llama-3.3-70b",
    synthesizer: "llama-3.3-70b",
  },
  openrouter: {
    supervisor: "deepseek/deepseek-chat:free",
    composer: "deepseek/deepseek-chat:free",
    synthesizer: "deepseek/deepseek-chat:free",
  },
  mistral: {
    supervisor: "mistral-small-latest",
    composer: "mistral-small-latest",
    synthesizer: "mistral-small-latest",
  },
  together: {
    supervisor: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    composer: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    synthesizer: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  },
};
