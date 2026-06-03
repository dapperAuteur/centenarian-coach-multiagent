# Module 6 · Lesson 28 · Capstone: ship your own specialist

> **Tag:** `course/lesson-28` · **Module 6: Extension launching pad** · ~3 min

You built one artifact end to end. Here is the whole arc in one breath, and then
the capstone that proves you own it.

## What you built

- **A supervisor** that returns a typed routing decision before anything runs, with
  ordering guaranteed by the graph's structure (Module 1).
- **Specialists with per-agent RAG**: each owns a namespace, retrieves only its own
  corpus, and is isolated from the others by type, not by prompt (Modules 2 to 3).
- **A synthesizer** that is the one node allowed to read every finding, weaving a
  single cited answer (Module 3).
- **Evaluation built in**: routing, citation, and grounding evaluators, run as a
  CI gate and as tracked LangSmith experiments, against a dataset that grows as you
  find bugs (Module 4).
- **A deployable graph**, observable from the first run, runnable for free with no
  Docker (Module 5).
- **A launching pad**: adding a specialist is a six-point, contained change
  (Module 6).

That is the project-tier promise: not a snippet, but a coach you can run, evaluate,
deploy, and extend.

## Use the tags

Every lesson has a tag. To revisit any starting state, check it out:

```bash
git checkout course/lesson-09   # the start of per-agent retrieval
git checkout course/lesson-25   # the start of "add a new specialist"
```

The diff between two lesson tags is exactly that lesson's work, which is the
fastest way to see "what changed and why" for any concept in the course.

## The capstone

Ship a specialist of your own, end to end, using the Lesson 25 checklist and the
Lesson 27 discipline:

1. Pick a domain Fit T. Cent 3.0 does not cover (Mindset, Labs, Mobility, anything).
2. Seed a small `*_kb` namespace for it.
3. Copy `src/agents/corrective/` as your template, point its retrieval at the new
   namespace, and wire its compose step.
4. Add it to the `Agent` union, the routing schema, the supervisor prompt, and the
   graph.
5. Add two eval examples (one pure-domain, one cross-domain) and run `pnpm eval`.
6. Open the trace and watch the supervisor route to your specialist.

When that trace is green and your eval passes, you have done the entire thing the
course teaches, on a domain that is yours. That is the launching pad: the coach was
never the destination, it was the worked example for building your own
domain-specialist multi-agent system with per-agent RAG.

## References

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems* (Vol. 33, pp. 9459–9474). Curran Associates.

Wu, Q., Bansal, G., Zhang, J., Wu, Y., Li, B., Zhu, E., Jiang, L., Zhang, X., Zhang, S., Liu, J., Awadallah, A. H., White, R. W., Burger, D., & Wang, C. (2023). *AutoGen: Enabling next-gen LLM applications via multi-agent conversation* (arXiv:2308.08155). arXiv. https://doi.org/10.48550/arXiv.2308.08155

---

Previous: [Lesson 27 · Extending the eval suite](./27-extending-the-eval-suite.md) · **End of the course.** · [Course index](../README.md)
