"use client";

// src/app/admin/SettingsForm.tsx
// The coach-configuration form on the /admin dashboard: LLM provider,
// per-role model IDs, generation defaults, and the tracing toggle. Saves to
// PUT /api/admin/settings; a save takes effect on the next coach run.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LlmProvider, LlmRole } from "@/lib/llm";
import type { CoachSettings } from "@/lib/settings";

const PROVIDERS: { value: LlmProvider; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google", label: "Google (Gemini)" },
];

const ROLES: { role: LlmRole; label: string; hint: string }[] = [
  { role: "supervisor", label: "Supervisor", hint: "Routes the question." },
  { role: "composer", label: "Composer", hint: "Writes each finding." },
  { role: "synthesizer", label: "Synthesizer", hint: "Weaves the answer." },
];

// Sentinel <select> value: "let me type an ID the list does not have".
const CUSTOM = "__custom__";

// Curated, known-good model IDs per provider, offered as a dropdown so the
// common case needs no typing. "Custom model ID" stays available for models
// not yet in this list.
const MODEL_OPTIONS: Record<LlmProvider, { id: string; label: string }[]> = {
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
  | { kind: "error"; message: string };

interface Props {
  initialSettings: CoachSettings;
  /** COACH_LLM_PROVIDER, when set, overrides the stored provider at runtime. */
  envProviderOverride: LlmProvider | null;
  hasLangsmithKey: boolean;
}

export function SettingsForm({
  initialSettings,
  envProviderOverride,
  hasLangsmithKey,
}: Props) {
  const [settings, setSettings] = useState<CoachSettings>(initialSettings);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const provider = settings.provider;

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
      const data = (await res.json()) as {
        settings?: CoachSettings;
        error?: string;
      };
      if (!res.ok || !data.settings) {
        throw new Error(data.error ?? `Save failed (${res.status})`);
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
      {/* Provider */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">LLM provider</h3>
        <div className="mt-2 flex gap-4">
          {PROVIDERS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="provider"
                checked={provider === p.value}
                onChange={() => patch({ provider: p.value })}
              />
              {p.label}
            </label>
          ))}
        </div>
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
          Model IDs · {provider}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Pick a model for each role on the selected provider. Choose
          &ldquo;Custom model ID&rdquo; to enter one not in the list.
        </p>
        <div className="mt-2 space-y-3">
          {ROLES.map(({ role, label, hint }) => (
            <ModelField
              key={role}
              provider={provider}
              label={label}
              hint={hint}
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
        {status.kind === "error" && (
          <span className="text-sm text-red-700">{status.message}</span>
        )}
      </div>
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
