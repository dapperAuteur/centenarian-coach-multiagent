// src/app/guide/guide-content.ts
// Hand-authored content for the public /guide page. Structured as typed
// blocks so the same data both renders and feeds the client-side search.
// Three audiences: users, architecture (hiring managers / devs), operators.
//
// Prose adapted from README.md and kb-fixtures/README.md. Kept free of
// em-dashes per the project's copy convention.

export type Audience = "users" | "architecture" | "operators";

export type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string }
  | { type: "link"; href: string; label: string; external?: boolean };

export interface GuideSection {
  id: string;
  audience: Audience;
  title: string;
  blocks: Block[];
}

export const AUDIENCE_LABELS: Record<Audience, string> = {
  users: "For users",
  architecture: "How it's built",
  operators: "Run it yourself",
};

export const GUIDE_SECTIONS: GuideSection[] = [
  // ---------------------------------------------------------------- users
  {
    id: "what-it-is",
    audience: "users",
    title: "What the Centenarian Coach is",
    blocks: [
      {
        type: "p",
        text: "A multi-agent health coach. You ask one question; a supervisor decides which specialists to consult, each specialist searches its own knowledge base, and a synthesizer weaves their findings into one answer with citations.",
      },
      {
        type: "p",
        text: "The coach is grounded in a science-based fitness, nutrition, and corrective-exercise curriculum. Answers cite real passages from those source materials rather than relying on generic model knowledge.",
      },
    ],
  },
  {
    id: "specialists",
    audience: "users",
    title: "The four specialists",
    blocks: [
      {
        type: "p",
        text: "A question is routed to one, several, or all four specialists, depending on what it touches:",
      },
      {
        type: "list",
        items: [
          "Nutrition: diet, macros, protein, calories, supplements, eating patterns, fasting.",
          "Workout: strength training, cardio, exercise programming, progression, periodization.",
          "Recovery: sleep, HRV, rest days, stress, and readiness.",
          "Corrective Exercise: movement assessment, postural imbalances, mobility, flexibility, SMR / foam rolling, and region-specific corrective strategies.",
        ],
      },
    ],
  },
  {
    id: "asking",
    audience: "users",
    title: "How to ask a good question",
    blocks: [
      {
        type: "p",
        text: "Plain language works. Cross-domain questions are where the multi-agent design earns its keep, because the supervisor can fan out to several specialists and the synthesizer connects their advice.",
      },
      {
        type: "list",
        items: [
          "\"How much protein should a 70-year-old eat to preserve muscle?\" routes to Nutrition.",
          "\"I slept five hours; should I still train legs today?\" routes to Workout plus Recovery.",
          "\"My knees cave in when I squat. How do I fix it?\" routes to Corrective Exercise.",
          "\"I want to build muscle: how should I combine eating, training, and recovery?\" can pull all four.",
        ],
      },
    ],
  },
  {
    id: "reading-answer",
    audience: "users",
    title: "Reading the answer",
    blocks: [
      {
        type: "p",
        text: "Each run shows the supervisor's routing rationale, which specialists were consulted (with timings), and the synthesized answer. Citations are grouped per specialist and toggled open under the answer, so you can see the source label behind each claim.",
      },
      {
        type: "p",
        text: "When LangSmith tracing is enabled, the run also surfaces a trace id so the full agent run can be inspected.",
      },
    ],
  },
  {
    id: "history",
    audience: "users",
    title: "Browsing past sessions",
    blocks: [
      {
        type: "p",
        text: "The history page lists recent coaching sessions, newest first, with a live fuzzy search over the question text and answer. Select one to see how it was routed and what each specialist found.",
      },
      { type: "link", href: "/coach/history", label: "Coaching history" },
    ],
  },
  {
    id: "access",
    audience: "users",
    title: "Access",
    blocks: [
      {
        type: "p",
        text: "This is a single-admin demo: only the owner's email can sign in and run the coach. Anyone else can join a waitlist from the sign-in page. This guide, however, is fully public.",
      },
    ],
  },

  // -------------------------------------------------------- architecture
  {
    id: "patterns",
    audience: "architecture",
    title: "Three LangGraph patterns",
    blocks: [
      {
        type: "p",
        text: "The repo is a teaching example of three patterns that show up in most production agent systems:",
      },
      {
        type: "list",
        items: [
          "Supervisor routing: a typed, structured routing decision (via Zod withStructuredOutput) before any specialist runs.",
          "Per-agent retrieval: each specialist owns an isolated pgvector namespace, so nutrition never sees workout documents.",
          "State passing across nested subgraphs: a shared CoachState where each specialist writes only its own slot.",
        ],
      },
    ],
  },
  {
    id: "graph",
    audience: "architecture",
    title: "The graph",
    blocks: [
      {
        type: "p",
        text: "supervisor -> fan-out to the chosen specialists (run in parallel) -> synthesize -> final answer. Each specialist is itself a compiled subgraph: retrieve -> assess -> (tools) -> compose. Specialists cannot read each other's findings; only the synthesizer sees them all.",
      },
    ],
  },
  {
    id: "stack",
    audience: "architecture",
    title: "Tech stack",
    blocks: [
      {
        type: "list",
        items: [
          "Next.js 16 (App Router) + TypeScript strict.",
          "LangGraph 1.x for the supervisor + specialist subgraphs.",
          "Drizzle ORM over Neon Postgres with the pgvector extension.",
          "Auth.js v5 (email magic link), single-admin gated.",
          "Seven switchable LLM providers; Gemini or Ollama for embeddings.",
          "NDJSON streaming from a Next route handler; Vitest for tests + evals.",
        ],
      },
    ],
  },
  {
    id: "decisions",
    audience: "architecture",
    title: "Engineering decisions worth noting",
    blocks: [
      {
        type: "list",
        items: [
          "Provider schema-subset mismatch: a Zod .positive() compiled to JSON Schema's exclusiveMinimum, which Gemini's structured-output subset rejects. Swapped for an inclusive .min(1).",
          "Gemini embedding quota walls (100/min, ~1000/day on free tier) made large corpora impractical, so the embedding backend is swappable to a local Ollama model with no rate limit.",
          "PDF text occasionally carries NUL bytes that Postgres text columns reject; the seed sanitizes C0 control characters.",
          "Meet-in-the-middle seeding: a doc_index column lets two machines split one namespace and each resume independently.",
          "Runtime model config: provider and per-role models are editable from /admin with no redeploy.",
        ],
      },
    ],
  },
  {
    id: "curriculum",
    audience: "architecture",
    title: "The five-lesson curriculum",
    blocks: [
      {
        type: "p",
        text: "Each design decision is walked through in a short lesson (rendered in-app):",
      },
      {
        type: "link",
        href: "/guide/lessons/01-single-vs-multi-agent",
        label: "Lesson 1: When multi-agent actually pays",
      },
      {
        type: "link",
        href: "/guide/lessons/02-supervisor-routing",
        label: "Lesson 2: Supervisor routing as a typed decision",
      },
      {
        type: "link",
        href: "/guide/lessons/03-per-agent-retrieval",
        label: "Lesson 3: Per-agent retrieval isolation",
      },
      {
        type: "link",
        href: "/guide/lessons/04-state-passing",
        label: "Lesson 4: State passing across subgraphs",
      },
      {
        type: "link",
        href: "/guide/lessons/05-evals",
        label: "Lesson 5: Evals, a dataset and rubric",
      },
      {
        type: "link",
        href: "https://github.com/dapperAuteur/centenarian-coach-multiagent",
        label: "Source on GitHub",
        external: true,
      },
      { type: "link", href: "/walkthrough", label: "Watch the walkthrough" },
    ],
  },

  // ------------------------------------------------------------ operators
  {
    id: "setup",
    audience: "operators",
    title: "Setup",
    blocks: [
      {
        type: "p",
        text: "Clone, install, configure, and migrate. pnpm 11 requires approving the postinstall scripts (esbuild, sharp, msw, unrs-resolver); that approval already ships in package.json.",
      },
      {
        type: "code",
        code: "git clone https://github.com/dapperAuteur/centenarian-coach-multiagent.git\ncd centenarian-coach-multiagent\npnpm install\ncp .env.example .env.local   # fill in keys + STORAGE_DATABASE_URL\npnpm db:migrate              # applies schema incl. coach_kb + doc_index",
      },
    ],
  },
  {
    id: "corpus",
    audience: "operators",
    title: "Bring your own corpus",
    blocks: [
      {
        type: "p",
        text: "The repo ships kb-fixtures/ empty. You supply the knowledge base: either hand-written { source, content } JSON files, or PDFs you ingest. The author's instance is grounded in a science-based curriculum of fitness, nutrition, and corrective-exercise source PDFs.",
      },
      {
        type: "p",
        text: "Because source materials may be copyrighted (licensed for personal study), they live in a gitignored kb-fixtures/private/ directory and are never committed. The app is single-admin, so that content stays private to the operator's database.",
      },
    ],
  },
  {
    id: "ingest",
    audience: "operators",
    title: "Ingesting PDFs",
    blocks: [
      {
        type: "p",
        text: "kb:ingest extracts text from the PDF directories you configure via the INGEST_*_DIRS env vars in .env.local (one or more directories per namespace: INGEST_NUTRITION_DIRS -> nutrition_kb, INGEST_WORKOUT_DIRS -> workout_kb, INGEST_CORRECTIVE_DIRS -> corrective_kb, INGEST_RECOVERY_DIRS -> recovery_kb), chunks it, and writes kb-fixtures/private/<namespace>.json. Keeping the paths in .env.local keeps your personal directories out of the repo.",
      },
      {
        type: "code",
        code: "pnpm kb:ingest --dry-run   # preview classification, write nothing\npnpm kb:ingest             # write the per-namespace JSON\npnpm kb:ingest --append    # add only new files to existing JSON",
      },
    ],
  },
  {
    id: "seed",
    audience: "operators",
    title: "Embedding and inserting (seed)",
    blocks: [
      {
        type: "p",
        text: "kb:seed embeds each chunk and inserts it into the coach_kb table. It resumes automatically via doc_index, so a quota wall or a dead battery never forces a restart. Range flags split one namespace across two machines (meet-in-the-middle).",
      },
      {
        type: "code",
        code: "pnpm kb:seed                       # all namespaces, resume where left off\npnpm kb:seed workout_kb            # one namespace\npnpm kb:seed --fresh               # wipe + re-seed\npnpm kb:seed workout_kb --start=0 --end=5000   # machine A\npnpm kb:seed workout_kb --start=5000 --end=10233  # machine B",
      },
    ],
  },
  {
    id: "embedding-backend",
    audience: "operators",
    title: "Choosing the embedding backend",
    blocks: [
      {
        type: "p",
        text: "COACH_EMBED_PROVIDER in .env.local selects how chunks (and live queries) are embedded. Both backends are 768-dim. Switching backends requires a full re-seed, because vectors from different models live in different spaces and cannot be mixed in a namespace.",
      },
      {
        type: "list",
        items: [
          "gemini (default): cloud, free tier capped at 100 requests/min and ~1000/day; set EMBED_RPM higher on a paid tier.",
          "ollama: local, free, no rate limit. Defaults to nomic-embed-text; tune OLLAMA_EMBED_BATCH for your CPU.",
        ],
      },
    ],
  },
  {
    id: "choosing-llm",
    audience: "operators",
    title: "Choosing the chat LLM",
    blocks: [
      {
        type: "p",
        text: "The /admin dashboard configures the chat models at runtime, no redeploy. Changes apply to the next coach run.",
      },
      {
        type: "list",
        items: [
          "Seven providers. Free: Ollama (local), Cerebras, OpenRouter, Mistral, Together AI. Paid: Anthropic Claude, Google Gemini.",
          "Per-role model selection: supervisor (routing), composer (specialist findings), synthesizer (final answer).",
          "Generation defaults: temperature (0 to 2) and max tokens.",
          "LangSmith tracing toggle (needs a LANGSMITH_API_KEY to actually trace).",
          "A COACH_LLM_PROVIDER env var, when set, overrides the dashboard provider (keeps evals pinned to one provider).",
        ],
      },
      { type: "link", href: "/admin", label: "Open the admin dashboard" },
    ],
  },
  {
    id: "clear",
    audience: "operators",
    title: "Clearing the knowledge base",
    blocks: [
      {
        type: "p",
        text: "kb:clear deletes coach_kb rows. Useful when retiring old fixtures or switching embedding backends before a fresh seed.",
      },
      {
        type: "code",
        code: "pnpm kb:clear --all                # wipe everything\npnpm kb:clear nutrition_kb workout_kb   # specific namespaces",
      },
    ],
  },
  {
    id: "adding-content",
    audience: "operators",
    title: "Adding content: a fresh install vs. existing data",
    blocks: [
      {
        type: "p",
        text: "A fresh install, or a brand-new namespace: point the env var at your source directory, ingest, then seed the whole namespace.",
      },
      {
        type: "code",
        code: '# .env.local: INGEST_WORKOUT_DIRS="/path/to/your/pdfs"\npnpm kb:ingest             # writes kb-fixtures/private/workout_kb.json\npnpm kb:seed workout_kb    # embeds + inserts the whole namespace',
      },
      {
        type: "p",
        text: "Adding to a namespace that already has data: drop the new PDFs into that namespace's directory, append (existing rows stay put), then seed (resume embeds only the appended tail).",
      },
      {
        type: "code",
        code: "pnpm kb:ingest --append    # adds only new files to the JSON tail\npnpm kb:seed workout_kb    # resume embeds only the new rows",
      },
      {
        type: "p",
        text: "Append matches already-ingested files by their source label, so it is safe to re-run. Do not use a plain kb:ingest (without --append) to add content: it rebuilds the JSON from scratch and can shift positions, desyncing it from rows already embedded.",
      },
    ],
  },
  {
    id: "adding-agent",
    audience: "operators",
    title: "Adding or removing a specialist",
    blocks: [
      {
        type: "p",
        text: "A specialist is a knowledge-base namespace plus a small subgraph. The Corrective Exercise specialist was added exactly this way. Adding one touches a handful of files:",
      },
      {
        type: "list",
        items: [
          "src/state.ts: add the name to the Agent union and a slot in FindingsMap.",
          "src/agents/supervisor/routing.schema.ts: add it to AgentEnum; supervisor.node.ts: describe its domain in the routing prompt.",
          "src/agents/<name>/: retrieval.ts (its own <name>_kb namespace), prompts.ts, and subgraph.ts (retrieve then compose, plus tools if it needs any).",
          "src/graph.ts: register the node, add it to the fan-out targets and the SPECIALISTS list, and add an edge from it to synthesize.",
          "src/synthesizer/synthesize.ts: include it in the findings loop.",
          "src/app/coach/page.tsx: add it to IMPLEMENTED and the intro copy.",
          "Content: add an INGEST_<NAME>_DIRS row to scripts/ingest-kb.mjs, set that env var, then run kb:ingest and kb:seed <name>_kb.",
        ],
      },
      {
        type: "p",
        text: "Removing a specialist is the reverse: delete its agent directory, drop it from the Agent union, routing schema, graph, synthesizer, and UI, and clear its rows with pnpm kb:clear <name>_kb.",
      },
    ],
  },
];

/** All searchable text for a section: title + every block's text. */
export function sectionSearchText(section: GuideSection): string {
  const parts: string[] = [section.title];
  for (const block of section.blocks) {
    if (block.type === "p") parts.push(block.text);
    else if (block.type === "list") parts.push(block.items.join(" "));
    else if (block.type === "code") parts.push(block.code);
    else if (block.type === "link") parts.push(block.label);
  }
  return parts.join(" ").toLowerCase();
}
