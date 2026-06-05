// src/lib/settings.ts
// Runtime configuration for the coach: LLM provider, per-role model IDs,
// generation defaults, and the LangSmith tracing toggle. Stored as a single
// row in app_settings and edited from the /admin dashboard.
//
// Resolution order, highest priority first:
//   1. COACH_LLM_PROVIDER env var (provider only) — keeps `pnpm eval` pinned
//      to Gemini regardless of what the dashboard says.
//   2. The app_settings row.
//   3. Built-in defaults (DEFAULT_MODELS + the constants below).
//
// getSettings() is the hot path (buildChatModel calls it per model build), so
// it is cached for a few seconds. updateSettings() clears the cache, so a
// dashboard save takes effect immediately.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appSettings } from "@/db/schema";
import {
  COACH_PROVIDERS,
  DEFAULT_MODELS,
  type LlmProvider,
  type LlmRole,
} from "@/lib/llm-config";

const SETTINGS_ID = "singleton";
const CACHE_TTL_MS = 10_000;
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Which knowledge-base layer the coach retrieves from. 'public' serves only
 * open-access content, 'private' only the operator's own corpus, 'both' draws
 * on the union. Maps to app_settings.corpus_mode and the visibility_filter
 * argument of match_coach_kb(); see src/lib/pgvector.ts.
 */
export const CORPUS_MODES = ["public", "private", "both"] as const;
export type CorpusMode = (typeof CORPUS_MODES)[number];
const DEFAULT_CORPUS_MODE: CorpusMode = "both";

export interface CoachSettings {
  provider: LlmProvider;
  models: Record<LlmProvider, Record<LlmRole, string>>;
  temperature: number;
  maxTokens: number;
  tracingEnabled: boolean;
  corpusMode: CorpusMode;
}

type RawRow = typeof appSettings.$inferSelect;

const VALID_PROVIDERS: ReadonlySet<LlmProvider> = new Set(COACH_PROVIDERS);
const VALID_CORPUS_MODES: ReadonlySet<CorpusMode> = new Set(CORPUS_MODES);

/**
 * Build the per-provider model map by spreading the built-in defaults under
 * whatever the stored row has for that provider. Slots a row doesn't carry
 * fall back to DEFAULT_MODELS[provider][role].
 */
function mergedModels(
  stored: Partial<Record<LlmProvider, Partial<Record<LlmRole, string>>>>,
): Record<LlmProvider, Record<LlmRole, string>> {
  const out = {} as Record<LlmProvider, Record<LlmRole, string>>;
  for (const provider of COACH_PROVIDERS) {
    out[provider] = { ...DEFAULT_MODELS[provider], ...stored[provider] };
  }
  return out;
}

/**
 * Build the stored settings from an app_settings row (or built-in defaults
 * when the row is absent). Pure — does NOT apply the env-var override; see
 * getSettings for that.
 */
export function resolveSettings(
  row: RawRow | null,
  opts: { hasLangsmithKey?: boolean } = {},
): CoachSettings {
  const stored = (row?.models ?? {}) as Partial<
    Record<LlmProvider, Partial<Record<LlmRole, string>>>
  >;
  const storedProvider = row?.provider as LlmProvider | undefined;
  const provider =
    storedProvider && VALID_PROVIDERS.has(storedProvider)
      ? storedProvider
      : "anthropic";
  const storedCorpusMode = row?.corpusMode as CorpusMode | undefined;
  const corpusMode =
    storedCorpusMode && VALID_CORPUS_MODES.has(storedCorpusMode)
      ? storedCorpusMode
      : DEFAULT_CORPUS_MODE;
  return {
    provider,
    models: mergedModels(stored),
    temperature: row?.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: row?.maxTokens ?? DEFAULT_MAX_TOKENS,
    tracingEnabled: row ? row.tracingEnabled : Boolean(opts.hasLangsmithKey),
    corpusMode,
  };
}

/** The COACH_LLM_PROVIDER override, or null when unset/invalid. */
export function providerOverride(): LlmProvider | null {
  const value = (process.env.COACH_LLM_PROVIDER ?? "").toLowerCase();
  return VALID_PROVIDERS.has(value as LlmProvider)
    ? (value as LlmProvider)
    : null;
}

async function readRow(): Promise<RawRow | null> {
  try {
    const db = getDb();
    const found = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, SETTINGS_ID))
      .limit(1);
    return found[0] ?? null;
  } catch {
    // Table missing (pre-migration) or DB unreachable — fall back to defaults.
    return null;
  }
}

/** Settings exactly as stored — no env override. Used by the /admin form. */
export async function getStoredSettings(): Promise<CoachSettings> {
  return resolveSettings(await readRow(), {
    hasLangsmithKey: Boolean(process.env.LANGSMITH_API_KEY),
  });
}

let cache: { value: CoachSettings; at: number } | null = null;

/** Effective settings (env override applied), cached for CACHE_TTL_MS. */
export async function getSettings(): Promise<CoachSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }
  const stored = await getStoredSettings();
  const override = providerOverride();
  const value: CoachSettings = override
    ? { ...stored, provider: override }
    : stored;
  cache = { value, at: Date.now() };
  return value;
}

/** Drop the cache so the next getSettings() re-reads the database. */
export function invalidateSettingsCache(): void {
  cache = null;
}

/**
 * The active corpus mode (public / private / both). Falls back to the default
 * if settings are unreadable, so retrieval degrades to a safe, predictable
 * layer rather than throwing. Reads the same cached settings as the coach.
 */
export async function getCorpusMode(): Promise<CorpusMode> {
  try {
    return (await getSettings()).corpusMode;
  } catch {
    return DEFAULT_CORPUS_MODE;
  }
}

/** Upsert the single settings row and clear the cache. */
export async function updateSettings(
  input: CoachSettings,
): Promise<CoachSettings> {
  const db = getDb();
  const values = {
    id: SETTINGS_ID,
    provider: input.provider,
    models: input.models,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    tracingEnabled: input.tracingEnabled,
    corpusMode: input.corpusMode,
    updatedAt: new Date(),
  };
  await db
    .insert(appSettings)
    .values(values)
    .onConflictDoUpdate({ target: appSettings.id, set: values });
  invalidateSettingsCache();
  return getStoredSettings();
}
