// src/app/admin/page.tsx
// Admin dashboard: coach configuration (LLM provider, models, generation
// defaults, tracing) plus the waitlist view. Gated by middleware (matcher
// /admin/:path*) and the `authorized` / `signIn` callbacks: only ADMIN_EMAIL
// can reach this route. Managing waitlist entries lives in the WitUS Inbox.

import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { waitlist } from "@/db/schema";
import { getStoredSettings, providerOverride } from "@/lib/settings";
import { COACH_PROVIDERS, type LlmProvider } from "@/lib/llm-config";
import { SettingsForm } from "./SettingsForm";

// Always render fresh — settings and waitlist rows both change at any time.
export const dynamic = "force-dynamic";

const INBOX_URL =
  "https://inbox.witus.online/inbox?source=centenarian-coach-multiagent&form_type=waitlist-signup";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminPage() {
  const [rows, settings] = await Promise.all([
    getDb()
      .select({
        id: waitlist.id,
        email: waitlist.email,
        createdAt: waitlist.createdAt,
      })
      .from(waitlist)
      .orderBy(desc(waitlist.createdAt)),
    getStoredSettings(),
  ]);
  const envProviderOverride = providerOverride();
  const hasLangsmithKey = Boolean(process.env.LANGSMITH_API_KEY);
  const providerKeyPresent = computeProviderKeyPresent();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Admin · Dashboard
        </h1>
        <nav className="flex shrink-0 items-center gap-3 text-xs">
          <Link href="/coach" className="text-sky-700 hover:underline">
            Coach
          </Link>
          <Link
            href="/coach/history"
            className="text-sky-700 hover:underline"
          >
            History
          </Link>
          <Link href="/guide" className="text-sky-700 hover:underline">
            Guide
          </Link>
          <a
            href="/api/auth/signout?callbackUrl=/"
            className="text-gray-500 hover:text-gray-800 hover:underline"
          >
            Sign out
          </a>
        </nav>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Coach configuration
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Changes apply to the next coach run, no redeploy needed.
        </p>
        <div className="mt-4 rounded-lg border border-gray-200 p-5">
          <SettingsForm
            initialSettings={settings}
            envProviderOverride={envProviderOverride}
            hasLangsmithKey={hasLangsmithKey}
            providerKeyPresent={providerKeyPresent}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Waitlist
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length === 0
            ? "No waitlist signups yet."
            : `${rows.length} ${rows.length === 1 ? "signup" : "signups"}.`}
        </p>

        {rows.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {row.email}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      <time dateTime={row.createdAt.toISOString()}>
                        {DATE_FMT.format(row.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600">
            No one has joined the waitlist yet. Submit a non-admin email at{" "}
            <Link href="/signin" className="underline hover:text-gray-900">
              /signin
            </Link>{" "}
            to test the flow.
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500">
          Manage signups (reply, archive) in the central triage queue:{" "}
          <a
            href={INBOX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            Open in WitUS Inbox ↗
          </a>
        </p>
      </section>
    </main>
  );
}

/**
 * Map provider → whether a credential is configured for it. Ollama needs no
 * API key (just a reachable base URL), so it is always treated as available.
 */
function computeProviderKeyPresent(): Record<LlmProvider, boolean> {
  const map: Record<LlmProvider, boolean> = {
    ollama: true,
    cerebras: Boolean(process.env.CEREBRAS_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    mistral: Boolean(process.env.MISTRAL_API_KEY),
    together: Boolean(process.env.TOGETHER_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    google: Boolean(
      process.env.GEMINI_API_KEY ??
        process.env.GOOGLE_GEMINI_API_KEY ??
        process.env.GOOGLE_API_KEY,
    ),
  };
  for (const p of COACH_PROVIDERS) {
    if (!(p in map)) throw new Error(`Missing key-presence entry for ${p}`);
  }
  return map;
}
