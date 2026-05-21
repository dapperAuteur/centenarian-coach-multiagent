// tests/settings.test.ts
// Pure unit tests for the runtime-settings resolution logic — no DB, no
// network. These run as part of the default `pnpm test`.

import { describe, it, expect, afterEach } from "vitest";
import { resolveSettings, providerOverride } from "@/lib/settings";
import { DEFAULT_MODELS } from "@/lib/llm";

type Row = NonNullable<Parameters<typeof resolveSettings>[0]>;

/** A complete app_settings row, with overridable fields. */
function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "singleton",
    provider: "anthropic",
    models: {},
    temperature: 0,
    maxTokens: 1024,
    tracingEnabled: true,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("resolveSettings", () => {
  it("falls back to built-in defaults when there is no row", () => {
    const s = resolveSettings(null, { hasLangsmithKey: false });
    expect(s.provider).toBe("anthropic");
    expect(s.models).toEqual(DEFAULT_MODELS);
    expect(s.temperature).toBe(0);
    expect(s.maxTokens).toBe(1024);
    expect(s.tracingEnabled).toBe(false);
  });

  it("defaults tracing on when a LangSmith key is present and no row", () => {
    expect(
      resolveSettings(null, { hasLangsmithKey: true }).tracingEnabled,
    ).toBe(true);
  });

  it("maps a stored row", () => {
    const s = resolveSettings(
      row({
        provider: "google",
        temperature: 0.5,
        maxTokens: 2048,
        tracingEnabled: false,
      }),
    );
    expect(s.provider).toBe("google");
    expect(s.temperature).toBe(0.5);
    expect(s.maxTokens).toBe(2048);
    expect(s.tracingEnabled).toBe(false);
  });

  it("merges partial model overrides over the defaults", () => {
    const s = resolveSettings(
      row({ models: { anthropic: { supervisor: "claude-custom" } } }),
    );
    expect(s.models.anthropic.supervisor).toBe("claude-custom");
    // Untouched slots keep their built-in default.
    expect(s.models.anthropic.composer).toBe(
      DEFAULT_MODELS.anthropic.composer,
    );
    expect(s.models.google).toEqual(DEFAULT_MODELS.google);
  });

  it("treats an unknown provider string as anthropic", () => {
    expect(resolveSettings(row({ provider: "bogus" })).provider).toBe(
      "anthropic",
    );
  });
});

describe("providerOverride", () => {
  const original = process.env.COACH_LLM_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.COACH_LLM_PROVIDER;
    else process.env.COACH_LLM_PROVIDER = original;
  });

  it("returns the provider when the env var is a valid provider", () => {
    process.env.COACH_LLM_PROVIDER = "google";
    expect(providerOverride()).toBe("google");
  });

  it("returns null when the env var is unset or invalid", () => {
    delete process.env.COACH_LLM_PROVIDER;
    expect(providerOverride()).toBeNull();
    process.env.COACH_LLM_PROVIDER = "nonsense";
    expect(providerOverride()).toBeNull();
  });
});
