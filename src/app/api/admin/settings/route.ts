// src/app/api/admin/settings/route.ts
// GET  /api/admin/settings — current coach configuration + env context.
// PUT  /api/admin/settings — replace it (full object). Admin-gated by
// middleware along with the rest of /api/admin/*.

import { z } from "zod";
import {
  CORPUS_MODES,
  getStoredSettings,
  providerOverride,
  updateSettings,
} from "@/lib/settings";
import { COACH_PROVIDERS } from "@/lib/llm-config";
import { apiError, handleRouteError, newRequestId } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roleModelsSchema = z.object({
  supervisor: z.string().trim().min(1),
  composer: z.string().trim().min(1),
  synthesizer: z.string().trim().min(1),
});

// Build the seven-key models object schema from COACH_PROVIDERS so adding a
// new provider in one place propagates here automatically.
const modelsSchema = z.object(
  Object.fromEntries(
    COACH_PROVIDERS.map((p) => [p, roleModelsSchema]),
  ) as Record<(typeof COACH_PROVIDERS)[number], typeof roleModelsSchema>,
);

const settingsSchema = z.object({
  provider: z.enum(COACH_PROVIDERS),
  models: modelsSchema,
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(8192),
  tracingEnabled: z.boolean(),
  corpusMode: z.enum(CORPUS_MODES),
});

/** Env context the dashboard needs to render correctly. */
function envContext() {
  return {
    // When set, COACH_LLM_PROVIDER overrides the stored provider at runtime.
    envProviderOverride: providerOverride(),
    // Tracing cannot run without a key, regardless of the toggle.
    hasLangsmithKey: Boolean(process.env.LANGSMITH_API_KEY),
  };
}

export async function GET(): Promise<Response> {
  const requestId = newRequestId();
  try {
    const settings = await getStoredSettings();
    return Response.json({ settings, ...envContext() });
  } catch (err) {
    return handleRouteError("admin/settings:GET", err, requestId);
  }
}

export async function PUT(req: Request): Promise<Response> {
  const requestId = newRequestId();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body", requestId);
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "Invalid settings", requestId, {
      issues: parsed.error.issues,
    });
  }

  try {
    const settings = await updateSettings(parsed.data);
    return Response.json({ settings, ...envContext() });
  } catch (err) {
    return handleRouteError("admin/settings:PUT", err, requestId);
  }
}
