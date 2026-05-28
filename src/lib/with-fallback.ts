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
import type { Runnable } from "@langchain/core/runnables";
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
 * Build a runnable for `options.role`, wrapped with a fallback chain when
 * COACH_FALLBACK_PROVIDERS is set, using the per-model `build` adapter.
 *
 * `build` is applied to EACH provider's chat model BEFORE the fallbacks are
 * composed. This ordering matters for structured output: `withFallbacks()`
 * returns a RunnableWithFallbacks, which does NOT have `.withStructuredOutput`
 * — so calling `(await buildChatModelWithFallback()).withStructuredOutput()`
 * crashed at runtime ("withStructuredOutput is not a function") whenever a
 * fallback chain was configured. Composing structured-output-first fixes it
 * and means a fallback provider also returns structured output.
 *
 * The primary is whatever the dashboard / env override picks; the chain is
 * the COACH_FALLBACK_PROVIDERS list in order. With no chain configured, the
 * bare adapted primary is returned unchanged.
 */
export async function withRoleFallback<R extends Runnable>(
  options: BuildChatOptions,
  build: (model: BaseChatModel) => R,
): Promise<R> {
  const primary = build(await buildChatModel(options));
  const chain = parseFallbackProviders(process.env.COACH_FALLBACK_PROVIDERS);
  if (chain.length === 0) return primary;

  const fallbacks = await Promise.all(
    chain.map(async (provider) =>
      build(await buildChatModel({ ...options, provider })),
    ),
  );
  return primary.withFallbacks(fallbacks) as unknown as R;
}
