# Video scripts · On-camera intro + outro

> Verbatim narration and shot directions for the two on-camera bookends. The intro
> also serves as the landing-page embed (PRD section 7). On-camera segments use a
> teleprompter; keep them tight. Pace ~150 wpm. No em-dashes in any on-screen text.
> See [`../production-guide.md`](../production-guide.md) for the recording stack.

---

## Intro (on-camera) · ~1.5 min · doubles as the landing-page embed

**NARRATION (verbatim)**

> Most AI coaches are one big prompt pretending to be an expert in everything. Ask a
> cross-domain question and the answer goes shallow. This course builds the
> alternative.
>
> You are going to build Fit T. Cent 3.0, a longevity coach that is actually a team.
> A supervisor reads your question and routes it to the specialists that matter:
> nutrition, workout, recovery. And here is the part no other project course
> teaches. Each specialist has its own retrieval store. Nutrition cannot see the
> workout documents. Workout cannot see recovery's. They stay specialized because
> they are isolated.
>
> This is a health domain, so a confident wrong answer is a real problem. Every
> answer the coach gives carries citations back to the sources it was built from,
> and you will write an evaluator that scores whether it is actually grounded.
>
> By the end you will have one thing, built end to end: a supervisor with per-agent
> retrieval, an evaluation suite that catches the failures you care about, a
> deployed graph, and a clear path to add your own specialist. It runs on LangGraph
> and LangSmith, with pgvector for retrieval.
>
> Let's get it running first. Then we will take it apart.

**SHOT / CAMERA**

1. On-camera, chest-up, rule of thirds. Lower-third: "Domain-Specialist Multi-Agent
   with Per-Agent RAG · Fit T. Cent 3.0".
2. On "every answer carries citations," cut to a 4 to 6 second screen B-roll: the
   coach answering a cross-domain question, citations visible, then the LangSmith
   trace tree (supervisor to specialists to synthesize). Narration continues over it.
3. Back to camera for "Let's get it running first."
4. Hold 1 second, cut.

---

## Outro (on-camera) · ~1 min

**NARRATION (verbatim)**

> That is the whole system. A supervisor that routes, specialists that each own
> their corpus, a synthesizer that weaves one cited answer, evaluation built in, and
> a deployment you can run for free.
>
> The coach was never the point. It is the worked example. You now have the shape to
> build your own domain-specialist system with per-agent retrieval, whatever your
> domain is.
>
> So here is your move: ship a specialist of your own. Pick a domain the coach does
> not cover, seed a namespace, copy the corrective specialist as your template, wire
> it into the graph, and add two eval examples. When that trace comes back green, you
> have done the entire thing this course teaches, on a domain that is yours.
>
> Every lesson has a git tag, so you can check out any starting state and follow
> along. Thanks for building with me. Go ship something.

**SHOT / CAMERA**

1. On-camera. On "ship a specialist of your own," cut to a 3 to 4 second screen
   B-roll: `git checkout course/lesson-25`, then the six-file diff of the corrective
   specialist.
2. Back to camera for the close.
3. Outro bumper: course title + the three-course portfolio frame + links
   (repo, live coach, LangSmith project). Hold 3 seconds.

---

## Notes

- Record both bookends in one sitting (same lighting/wardrobe) for consistency.
- The intro is the single most reused clip (landing page, social). Do extra takes.
- On-screen citations and file paths in the B-roll must match the merged repo.
