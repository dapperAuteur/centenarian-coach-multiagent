// src/lib/with-fallback.ts
// Build a chat model for a role, with a provider-fallback chain.
//
// When COACH_FALLBACK_PROVIDERS is set (comma-separated provider names, e.g.
// "openrouter,anthropic"), the primary model — chosen from the dashboard
// settings — is wrapped with LangChain's built-in `withFallbacks([...])`.
// If the primary throws (rate limit, 5xx, quota exhaustion), each fallback is
// tried in order. Anthropic / Google appear here as the paid emergency tier
// that catches a free-tier wall during a demo click.
//
// Evals intentionally call buildChatModel directly (no fallback) so a single
// run pins to one provider and the report records exactly which model
// produced the score.

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { buildChatModel, type BuildChatOptions } from "@/lib/llm";
import { COACH_PROVIDERS, type LlmProvider } from "@/lib/llm-config";

const VALID_PROVIDERS: ReadonlySet<LlmProvider> = new Set(COACH_PROVIDERS);

/**
 * Parse COACH_FALLBACK_PROVIDERS into a list of provider names. Unknown
 * entries are dropped (with a console.warn) so a stale env value never
 * prevents the primary call from running.
 */
export function parseFallbackProviders(
  raw: string | undefined,
): LlmProvider[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is LlmProvider => {
      if (!p) return false;
      if (!VALID_PROVIDERS.has(p as LlmProvider)) {
        console.warn(
          `[coach] COACH_FALLBACK_PROVIDERS: dropping unknown provider "${p}"`,
        );
        return false;
      }
      return true;
    });
}

/**
 * Build the model for `options.role`, wrapped with a fallback chain when
 * COACH_FALLBACK_PROVIDERS is set. The primary is whatever the dashboard /
 * env override picks; the chain is the env list in order. If no chain is
 * configured, returns the bare primary unchanged.
 */
export async function buildChatModelWithFallback(
  options: BuildChatOptions,
): Promise<BaseChatModel> {
  const primary = await buildChatModel(options);
  const chain = parseFallbackProviders(process.env.COACH_FALLBACK_PROVIDERS);
  if (chain.length === 0) return primary;

  const fallbacks = await Promise.all(
    chain.map((provider) => buildChatModel({ ...options, provider })),
  );
  return primary.withFallbacks(fallbacks) as unknown as BaseChatModel;
}
