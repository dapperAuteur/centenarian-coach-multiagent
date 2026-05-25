// src/lib/embeddings.ts
// Embedding factory. Pinned to 768 dimensions to match the
// `coach_kb.embedding vector(768)` column.
//
// Backend is selected by COACH_EMBED_PROVIDER:
//   - "gemini" (default) — cloud, free-tier capped at 100 RPM / ~1000 RPD.
//   - "ollama"           — local, no rate limit, free.
//
// Both seed-time (scripts/seed-kb.mjs) and query-time (the retrieval
// modules) embed through this module, so the backend stays consistent.
// Vectors from different backends do not share a space — switching
// providers means re-seeding the whole KB (pnpm kb:clear --all && pnpm
// kb:seed --fresh) so query-time vectors land in the same space as the
// stored ones.

const EMBEDDING_DIMS = 768;

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_EMBED_MODEL = "nomic-embed-text";

export type EmbedProvider = "gemini" | "ollama";

function activeProvider(): EmbedProvider {
  const value = (process.env.COACH_EMBED_PROVIDER ?? "").toLowerCase();
  return value === "ollama" ? "ollama" : "gemini";
}

/** Embed a single query string using the active backend. */
export async function embed(text: string): Promise<number[]> {
  return activeProvider() === "ollama" ? ollamaEmbed(text) : geminiEmbed(text);
}

/** Direct Gemini call — kept exported for tests and back-compat with code
 * that still imports it explicitly. Prefer `embed()` for new code. */
export async function geminiEmbed(text: string): Promise<number[]> {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_GEMINI_API_KEY) is not set");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Gemini embedding failed (${res.status}): ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned an empty vector");
  }
  return values;
}

/** Direct Ollama call — single-text. Returns the model's native dimension
 * (must be 768 to match the coach_kb schema; nomic-embed-text and a few
 * other small open-weight models are 768-dim). */
export async function ollamaEmbed(text: string): Promise<number[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_OLLAMA_EMBED_MODEL;

  const res = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    throw new Error(
      `Ollama embedding failed (${res.status}): ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { embeddings?: number[][] };
  const values = data.embeddings?.[0];
  if (!values || values.length === 0) {
    throw new Error("Ollama embedding returned an empty vector");
  }
  if (values.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Ollama model "${model}" returned ${values.length}-dim vectors; ` +
        `coach_kb expects ${EMBEDDING_DIMS}. Use a 768-dim model such as ` +
        `nomic-embed-text. Set OLLAMA_EMBED_MODEL to override.`,
    );
  }
  return values;
}
