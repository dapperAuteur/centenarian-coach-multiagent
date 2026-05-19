// src/lib/embeddings.ts
// Gemini embeddings — model gemini-embedding-001 pinned to 768 dimensions to
// match the coach_kb vector(768) column. Gemini is used only for embeddings;
// no Anthropic API is spent on retrieval.

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

interface EmbedContentResponse {
  embedding?: { values?: number[] };
}

export async function geminiEmbed(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
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

  const data = (await res.json()) as EmbedContentResponse;
  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned an empty vector");
  }
  return values;
}
