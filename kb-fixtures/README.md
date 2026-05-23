# kb-fixtures/

**This directory is intentionally empty in the public repo.** Bring your own
corpus.

`pnpm kb:seed` reads `*.json` files here (and from `private/`, which is
gitignored — use it for proprietary or copyrighted content). Each file's
basename becomes a coach knowledge-base namespace:

| File                              | Namespace        | Specialist |
| --------------------------------- | ---------------- | ---------- |
| `nutrition_kb.json`               | `nutrition_kb`   | Nutrition  |
| `workout_kb.json`                 | `workout_kb`     | Workout    |
| `recovery_kb.json`                | `recovery_kb`    | Recovery   |

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

- **`kb-fixtures/*.json`** — tracked by git. Use only for content you are
  comfortable publishing (public-domain, properly licensed, or content you
  authored).
- **`kb-fixtures/private/*.json`** — gitignored. Use for proprietary or
  copyrighted material you own a personal-use license for. Private files
  override the public file of the same namespace at seed time.

## Wiping the database

`pnpm kb:clear --all` deletes every row in `coach_kb`. Useful when retiring
old fixtures: the seed script only DELETEs rows for namespaces it is about
to insert, so removing a fixture file leaves its rows orphaned until you
clear them explicitly.
