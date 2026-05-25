# Migration notes — `feat/llm-provider-swap` (coach)

**Goal:** add five free LLM providers (Ollama local + four hosted free tiers)
to the coach's chat-model factory so dev loops and the deployed instance can
run at $0 in the normal case, while Anthropic and Google stay selectable as
paid options for quality or emergency use. Mirrors the swap that landed in
`witus-triage-agent` on `feat/llm-provider-swap`.

## Files changed

### Factory + dispatch
- `src/lib/llm-config.ts` *(new, zero imports)* — `COACH_PROVIDERS` is now a
  `const` tuple sourced from a single seven-member list; `LlmProvider` is
  derived from it. Adds `PROVIDER_COST_CLASS`, `PROVIDER_LABELS`, `COACH_ROLES`,
  and the seven-row `DEFAULT_MODELS` matrix. Zero imports on purpose so the
  client SettingsForm can import value-level constants without dragging
  server-only deps into the browser bundle.
- `src/lib/llm.ts` — rewritten with an exhaustive `switch (provider)` ending
  in `const _exhaustive: never`. New cases: `ollama` (ChatOllama), `mistral`
  (ChatMistralAI), and `cerebras` / `openrouter` / `together` (ChatOpenAI with
  `configuration.baseURL`). `BuildChatOptions` gains an optional `provider`
  override the fallback chain uses to build models for specific providers
  regardless of stored settings. Re-exports everything from `llm-config` so
  existing imports `from "@/lib/llm"` keep working.
- `src/lib/with-fallback.ts` *(new)* — `parseFallbackProviders()` (parses
  `COACH_FALLBACK_PROVIDERS`, drops unknowns, lowercases) and
  `buildChatModelWithFallback({ role, ... })` which wraps the primary chat
  model with LangChain's `withFallbacks([...])` when the env var is set.

### Call sites (8 total, all moved to the fallback variant)
- `src/agents/supervisor/supervisor.node.ts`
- `src/agents/nutrition/subgraph.ts` × 2 (assess + compose)
- `src/agents/workout/subgraph.ts` × 2
- `src/agents/recovery/subgraph.ts` × 2
- `src/synthesizer/synthesize.ts`

The 20-question eval (`tests/coach.eval.test.ts`) still routes through these
nodes; pinning a single provider is the env override's job.

### Settings + persistence
- `src/lib/settings.ts` — `resolveSettings` now spreads `DEFAULT_MODELS` for
  **every** provider via a new `mergedModels()` helper; `providerOverride()`
  accepts all seven providers. No DB migration needed — `app_settings.models`
  is `jsonb` and new provider keys are added lazily on save.
- `src/app/api/admin/settings/route.ts` — Zod schema for PUT body now derives
  from `COACH_PROVIDERS` so adding a provider propagates.

### Dashboard UI
- `src/app/admin/page.tsx` — server component now computes
  `providerKeyPresent: Record<LlmProvider, boolean>` from env (Ollama is
  always true; others check the matching `*_API_KEY`) and passes it to the
  form. No secret values leak — just true/false flags.
- `src/app/admin/SettingsForm.tsx` — provider radio replaced with a grouped
  `<select>` (Free / Paid `<optgroup>`s); each option's label includes the
  cost class and a "no API key set" suffix when applicable. A persistent
  banner above the form is amber when a paid provider is active, green
  otherwise. The per-role `MODEL_OPTIONS` map extended to all seven providers.

### Config + docs
- `.env.example` — Free-vs-paid block; all five new key slots documented with
  signup URLs; `COACH_FALLBACK_PROVIDERS` documented with the recommended
  deployed value (`openrouter,anthropic`).
- `plans/user-tasks/10-provision-free-provider-keys.md` — new operator task
  for BAM: sign up, paste keys into `.env.local` + Vercel env, trigger deploy.

### Tests
- `tests/llm.test.ts` *(new)* — 13 cases covering per-provider dispatch,
  missing-key throws, per-call provider override, the `COACH_ROLES`
  invariant, and `parseFallbackProviders` parsing.

### Dependencies
- Added: `@langchain/ollama`, `@langchain/openai`, `@langchain/mistralai`.
- Kept: `@langchain/anthropic`, `@langchain/google-genai`. Selectable in
  `/admin` as the paid options and available as emergency fallbacks.
- Embeddings still always use Gemini (`gemini-embedding-001` @ 768 dims);
  the chat-model provider does not affect retrieval.

## Per-provider eval re-runs

**Not yet executed.** The eval requires either Ollama running locally or a
key for one of the new hosted providers; neither is configured here. Once
task 10 lands, run:

```bash
COACH_LLM_PROVIDER=ollama       pnpm eval     # local, no keys needed
COACH_LLM_PROVIDER=cerebras     pnpm eval     # ~20 calls × 2 evaluators
COACH_LLM_PROVIDER=openrouter   pnpm eval     # for fallback comparison
```

The PRD bar is **routing accuracy ≥ 80%** and **citation coverage ≥ 80%** —
both enforced in `tests/coach.eval.test.ts`. Append each new result to the
LangSmith dataset run history and (optionally) summarise in a new
`EVAL.md` per the witus-triage-agent precedent.

## Deployment shape

For the deployed instance, the recommended Vercel env values are:

```
COACH_LLM_PROVIDER=cerebras
COACH_FALLBACK_PROVIDERS=openrouter,anthropic
```

Cerebras handles normal traffic at $0; OpenRouter catches Cerebras's daily
quota wall (also free); Anthropic is the **paid emergency tier** so a
reviewer hitting the demo URL never sees a hard failure. In the normal case
the coach costs $0; in the worst case it falls through to a few Claude
calls.

## Known issues + caveats

- **Llama 3.3 70B ≠ Claude Sonnet 4.6** on structured output and tool
  calling. The supervisor's `RoutingSchema` and the specialists' tool
  schemas use Zod with `withStructuredOutput`; some open-weight models
  return slightly looser JSON. Watch routing accuracy on the eval re-run.
- **Cerebras free tier daily ceiling** — a bursty session can hit the wall.
  Mitigated by the OpenRouter fallback.
- **Gemini schema subset** — known from prior work: `.positive()` compiles
  to `exclusiveMinimum` which Gemini's structured-output rejects. Already
  worked around in the calorie-calculator tool. Verify the recovery + workout
  tool schemas before pointing Gemini at production traffic.
- **Free-tier ToS — some providers train on submitted traffic.** Read each
  provider's terms before pointing the deployed coach at it.

## Verification

- `pnpm typecheck` — green.
- `pnpm test` — **8 files, 37 passed, 10 skipped** (live tests properly gated).
- `pnpm lint` — **fails with 11 pre-existing errors** in
  `src/app/coach/page.tsx` (1: `<a>` to `/api/auth/signout`),
  `src/app/page.tsx` (2: unescaped apostrophes), and
  `src/app/signin/page.tsx` (8: unescaped apostrophes). **None are in files
  this branch touched** — they exist on `main` already and are out of scope
  here. Fix them on a separate `chore/eslint-cleanup` branch.

## Stop conditions

None tripped. The 8 LLM call sites are migrated; the eval suite is unchanged;
LangSmith tracing is unaffected (the layer is provider-agnostic). Branch
pushed, not merged. BAM merges after reviewing this file.

## Sibling work

- `witus-triage-agent` `feat/llm-provider-swap` — the same swap, three nodes
  instead of three roles. Land first; this branch follows the same shape.
- `wanderlearn-field-reporter` — pending. Bigger change because it has no
  `/admin` dashboard yet (it picks provider per-run from the capture form).
