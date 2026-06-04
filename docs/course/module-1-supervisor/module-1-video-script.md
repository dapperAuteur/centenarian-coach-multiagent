# Video scripts · Module 1 (The supervisor)

> Verbatim narration + shot-by-shot screen-recording directions for lessons 5 to 8.
> Audience note: assume the viewer is new to agents and LangGraph. Gloss each term
> on first use, why before how. Screencast lessons: record against the lesson's
> `course/lesson-NN` tag. Pace ~140 wpm. `[cite: ...]` = on-screen citation, must
> match that lesson's `## References`. No em-dashes in any on-screen text.

---

## Lesson m1-l5 · Single-agent vs. multi-agent: when the complexity pays · tag `course/lesson-05` · ~6 min

**NARRATION (verbatim)**

> Quick orientation, because we are about to use a few words a lot. An *agent* is
> just a program that uses a language model to decide what to do. A *multi-agent*
> system is several of those working together. A *supervisor* is the one that reads
> your question and hands it to the right helper. The helpers are *specialists*.
>
> Now the real question of this lesson: when is multi-agent worth it? Because it is
> not free.
>
> Here is the problem one agent has. The early coach was a single prompt that tried
> to be a nutrition expert, a training expert, and a recovery expert all at once. Ask
> it something that crosses domains, like "I slept five hours, should I train legs
> today," and it has to juggle all three plus write the answer in one shot. The
> retrieval is worse: one search over one big pile of documents returns a blurry mix,
> and the model leans on whatever floated to the top. The model is not dumb. The
> architecture gave it no clean seam to divide the work. [cite: Wu et al., 2023]
>
> Splitting it into a supervisor plus specialists buys three concrete things.
> Isolated retrieval: nutrition searches only nutrition documents. Isolated tools:
> the nutrition helper has a calorie calculator, the workout helper does not.
> Attributable answers: each specialist cites its own sources, so you can see who
> said what. That last one matters most in a health domain.
>
> But here is the trap the tutorials skip. Every question now costs a supervisor
> call, a call per specialist, and a synthesizer call. If your specialists all read
> the same documents and use the same tools, you did not build a multi-agent system.
> You built one agent with extra network hops and a routing bug waiting to happen.
>
> So, a checklist before you split. Different knowledge sources? Different tools?
> Cross-domain questions often enough to need synthesis? Per-source attribution
> required? Two or more yeses, and multi-agent earns its cost. Mostly noes, and you
> are adding complexity that buys nothing.
>
> The coach is a clear yes on all four, which is why it is the right example for this
> pattern. Next, we build the supervisor.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-05`; editor open.
1. On the "one agent" problem, show a single long system prompt (a slide or a
   scratch file) trying to cover all domains; type the five-hours-of-sleep question.
2. On "three concrete things," open `src/graph.ts`; highlight the supervisor node,
   the specialist nodes, and the synthesize node.
3. On the anti-pattern, show a simple diagram: 4 specialists pointing at ONE shared
   doc store (the wrong way), with a red X.
4. On the checklist, show the four questions as on-screen bullets, one at a time.
5. Close on the coach's architecture diagram (`docs/architecture.md`).

---

## Lesson m1-l6 · Designing the routing schema with Zod · tag `course/lesson-06` · ~6 min

**NARRATION (verbatim)**

> The supervisor's whole job is to decide which specialists answer. The naive way is
> to ask the model in plain English, "which agents should handle this," and then
> read its sentence. That breaks constantly: it says "the Nutrition and Workout
> specialists" and now you are string-matching, or it invents an agent that does not
> exist.
>
> The fix is *structured output*. That means we hand the model a fixed shape, a
> *schema*, and require it to fill that shape instead of writing a sentence. In
> TypeScript we describe the shape with a library called Zod. [cite: Colinhacks, 2025]
>
> Look at `routing.schema.ts`. The agents field is an array drawn from a fixed list:
> nutrition, workout, recovery, corrective. Because the list is fixed, the model
> *cannot* return an agent that does not exist. Requiring at least one means it
> cannot route to nobody. There is a primary agent, a rewritten sub-question per
> specialist, and a one-sentence rationale. The shape is the contract. Those describe
> strings are not comments; they are sent to the model as instructions for each
> field. [cite: LangChain, 2025]
>
> Now the supervisor node in `supervisor.node.ts`. A *node* is just a function that
> takes the current state and returns an update. This one builds the model, binds it
> to the schema with `withStructuredOutput`, and calls it. What comes back is already
> typed as the schema. No parsing, no guessing. If the model's output does not fit
> the shape, it throws right here, loudly, instead of breaking three steps later.
>
> One more thing. A schema can enforce field types but not relationships between
> fields. It cannot say "the primary agent must be one of the chosen agents." So the
> node does that itself in a couple of lines after the call. Now every downstream
> node can fully trust the routing object.
>
> One gotcha worth remembering, especially if you swap model providers: a schema that
> works on one provider can fail on another. This repo hit it when a Zod rule
> compiled to something Gemini's structured output rejected. Keep router schemas
> simple. Next, why the supervisor always runs first.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-06`.
1. Show the "prose routing" failure: a model reply like "the Nutrition and Workout
   specialists" and a brittle string-match (scratch snippet), red X.
2. Open `src/agents/supervisor/routing.schema.ts`; zoom on `AgentEnum`, `agents`
   `.min(1)`, `primaryAgent`, `subQuestions`, `rationale`. Highlight a `.describe(...)`.
3. Open `src/agents/supervisor/supervisor.node.ts`; highlight `withRoleFallback(...)`
   + `.withStructuredOutput(RoutingSchema, { name: "route_to_specialists" })` and the
   `.invoke([...])` call.
4. Highlight the normalize block (dedupe `agents`, force `primaryAgent` into the set).
5. Briefly show the README "A real bug I caught" note on the Gemini schema subset.

---

## Lesson m1-l7 · The topology-enforces-ordering rule · tag `course/lesson-07` · ~5 min

**NARRATION (verbatim)**

> "The supervisor runs before any specialist, and the synthesizer runs last." In a
> lot of agent code that is a hope. We are going to make it a guarantee, by the shape
> of the graph itself.
>
> A LangGraph *graph* is nodes connected by *edges*, and execution follows the edges.
> Look at `graph.ts` and read the edges, not the intentions. START goes only to the
> supervisor, so there is no path that reaches a specialist before the supervisor has
> produced its routing decision. The specialists are reachable only through the edge
> coming out of the supervisor. And every specialist's only exit is to the
> synthesizer, whose only exit is the end. So the synthesizer cannot run before the
> specialists, and nothing runs after it. The order is not enforced by discipline. It
> is enforced because no other order can even be expressed in this graph.
> [cite: LangChain, 2025]
>
> A guarantee you do not test is a guarantee you only believe. So `topology.test.ts`
> proves it. It mocks the model and retrieval, which just means it swaps in fake
> versions so the test runs with no API keys and no cost. Then it streams the graph
> and records the order each node finishes in, and asserts: supervisor first,
> synthesizer last, every specialist in between. It checks this for a single
> specialist and for a full fan-out, so the rule holds no matter how many specialists
> run. [cite: Vitest, 2025]
>
> Why care beyond tidiness? Two reasons. Trust: because the order is structural,
> every node can assume the state it needs already exists. And debugging: when a
> multi-agent system misbehaves, "did it run in the right order" is the first
> question, and here the answer is a property you can test, not a behavior you have to
> reproduce. Next, how the supervisor hands work to several specialists at once.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-07`.
1. Open `src/graph.ts`; trace the edges with the cursor: `START -> supervisor`, the
   conditional edge out of supervisor, each specialist `-> synthesize`,
   `synthesize -> END`. Draw the arrows as an overlay if your editor allows.
2. Open `tests/topology.test.ts`; highlight the `stream(..., { streamMode: "updates" })`
   loop that records node order and the assertions (first/last/between).
3. Terminal: `pnpm test tests/topology.test.ts`; show it pass green.
4. Optional: in a scratch copy, add a bad edge (specialist back to supervisor),
   re-run, show the ordering assertion catch it. Revert.

---

## Lesson m1-l8 · Conditional fan-out + temperature-0 as classification · tag `course/lesson-08` · ~5 min

**NARRATION (verbatim)**

> Two small decisions give the supervisor most of its power. First, how it hands work
> to the specialists.
>
> The supervisor produced a list of agents. A *conditional edge* turns that list into
> action. In `graph.ts`, `routeToSpecialists` reads the chosen agents and returns
> them as an array of node names. Returning an array is the whole trick: it tells
> LangGraph to *fan out*, which just means run all of those specialists at the same
> time, in parallel. [cite: LangChain, 2025] A single-domain question returns one
> name, one specialist runs. A cross-domain question returns two, both run at once. A
> question that matches nothing routes straight to the synthesizer, so the graph fails
> gracefully instead of dead-ending. And notice: adding a fifth specialist later does
> not change this function. The fan-out width is data, not code.
>
> Second decision: the supervisor runs at *temperature zero*. Temperature is the
> model's randomness dial. Turn it down to zero and the model becomes about as
> deterministic as it gets, it makes the same choice for the same input every time.
> [cite: Holtzman et al., 2020] Routing is a classification, not a creative task, so
> you want it boring and repeatable. Three payoffs: the same question routes the same
> way every time; you can write a test that asserts a nutrition question routes to
> nutrition only, which is meaningless if the router wanders; and when a route is
> wrong, it is wrong the same way every time, so you can actually reproduce and fix
> it.
>
> Save the randomness for the specialists writing prose, where a little variation
> reads as natural language. The supervisor is the one node that should be boring.
> That is the whole supervisor. Next module, we build the first specialist and give
> it its own knowledge base.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-08`.
1. Open `src/graph.ts`; highlight `routeToSpecialists` returning a string array and
   the `addConditionalEdges("supervisor", routeToSpecialists, [...])` call.
2. Ask a cross-domain question in the running app; open the LangSmith trace; show two
   specialist nodes running side by side (the fan-out). Point at the routing
   `agents` array.
3. Open `supervisor.node.ts`; highlight `temperature: 0`.
4. Optional: ask the same question twice at temp 0, show identical routing; mention
   (do not necessarily demo) that raising temperature would make it flicker.

---

## Module 1 runtime check

l5 6 + l6 6 + l7 5 + l8 5 = ~22 min. Trim narration, not demos.
