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
        text: "The coach is grounded in NASM study materials: the Certified Personal Trainer (CPT), Certified Nutrition Coach (CNC), and Corrective Exercise Specialist (CES) curricula. Answers cite real passages from those sources rather than relying on generic model knowledge.",
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
          "Nutrition: diet, macros, protein, calories, supplements, eating patterns, fasting. Grounded in NASM CNC.",
          "Workout: strength training, cardio, exercise programming, progression, periodization. Grounded in NASM CPT.",
          "Recovery: sleep, HRV, rest days, stress, and readiness.",
          "Corrective Exercise: movement assessment, postural imbalances, mobility, flexibility, SMR / foam rolling, and region-specific corrective strategies. Grounded in NASM CES.",
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
        text: "Each run shows the supervisor's routing rationale, which specialists were consulted (with timings), and the synthesized answer. Citations are grouped per specialist and toggled open under the answer, so you can see the NASM source label behind each claim.",
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
        text: "The repo ships kb-fixtures/ empty. You supply the knowledge base: either hand-written { source, content } JSON files, or PDFs you ingest. The author's instance is grounded in NASM CPT, CNC, and CES PDFs.",
      },
      {
        type: "p",
        text: "Because NASM materials are copyrighted (licensed for personal study), they live in a gitignored kb-fixtures/private/ directory and are never committed. The app is single-admin, so that content stays private to the operator's database.",
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
        text: "kb:ingest extracts text from the PDF directories listed in scripts/ingest-kb.mjs (NASM nutrition -> nutrition_kb, CPT -> workout_kb, CES -> corrective_kb), chunks it, and writes kb-fixtures/private/<namespace>.json. Use --append to add new PDFs to a finished namespace without disturbing existing rows.",
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
