# Video scripts · Module 6 (Extension launching pad)

> Verbatim narration + shot-by-shot screen-recording directions for lessons 25 to
> 28. Audience note: first-time viewers; gloss terms on first use. Record against the
> lesson's `course/lesson-NN` tag. Pace ~140 wpm. `[cite: ...]` = on-screen citation
> matching that lesson's `## References`. No em-dashes on screen.

---

## Lesson m6-l25 · How to add a new specialist (worked with Corrective) · tag `course/lesson-25` · ~5 min

**NARRATION (verbatim)**

> This is the lesson the whole course was building toward: not another feature, but the
> shape of adding one. The coach ships a fourth specialist, Corrective Exercise, that
> you have not studied yet. We use it as the worked example, because adding it touched
> exactly six places and nothing else. That containment is the payoff of every isolation
> decision in Modules 1 through 3.
>
> The six-point checklist. One, a namespace and a corpus: documents seeded into
> corrective_kb. Two, a retrieval module that passes that namespace, one word different
> from nutrition's. Three, a subgraph with its own state that has no findings channel,
> so isolation is free, and an adapter that writes only its own findings slot. Four, add
> the agent name to the type union. Five, add it to the routing schema and one line to
> the supervisor's prompt. Six, register it in the graph: add the node, the fan-out
> target, and the edge to the synthesizer. [cite: LangChain, 2025]
>
> That is the entire diff. The synthesizer already loops over all agents, so it picked up
> corrective with no change. The merge reducer already handles a new findings key. The
> topology test already asserts ordering for any specialist.
>
> And corrective is the simplest specialist on purpose: its graph is just retrieve then
> compose, no assess and no tools, because the v1 corrective agent has no calculator to
> call. That shows the template flexes: tools and an assess step are optional. Every
> earlier module removed a reason this would be hard, namespacing, type isolation, the
> merge reducer, the eval suite. The system was designed to be extended, and this
> checklist is the proof. [cite: Saltzer & Schroeder, 1975]

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-25`.
1. On-screen, the six-point checklist as bullets.
2. Open the corrective files: `src/agents/corrective/retrieval.ts` (the `corrective_kb`
   namespace), `subgraph.ts` (no `findings` channel; `retrieve -> compose -> END`), and
   the `correctiveNode` adapter writing `{ findings: { corrective: ... } }`.
3. Open `src/graph.ts`; show `correctiveNode` registered (node + fan-out target + edge).
4. In a LangSmith trace, ask a postural question ("my shoulder rounds forward when I
   press overhead"); show the supervisor route to `corrective` and the
   `retrieve -> compose` subgraph run.

---

## Lesson m6-l26 · Five extensions, with starting file paths · tag `course/lesson-26` · ~5 min

**NARRATION (verbatim)**

> Now-go-build is useless advice. Here are five concrete extensions, each with the file
> you open first and an honest difficulty.
>
> One, a new specialist, easy. The checklist from the last lesson, applied to a domain
> you care about, mindset, labs, mobility. Start by copying the corrective folder, it is
> the minimal template.
>
> Two, stream partial findings to the UI, medium. The app already streams an event as
> each specialist finishes. Extend it to stream within a specialist, token by token.
> Start in the query route's stream loop.
>
> Three, conversation memory across turns, medium. The coach answers one question per
> session today. Add a LangGraph checkpointer, which is built-in persistence, so a
> follow-up sees the prior turn. Start at the graph's compile call. [cite: LangChain,
> 2025]
>
> Four, give a specialist a tool over MCP, medium to hard. MCP, the Model Context
> Protocol, is a standard way for a model to call external tools. Swap a specialist's
> local tool for an MCP client, say a real nutrition database. Start in a specialist's
> assess and tools nodes. [cite: Anthropic, 2024]
>
> Five, multi-tenant per-user state, hard. Take the coach from single-admin to many
> users: a user id on the state, per-user history, per-user namespaces. Start in the
> state and the schema.
>
> If you want to feel the architecture's leverage fastest, do the new specialist, it is
> a contained afternoon. Whatever you pick, the next lesson is non-negotiable: when you
> extend the system, extend the evals with it.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-26`.
1. On-screen table: the five extensions, each with its starting file path and a
   difficulty tag (easy / medium / hard).
2. Open the starting file for one or two (e.g. `src/agents/corrective/` as the template;
   `src/app/api/coach/query/route.ts` for streaming) so the viewer sees the entry point.

---

## Lesson m6-l27 · Extending the eval suite as you extend the system · tag `course/lesson-27` · ~3 min

**NARRATION (verbatim)**

> One rule keeps an extensible system from rotting as it grows: a new capability ships
> with the evals that pin it. Module 4 built the machinery; this is the discipline of
> using it every time.
>
> A specialist arrives with its eval examples. When corrective was added, the dataset
> gained examples for it: a corrective-only question, and a cross-domain one. Without
> them, the suite would happily report green while never once checking that a postural
> question routes to the new specialist. A specialist with no eval example is a
> specialist you are not testing. So the routine for any new specialist: add at least one
> pure-domain routing example and one cross-domain example, each tagged with addedIn and
> a note.
>
> The same holds for features. Add memory? Add an example that asks a follow-up and
> asserts the prior turn was used. Add an MCP tool? Add a question that should trigger it
> and assert the tool call appears. The evaluator goes in the suite, not in your memory.
> [cite: LangChain, 2025]
>
> An extensible architecture, plus built-in evaluation, plus this rule, is what makes the
> coach safe to keep changing. The dataset is the system's memory of how it has broken.
> Grow the system without growing the dataset and you are flying blind on everything you
> added after the last eval.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-27`.
1. Open `evals/dataset.json`; show the corrective examples (`c1`, `wr3`) that arrived
   with the specialist.
2. On-screen, the routine: a new specialist or feature ships with at least one
   routing/behavior example, tagged `addedIn` + `note`.

---

## Lesson m6-l28 · Capstone: ship your own specialist · tag `course/lesson-28` · ~3 min

**NARRATION (verbatim)**

> You built one artifact end to end. Here is the whole arc in one breath. A supervisor
> that returns a typed routing decision before anything runs, with ordering guaranteed by
> the graph's structure. Specialists with per-agent retrieval, each owning a namespace,
> isolated from the others by type, not by prompt. A synthesizer that is the one node
> allowed to read every finding and weave a single cited answer. Evaluation built in:
> routing, citation, and grounding, run as a gate and as tracked experiments, against a
> dataset that grows as you find bugs. A deployable graph, observable from the first run,
> runnable for free with no Docker. And a launching pad: adding a specialist is a
> six-point, contained change. [cite: Lewis et al., 2020]
>
> Every lesson has a git tag, so to revisit any starting state you check it out, for
> example git checkout course slash lesson nine for the start of per-agent retrieval. The
> diff between two lesson tags is exactly that lesson's work.
>
> Now the capstone: ship a specialist of your own. Pick a domain the coach does not
> cover. Seed a small namespace for it. Copy the corrective folder as your template, point
> its retrieval at the new namespace, wire its compose step, add it to the union, the
> routing schema, the supervisor prompt, and the graph. Add two eval examples and run pnpm
> eval. When that trace comes back green and your eval passes, you have done the entire
> thing this course teaches, on a domain that is yours. The coach was never the
> destination. It was the worked example for building your own domain-specialist
> multi-agent system with per-agent retrieval. [cite: Wu et al., 2023]

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-28`.
1. On-screen recap of the arc (supervisor, per-agent RAG, isolation, synthesizer, eval,
   deploy, extend) as a single diagram.
2. Terminal: `git checkout course/lesson-09` then `course/lesson-25` to show the
   checkout-any-lesson flow; mention `git diff course/lesson-N course/lesson-(N+1)`.
3. On-screen, the six-step capstone checklist; end on the outro bumper (see
   `../video/intro-outro-video-script.md`).

---

## Module 6 runtime check

l25 5 + l26 5 + l27 3 + l28 3 = ~16 min.
