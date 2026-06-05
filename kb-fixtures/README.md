# kb-fixtures/

**This directory ships a small public starter corpus** for the course: a few
peer-reviewed studies per specialist (the kind of science behind leading
science-based fitness and health certifications), one `*.json` per namespace.
Extend or replace it with your own corpus. Only open-access / redistributable
content belongs in these tracked files; proprietary material goes in `private/`.

`pnpm kb:seed` reads `*.json` files here (and from `private/`, which is
gitignored, use it for proprietary or copyrighted content). Each file's
basename becomes a coach knowledge-base namespace:

| File                              | Namespace        | Specialist |
| --------------------------------- | ---------------- | ---------- |
| `nutrition_kb.json`               | `nutrition_kb`   | Nutrition  |
| `workout_kb.json`                 | `workout_kb`     | Workout    |
| `recovery_kb.json`                | `recovery_kb`    | Recovery   |
| `corrective_kb.json`              | `corrective_kb`  | Corrective |

## File shape

Each file is a JSON array of `{ source, content }` documents:

```json
[
  {
    "source": "Citation label shown in the UI",
    "content": "The passage to embed. ~50-100 words is a good chunk size."
  }
]
```

`source` becomes the user-visible citation; `content` is embedded with
`gemini-embedding-001` (768-dim) and stored in the `coach_kb` table.

## Public vs private

- **`kb-fixtures/*.json`**, tracked by git. Use only for content you are
  comfortable publishing (public-domain, properly licensed, or content you
  authored).
- **`kb-fixtures/private/*.json`**, gitignored. Use for proprietary or
  copyrighted material you own a personal-use license for.

### Visibility layers + the corpus toggle

Every seeded row carries a `visibility` column (`public` from `*.json`,
`private` from `private/*.json`). Both layers can live in **one** database, and
the `/admin` **Knowledge base** selector (`app_settings.corpus_mode`) chooses
what the coach retrieves: `public`, `private`, or `both`. Defaults are safe:
`visibility` defaults to `private` (existing rows are never served publicly by
accident) and the SQL retrieval function filters on the active mode.

Two ways to seed:

- **Plain `pnpm kb:seed`** (no layer flag): if a namespace exists in both dirs,
  the private file wins for that namespace (single-corpus convenience).
- **`pnpm kb:seed --layer=public` / `--layer=private`**: seed exactly one layer,
  tagged with that visibility. The layers are independent rows keyed by
  `(namespace, visibility, doc_index)`, so adding the public layer never touches
  your private rows (no re-embedding). To hold both in one DB, run each:

  ```bash
  pnpm kb:seed --layer=private   # your proprietary corpus
  pnpm kb:seed --layer=public    # the open-access starter corpus
  ```

  Then pick the mode in `/admin`. See `plans/user-tasks/19` for the full rollout.

## Wiping the database

`pnpm kb:clear --all` deletes every row in `coach_kb`. Useful when retiring
old fixtures: the seed script only DELETEs rows for namespaces it is about
to insert, so removing a fixture file leaves its rows orphaned until you
clear them explicitly.

## Resuming + meet-in-the-middle

Every row carries a `doc_index` (its position in the source JSON) so the
seed script can resume safely after any kind of interruption.

- **Default resume** (no flags): the script looks at `max(doc_index)` for
  the namespace and continues from there. If the laptop died at row 870,
  re-running `pnpm kb:seed` picks up at 871. Pass `--fresh` to wipe and
  re-seed instead.
- **Range mode** (`--start=N --end=M`): split one namespace across two
  machines. Each machine processes its slice independently, with its own
  resume scope.

```bash
# Machine A, first half of nutrition_kb
pnpm kb:seed nutrition_kb --start=0 --end=3793

# Machine B, second half, runs at the same time on a different laptop
pnpm kb:seed nutrition_kb --start=3793 --end=7585
```

If A dies at row 1500 (within its 0–3793 range), re-running the **same
command** on A resumes at 1500 and continues through 3792. B's resume is
independent, it counts only rows in `[3793, 7585)`.

Meet-in-the-middle works for **any** fixture content, including the public
starter corpus and either visibility layer. Combine it with `--layer` to split a
specific layer across machines; resume scope is per `(namespace, visibility,
range)`, so the layers and ranges stay independent:

```bash
# Split the private corrective layer across two laptops
pnpm kb:seed corrective_kb --layer=private --start=0 --end=2500   # machine A
pnpm kb:seed corrective_kb --layer=private --start=2500 --end=5000 # machine B
```

In practice you only need this for a **large** corpus (thousands of chunks, e.g.
an ingested private library). The tracked public corpus is small (tens to ~125
docs per namespace) and seeds in seconds, so `pnpm kb:seed --layer=public` alone
is enough there.

Range-mode rules:
- Exactly one namespace argument; ranges across multiple namespaces are
  rejected. (A `--layer` flag does not count as a namespace.)
- `--fresh` in range mode wipes only the targeted range, so two machines
  with disjoint ranges plus `--fresh` don't wipe each other.
- You're responsible for keeping the ranges disjoint across machines.
  Overlap = duplicate rows; gaps = missing docs (silent).
- Requires migration 0003 applied (`pnpm db:migrate`). Without it,
  pre-existing rows have `NULL` doc_index and the script throws with a
  clear "run db:migrate" message.

## Adding content to a finished namespace

To add new PDFs to a namespace that's already seeded, without re-embedding
what's already there, use append mode. It keeps existing rows untouched and
puts new chunks at the end, so `pnpm kb:seed` only embeds the new tail.

```bash
# 1. Drop the new PDF(s) into the relevant source dir (the ones listed in
#    INPUTS at the top of scripts/ingest-kb.mjs), e.g. the CPT folders for
#    workout_kb.

# 2. Append just the new files to the JSON (existing entries stay put).
pnpm kb:ingest --append --dry-run   # preview: shows skipped vs new files
pnpm kb:ingest --append             # writes the appended JSON

# 3. Seed, resume picks up at the first new doc_index and embeds only
#    the appended chunks.
pnpm kb:seed workout_kb
```

Append mode skips any file already represented in the JSON (matched by the
basename in its source label), so re-running it is safe. Do NOT run a plain
`pnpm kb:ingest` (without `--append`) to add content: that rebuilds the JSON
from scratch and, if a new file sorts into the middle, shifts every later
`doc_index`, which breaks the alignment between the JSON and the rows
already in the DB.

## Embedding backend

Two backends, switched via `COACH_EMBED_PROVIDER` in `.env.local`:

| Value | Cost | Rate limit | Model |
| --- | --- | --- | --- |
| `gemini` (default) | Free tier OR paid | 100 RPM / ~1000 RPD on free | `gemini-embedding-001` (768-dim) |
| `ollama` | Free (local CPU/GPU) | None | `nomic-embed-text` (768-dim) by default; override via `OLLAMA_EMBED_MODEL` |

Both seed-time and query-time embeddings flow through `src/lib/embeddings.ts`
and read the same `COACH_EMBED_PROVIDER`, so they stay aligned.

**Switching backend means re-seeding the whole KB.** Vectors from different
models live in different spaces, so mixing them in a namespace breaks
retrieval. Run `pnpm kb:clear --all && pnpm kb:seed --fresh` after changing
the env.

To use Ollama locally:

```bash
brew install ollama          # or download from ollama.com
ollama pull nomic-embed-text # one-time, ~270 MB
# in .env.local:
COACH_EMBED_PROVIDER=ollama
```

Optional Ollama env vars:
- `OLLAMA_BASE_URL`, default `http://localhost:11434`.
- `OLLAMA_EMBED_MODEL`, default `nomic-embed-text`; must be a 768-dim model.
- `OLLAMA_EMBED_BATCH`, default `10`. Increase on Apple Silicon for faster
  throughput; decrease to 3-5 on slower Intel CPUs if a batch is hitting the
  30-minute fetch timeout.
