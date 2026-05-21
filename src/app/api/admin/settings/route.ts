// src/app/api/admin/settings/route.ts
// GET  /api/admin/settings — current coach configuration + env context.
// PUT  /api/admin/settings — replace it (full object). Admin-gated by
// middleware along with the rest of /api/admin/*.

import { z } from "zod";
import {
  getStoredSettings,
  providerOverride,
  updateSettings,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roleModelsSchema = z.object({
  supervisor: z.string().trim().min(1),
  composer: z.string().trim().min(1),
  synthesizer: z.string().trim().min(1),
});

const settingsSchema = z.object({
  provider: z.enum(["anthropic", "google"]),
  models: z.object({ anthropic: roleModelsSchema, google: roleModelsSchema }),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(8192),
  tracingEnabled: z.boolean(),
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
  try {
    const settings = await getStoredSettings();
    return Response.json({ settings, ...envContext() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid settings", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const settings = await updateSettings(parsed.data);
    return Response.json({ settings, ...envContext() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
