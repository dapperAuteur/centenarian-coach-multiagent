# Video scripts · Module 4 (LangSmith evaluation)

> Verbatim narration + shot-by-shot screen-recording directions for lessons 16 to
> 20. Audience note: first-time viewers; gloss each term on first use, why before
> how. Record against the lesson's `course/lesson-NN` tag. Pace ~140 wpm.
> `[cite: ...]` = on-screen citation matching that lesson's `## References`. Optional
> demos are explicit `BONUS FOOTAGE (optional)` blocks. No em-dashes on screen.

---

## Lesson m4-l16 · Why multi-agent systems fail quietly + what to evaluate · tag `course/lesson-16` · ~5 min

**NARRATION (verbatim)**

> A multi-agent system fails quietly, and that is the dangerous part. A misrouted
> question still produces a confident, fluent answer. A paragraph with no supporting
> source looks exactly like one that has support. Nothing throws an error. You only
> find out when a user does. Language models are fluent by default and will produce
> plausible but unsupported text when they are not grounded. [cite: Ji et al., 2023]
>
> So we evaluate. An evaluator is just a function that looks at a run and returns a
> score. The trick for a coach like this is to measure the three things that fail
> independently, separately.
>
> One, routing accuracy. Did the supervisor consult the right specialists? Two,
> citation coverage. Does every specialist finding carry at least one citation, and
> does the final answer? Three, grounding. Is the answer actually supported by the
> retrieved sources, or did the model add facts no source backs?
>
> Routing and citation coverage you can check with plain code. Grounding needs a
> judge, usually a model scoring the answer against its sources. [cite: Zheng et al.,
> 2023] The next three lessons build exactly these three.
>
> And here is why you keep them as three numbers, not one blended quality score: the
> split tells you where to look. Low routing but high grounding means the specialists
> are good and the supervisor is sending them the wrong questions. High routing but
> low grounding means the right specialist is answering, just not from its sources.
> Three numbers point at the broken part. One number hides it.
>
> Evaluation is part of the artifact here, not a report you run once. It is wired to
> a gate that fails a bad change, and to a dataset that grows as you find bugs. That
> difference is the whole module.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-16`.
1. Show a confidently-wrong example: ask a question, get a fluent answer, then reveal
   (in the trace) that it routed to the wrong specialist. Nothing errored.
2. On-screen bullets, the three axes: routing accuracy, citation coverage, grounding.
3. A 2x2-style on-screen note: low-routing/high-grounding vs high-routing/low-grounding,
   and what each points at.
4. Open `evals/` in the editor; show `dataset.json` + `rubric.ts` exist (preview of
   the next lessons).

---

## Lesson m4-l17 · Deterministic evaluators: routing and citation · tag `course/lesson-17` · ~6 min

**NARRATION (verbatim)**

> Two of the three are checkable with plain code, no model needed, so they are the
> cheapest and most reliable part of the suite and they run on every change. They
> live in `evals/rubric.ts`, and they are pure functions: no API, no network.
>
> Routing accuracy is an exact-set match. It compares the specialists the supervisor
> chose against the specialists the example says it should have chosen, as a set, so
> order does not matter. On a miss, it reports what it expected and what it got, so a
> failing eval doubles as a bug report. This only works because routing is
> deterministic, the temperature-zero rule from Module 1: the same question routes the
> same way every run, so a zero is a real defect, not noise.
>
> Citation coverage encodes the design's promise: every specialist finding carries at
> least one citation, and the final answer carries citations. It does not check
> whether the citations are good, that is grounding, the next lesson. It checks they
> are present. Cheap, binary, and exactly the kind of thing a refactor can quietly
> break. [cite: LangChain, 2025]
>
> The gate is pnpm eval. It runs both evaluators across the dataset and fails if mean
> routing accuracy drops below eighty percent or citation coverage below ninety. It
> makes a real graph call per example, so it is opt-in, you set RUN_EVALS, and it
> stays out of the fast default test run. But the evaluators themselves have plain
> unit tests that run every time, so they are always protected. A pull request that
> drops routing accuracy should fail this gate, not surprise a user. That regression
> gate is the entire point. [cite: Zheng et al., 2023]

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-17`.
1. Open `evals/rubric.ts`; highlight `routingScore` (the sorted set compare + the
   `comment` on a miss) and `citationScore` (every finding cited + the final answer).
2. Terminal: `pnpm test evals.rubric.test.ts` (fast, no keys); show green.
3. Open `tests/coach.eval.test.ts`; highlight the two thresholds
   (`>= 0.8`, `>= 0.9`) and the `RUN_EVALS` gate.
4. Terminal (keys set): `pnpm eval`; show the per-question table + the summary.

---

## Lesson m4-l18 · The LLM-judge grounding evaluator · tag `course/lesson-18` · ~7 min

**NARRATION (verbatim)**

> Routing and citation you can check with code. Grounding you cannot. Whether every
> claim in an answer is actually backed by a retrieved snippet is a judgement call,
> and the practical way to score it at scale is to ask a model. That is the
> LLM-as-judge approach. [cite: Zheng et al., 2023] For a health coach this is the
> evaluator that matters most: a fluent answer built on facts no source supports is
> the exact failure the whole citation discipline exists to catch.
>
> The grounding evaluator lives in `evals/grounding.ts`, deliberately separate from
> the pure rubric so that file stays API-free. It gathers the snippets the
> specialists retrieved, hands them plus the final answer to a judge, and asks for a
> structured verdict: a score from zero to one, and a list of the unsupported claims.
>
> Three choices make the judge trustworthy. One, temperature zero, the same rule as
> the supervisor: the judge is a classifier, not a writer, so the same answer scores
> the same way every run. Two, a tight rubric: the prompt tells it to compute
> supported claims over total claims and to be conservative when a claim is not
> clearly backed. A vague rate-the-quality judge is noise; a specific, mechanical one
> is repeatable. Three, a gradient, not pass-or-fail: zero to one, plus the list of
> unsupported claims, which is the difference the iteration loop moves. Fractional
> faithfulness scores are the established way to evaluate retrieval-augmented answers.
> [cite: Es et al., 2024]
>
> The same function runs two ways: locally, opt-in with RUN_GROUNDING, which prints a
> mean grounding score; and in LangSmith, as an evaluator, the next lesson. Because it
> returns the unsupported claims, a low score is also a list of the exact sentences to
> investigate. One caution: a judge can share blind spots with the model it grades, so
> treat the score as a strong signal that pairs with a human read, not an oracle.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-18`.
1. Open `evals/grounding.ts`; highlight the Zod schema (`score`, `unsupportedClaims`),
   `temperature: 0`, and the snippets-plus-answer prompt.
2. Terminal (keys set): `RUN_GROUNDING=1 pnpm eval`; show the per-example grounding
   score + the mean.
3. Find the lowest-scoring example; read its `unsupportedClaims` aloud, that is your
   to-do list.

---

## Lesson m4-l19 · Running evals in LangSmith · tag `course/lesson-19` · ~6 min

**NARRATION (verbatim)**

> pnpm eval gives you a pass-or-fail gate. It does not give you history: which
> questions regressed since last week, how two models compare, or the trace behind a
> low score. That is what LangSmith adds. The same evaluators, run as tracked
> experiments you can open, diff, and click into.
>
> The runner is `evals/run-langsmith.ts`. It pushes the dataset to LangSmith, then
> calls evaluate over the live graph with the very same evaluators from the last two
> lessons. Two things to notice. The routing and citation evaluators are thin wrappers
> around the same pure functions the local gate uses, so there is no second copy of
> the scoring logic to drift. And it runs at low concurrency, to be gentle on a free
> model's rate limit. You run it with pnpm eval colon langsmith, and it needs a
> LangSmith key. [cite: LangChain, 2025]
>
> pushDataset creates a dataset named centenarian-coach from dataset dot json,
> mapping each question to the input and the expected agents to the reference output.
> It is idempotent: if the dataset exists, it reuses it.
>
> So why keep both runners? pnpm eval is the cheap, dependency-free gate that blocks a
> bad pull request. pnpm eval colon langsmith is where you go to understand a result:
> open the experiment, sort by grounding, click the worst run, and read the actual
> trace, the tracing from Module zero, now attached to a scored example. The gate
> tells you something broke. The experiment tells you what and why.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-19`; `LANGSMITH_API_KEY` set.
1. Open `evals/run-langsmith.ts`; highlight `pushDataset`, the `evaluate(...)` call
   with the three evaluators, `maxConcurrency`, and the `metadata: { provider }`.
2. Terminal: `pnpm eval:langsmith`; show the printed experiment URL.
3. Open the experiment in LangSmith; sort by grounding; click the lowest run; follow
   its trace from supervisor to the specialist `retrieve` node.

---

## Lesson m4-l20 · The iteration loop and the growing dataset · tag `course/lesson-20` · ~4 min

**NARRATION (verbatim)**

> The evaluators are half the system. The other half is the loop they feed: find a
> bug, add an example that pins it, re-run. A dataset that grows every time you find a
> failure is the difference between evals you run once and evals that get sharper as
> the system ages.
>
> The loop, concretely. One, you spot a failure, in pnpm eval output, a low grounding
> score, or a trace. Two, you add one example to dataset dot json, tagged with where
> it came from and why, using the addedIn and note fields. Three, you re-run, the gate
> and the tracked experiment now include it, and you fix the prompt or retrieval until
> it passes without breaking the rest.
>
> Those addedIn and note fields are the dataset's memory. The original examples are
> the baseline; everything added later says which bug introduced it. This course's own
> dataset already grew this way: three regression examples were added during the
> build, a sleep-plus-tightness question that was misrouting, a postural question
> leaking away from the corrective specialist, and a three-domain question that
> dropped nutrition. Each is a bug someone found, written down so it can never
> silently come back. [cite: LangChain, 2025]
>
> That is the rubric criterion this module exists for: evaluation built into the
> artifact, with a dataset that grows as bugs are found. Module 6 returns to this:
> when you extend the system, you extend the evals with it.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-20`.
1. Open `evals/dataset.json`; scroll to the tagged regression examples (`wr3`, `c1`,
   `nwr4`); highlight their `addedIn` + `note` fields.
2. Open `evals/rubric.ts`; show the optional `addedIn?` / `note?` on `EvalExample`.
3. **BONUS FOOTAGE (optional).** Run the loop live:
   a. Ask a question you suspect routes wrong; confirm the miss in the trace.
   b. Append one tagged example to `dataset.json` (`addedIn`, `note`).
   c. Re-run `pnpm eval`; show the example now counted in the totals.

---

## Module 4 runtime check

l16 5 + l17 6 + l18 7 + l19 6 + l20 4 = ~28 min.
