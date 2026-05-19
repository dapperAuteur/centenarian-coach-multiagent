# Lessons — the supervisor + specialist pattern

A five-lesson walkthrough of the architecture behind the Centenarian Coach.
Each lesson explains one design decision, shows the code in this repo, and ends
with a **build-this-yourself** exercise that applies the pattern to a different
domain — a SaaS customer support desk with Billing, Technical, and Account
specialists — so the pattern transfers.

1. **[Single-agent vs. multi-agent](./01-single-vs-multi-agent.md)** — when the
   extra complexity pays, and the routing-for-routing's-sake anti-pattern.
2. **[Supervisor routing](./02-supervisor-routing.md)** — a structured,
   schema-typed routing decision returned before any specialist runs.
3. **[Per-agent retrieval](./03-per-agent-retrieval.md)** — why each specialist
   owns its own pgvector namespace.
4. **[State passing](./04-state-passing.md)** — sharing state across nested
   subgraphs without parallel specialists stomping on each other.
5. **[Evals](./05-evals.md)** — building a LangSmith eval dataset that catches
   routing and grounding failures (implementation ships in v2).

Work them in order — each builds on the last, and the support-desk exercise
carries through all five.
