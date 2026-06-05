"use client";

// src/app/admin/SettingsForm.tsx
// The coach-configuration form on the /admin dashboard: LLM provider,
// per-role model IDs, generation defaults, and the tracing toggle. Saves to
// PUT /api/admin/settings; a save takes effect on the next coach run.
//
// Cost-class UX: the provider <select> groups Free and Paid options with
// <optgroup>, each option's label carries the cost class, and a persistent
// banner above the form is amber when a paid provider is active — so a
// switch to a billed provider is never invisible.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ErrorNotice from "@/components/ErrorNotice";
import {
  COACH_PROVIDERS,
  COACH_ROLES,
  PROVIDER_COST_CLASS,
  PROVIDER_LABELS,
  type LlmProvider,
  type LlmRole,
} from "@/lib/llm-config";
import type { CoachSettings, CorpusMode } from "@/lib/settings";

const CORPUS_MODE_OPTIONS: { value: CorpusMode; label: string; hint: string }[] =
  [
    {
      value: "public",
      label: "Public only",
      hint: "Open-access sources only. Safe to screen-share or deploy publicly.",
    },
    {
      value: "private",
      label: "Private only",
      hint: "Your proprietary/ingested corpus only.",
    },
    {
      value: "both",
      label: "Both",
      hint: "Draw on public and private sources together.",
    },
  ];

const FREE_PROVIDERS = COACH_PROVIDERS.filter(
  (p) => PROVIDER_COST_CLASS[p] === "free",
);
const PAID_PROVIDERS = COACH_PROVIDERS.filter(
  (p) => PROVIDER_COST_CLASS[p] === "paid",
);

const ROLE_META: Record<LlmRole, { label: string; hint: string }> = {
  supervisor: { label: "Supervisor", hint: "Routes the question." },
  composer: { label: "Composer", hint: "Writes each finding." },
  synthesizer: { label: "Synthesizer", hint: "Weaves the answer." },
};

// Sentinel <select> value: "let me type an ID the list does not have".
const CUSTOM = "__custom__";

// Curated, known-good model IDs per provider, offered as a dropdown so the
// common case needs no typing. "Custom model ID" stays available for models
// not yet in this list.
const MODEL_OPTIONS: Record<LlmProvider, { id: string; label: string }[]> = {
  ollama: [
    { id: "llama3.1:8b", label: "Llama 3.1 8B (laptop-friendly)" },
    { id: "llama3.1:70b", label: "Llama 3.1 70B (heavy local)" },
    { id: "qwen2.5:14b", label: "Qwen 2.5 14B" },
  ],
  cerebras: [
    { id: "llama-3.3-70b", label: "Llama 3.3 70B (fast)" },
    { id: "llama3.1-8b", label: "Llama 3.1 8B" },
  ],
  openrouter: [
    { id: "deepseek/deepseek-chat:free", label: "DeepSeek Chat (free)" },
    {
      id: "meta-llama/llama-3.3-70b-instruct:free",
      label: "Llama 3.3 70B Instruct (free)",
    },
    {
      id: "qwen/qwen-2.5-72b-instruct:free",
      label: "Qwen 2.5 72B Instruct (free)",
    },
  ],
  mistral: [
    { id: "mistral-small-latest", label: "Mistral Small" },
    { id: "mistral-large-latest", label: "Mistral Large" },
  ],
  together: [
    {
      id: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      label: "Llama 3.3 70B Turbo (free)",
    },
    { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3" },
  ],
  anthropic: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7 (most capable)" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
    {
      id: "claude-haiku-4-5-20251001",
      label: "Claude Haiku 4.5 (fast, low cost)",
    },
  ],
  google: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (most capable)" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, free tier)" },
  ],
};

const FIELD_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string; requestId?: string };

interface Props {
  initialSettings: CoachSettings;
  /** COACH_LLM_PROVIDER, when set, overrides the stored provider at runtime. */
  envProviderOverride: LlmProvider | null;
  hasLangsmithKey: boolean;
  /** Which providers have an API key configured server-side. */
  providerKeyPresent: Record<LlmProvider, boolean>;
}

function providerOptionLabel(
  p: LlmProvider,
  hasKey: boolean,
): string {
  const cost = PROVIDER_COST_CLASS[p] === "free" ? "Free" : "Paid";
  const base = `${PROVIDER_LABELS[p]} · ${cost}`;
  return hasKey ? base : `${base} · no API key set`;
}

export function SettingsForm({
  initialSettings,
  envProviderOverride,
  hasLangsmithKey,
  providerKeyPresent,
}: Props) {
  const [settings, setSettings] = useState<CoachSettings>(initialSettings);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const provider = settings.provider;
  const activeCostClass = PROVIDER_COST_CLASS[provider];

  function patch(partial: Partial<CoachSettings>) {
    setSettings((s) => ({ ...s, ...partial }));
    setStatus({ kind: "idle" });
  }

  function setModel(role: LlmRole, value: string) {
    setSettings((s) => ({
      ...s,
      models: {
        ...s.models,
        [provider]: { ...s.models[provider], [role]: value },
      },
    }));
    setStatus({ kind: "idle" });
  }

  async function onSave() {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await res.json().catch(() => ({}))) as {
        settings?: CoachSettings;
        error?: string;
        requestId?: string;
      };
      if (!res.ok || !data.settings) {
        setStatus({
          kind: "error",
          message: data.error ?? `Save failed (${res.status})`,
          requestId:
            data.requestId ?? res.headers.get("x-request-id") ?? undefined,
        });
        return;
      }
      setSettings(data.settings);
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Save failed",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Cost-class banner — amber when paid so a switch is never invisible. */}
      <div
        role="status"
        aria-live="polite"
        className={
          "rounded-md border px-3 py-2 text-sm " +
          (activeCostClass === "paid"
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-emerald-300 bg-emerald-50 text-emerald-900")
        }
      >
        <strong>{PROVIDER_LABELS[provider]}</strong>{" "}
        {activeCostClass === "paid"
          ? "— billed per token. A paid provider is active."
          : "— $0 in the normal case (rate-limited free tier or local)."}
      </div>

      {/* Provider */}
      <div>
        <label
          htmlFor="provider-select"
          className="text-sm font-semibold text-gray-900"
        >
          LLM provider
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Free providers are rate-limited but cost nothing. Paid providers are
          billed per token and listed separately.
        </p>
        <select
          id="provider-select"
          value={provider}
          onChange={(e) =>
            patch({ provider: e.target.value as LlmProvider })
          }
          className={`mt-2 ${FIELD_CLASS}`}
        >
          <optgroup label="Free (rate-limited, $0)">
            {FREE_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {providerOptionLabel(p, providerKeyPresent[p])}
              </option>
            ))}
          </optgroup>
          <optgroup label="Paid (billed per token)">
            {PAID_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {providerOptionLabel(p, providerKeyPresent[p])}
              </option>
            ))}
          </optgroup>
        </select>
        {!providerKeyPresent[provider] && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No API key is configured for{" "}
            <strong>{PROVIDER_LABELS[provider]}</strong>. Saving still records
            this choice, but runs will fail until the key is set in{" "}
            <code>.env.local</code>.
          </p>
        )}
        {envProviderOverride && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The <code>COACH_LLM_PROVIDER</code> env var is set to{" "}
            <strong>{envProviderOverride}</strong> and overrides this at
            runtime. Saving still records your choice for when the env var is
            removed.
          </p>
        )}
      </div>

      {/* Per-role model IDs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Model IDs · {PROVIDER_LABELS[provider]}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Pick a model for each role on the selected provider. Choose
          &ldquo;Custom model ID&rdquo; to enter one not in the list.
        </p>
        <div className="mt-2 space-y-3">
          {COACH_ROLES.map((role) => (
            <ModelField
              key={role}
              provider={provider}
              label={ROLE_META[role].label}
              hint={ROLE_META[role].hint}
              value={settings.models[provider][role]}
              onChange={(value) => setModel(role, value)}
            />
          ))}
        </div>
      </div>

      {/* Generation params */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Generation defaults
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Applied when a coach node does not specify its own value.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Temperature (0 to 2)
            </span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={settings.temperature}
              onChange={(e) =>
                patch({ temperature: Number(e.target.value) })
              }
              className={`mt-1 ${FIELD_CLASS}`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Max tokens (64 to 8192)
            </span>
            <input
              type="number"
              min={64}
              max={8192}
              step={64}
              value={settings.maxTokens}
              onChange={(e) => patch({ maxTokens: Number(e.target.value) })}
              className={`mt-1 ${FIELD_CLASS}`}
            />
          </label>
        </div>
      </div>

      {/* Tracing */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          LangSmith tracing
        </h3>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.tracingEnabled}
            onChange={(e) => patch({ tracingEnabled: e.target.checked })}
          />
          Trace coach runs to LangSmith
        </label>
        {!hasLangsmithKey && (
          <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            No <code>LANGSMITH_API_KEY</code> is configured, so tracing stays
            off regardless of this toggle.
          </p>
        )}
      </div>

      {/* Knowledge base / corpus visibility */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Knowledge base</h3>
        <p className="mt-1 text-xs text-gray-500">
          Which sources the coach retrieves from. Public ships with the repo;
          private is your own ingested corpus. Both layers live in one database,
          distinguished by a per-row visibility flag.
        </p>
        <select
          aria-label="Corpus mode"
          value={settings.corpusMode}
          onChange={(e) =>
            patch({ corpusMode: e.target.value as CorpusMode })
          }
          className={`mt-2 ${FIELD_CLASS}`}
        >
          {CORPUS_MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {
            CORPUS_MODE_OPTIONS.find((o) => o.value === settings.corpusMode)
              ?.hint
          }
        </p>
        {settings.corpusMode !== "public" && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Private sources are being served. Switch to{" "}
            <strong>Public only</strong> before sharing the coach publicly or
            recording marketing videos.
          </p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
        <Button
          type="button"
          onClick={onSave}
          disabled={status.kind === "saving"}
        >
          {status.kind === "saving" ? "Saving…" : "Save settings"}
        </Button>
        {status.kind === "saved" && (
          <span className="text-sm text-green-700">Saved.</span>
        )}
      </div>
      {status.kind === "error" && (
        <ErrorNotice message={status.message} requestId={status.requestId} />
      )}
    </div>
  );
}

/**
 * One role's model picker: a dropdown of curated model IDs for the active
 * provider, plus a "Custom" option that reveals a free-text input for any ID
 * not in the list. The custom state is derived from the value itself — a
 * value absent from the curated list is treated as custom.
 */
function ModelField({
  provider,
  label,
  hint,
  value,
  onChange,
}: {
  provider: LlmProvider;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = MODEL_OPTIONS[provider];
  const isCustom = !options.some((option) => option.id === value);

  return (
    <div>
      <span className="text-xs font-medium text-gray-700">
        {label} <span className="font-normal text-gray-400">· {hint}</span>
      </span>
      <select
        value={isCustom ? CUSTOM : value}
        onChange={(e) =>
          onChange(e.target.value === CUSTOM ? "" : e.target.value)
        }
        className={`mt-1 ${FIELD_CLASS}`}
        aria-label={`${label} model`}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM}>Custom model ID…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Exact model ID, e.g. claude-sonnet-4-6"
          aria-label={`${label} custom model ID`}
          className={`mt-2 ${FIELD_CLASS} font-mono`}
        />
      )}
    </div>
  );
}
