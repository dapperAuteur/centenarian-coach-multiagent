# Module 0 · Lesson 1 — Course overview & the single-artifact promise

> **Tag:** `course/lesson-01` · **Module 0: Setup + scope** · ~3.5 min

## What you will build

One artifact, start to finish: the **Centenarian Coach**. You ask it a health
question. A *supervisor* classifies the question and decides which domain
specialists to consult — nutrition, workout, recovery — and each specialist
answers from **its own retrieval store**, then a synthesizer weaves the findings
into one cited answer.

That last detail is the spine of the course. Retrieval-augmented generation grounds
a model's output in retrieved documents instead of its parameters alone (Lewis et
al., 2020). Most multi-agent tutorials give every agent the *same* global tool and
retrieval set; here, **each specialist owns its own namespace**, and they cannot
read each other's sources. Multi-agent systems coordinate specialized agents that
each hold a narrower competence (Wu et al., 2023), and per-agent retrieval is how
you make that competence real rather than cosmetic.

## Why grounding is the point, not a feature

This is a health and longevity domain. The recommendations are the kind that
have actual evidence behind them — for example, that older adults need more
dietary protein per kilogram of bodyweight than younger adults to preserve muscle
(Bauer et al., 2013). Large language models, left ungrounded, produce fluent text
that is confidently wrong; hallucination is a well-documented failure mode of
natural-language generation (Ji et al., 2023). A coach that invents a protein
target is worse than useless. So every answer this system gives **carries citations
to the snippets it was built from**, and in Module 4 you will write an evaluator
that scores whether each claim is actually traceable to a source.

## The single-artifact promise

Every lesson contributes to the same coach. Concretely:

- **By the end of Module 0**, the coach runs locally — you seed a corpus, ask a
  question, and read the answer plus its LangSmith trace.
- **Modules 1–3** build the architecture: the supervisor, then the specialists,
  each with its own retrieval namespace and isolated state.
- **Module 4** makes evaluation part of the artifact — routing, citation, and
  grounding evaluators, plus a dataset that grows as you find bugs.
- **Module 5** deploys it to LangGraph Platform.
- **Module 6** turns the coach into a launching pad: how to add a *new* specialist,
  worked with the repo's fourth (`corrective`) agent, plus extensions you can take
  on yourself.

There is no separate "now rebuild this on an unrelated domain" exercise. One thing,
built well, that you can extend.

## The tools you will use

The coach is built on the LangChain ecosystem: **LangGraph** for the supervisor and
specialist subgraphs (LangChain, 2025a), **LangSmith** for tracing and evaluation
(LangChain, 2025b), **pgvector** for per-namespace vector retrieval (pgvector,
2025), Drizzle ORM over Postgres, and Zod for the routing schema. You will touch
each one in the module where it earns its place — there is no standalone "tools
tour."

## How to navigate

- Lessons live in [`docs/course/`](../README.md); read each alongside the files it
  names in the repo.
- The branch carries a tagged commit per lesson. To start any lesson from a clean
  state: `git checkout course/lesson-N`.
- The next two lessons get you set up — TypeScript first (the artifact's language),
  then a Python translation reference — and Lesson 4 is the first-run smoke test.

## References

Bauer, J., Biolo, G., Cederholm, T., Cesari, M., Cruz-Jentoft, A. J., Morley, J. E., Phillips, S., Sieber, C., Stehle, P., Teta, D., Visvanathan, R., Volpi, E., & Boirie, Y. (2013). Evidence-based recommendations for optimal dietary protein intake in older people: A position paper from the PROT-AGE Study Group. *Journal of the American Medical Directors Association, 14*(8), 542–559. https://doi.org/10.1016/j.jamda.2013.05.021

Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., Ishii, E., Bang, Y. J., Madotto, A., & Fung, P. (2023). Survey of hallucination in natural language generation. *ACM Computing Surveys, 55*(12), 1–38. https://doi.org/10.1145/3571730

LangChain. (2025a). *LangGraph documentation*. https://langchain-ai.github.io/langgraphjs/

LangChain. (2025b). *LangSmith documentation*. https://docs.langchain.com/langsmith

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems* (Vol. 33, pp. 9459–9474). Curran Associates.

pgvector. (2025). *pgvector: Open-source vector similarity search for Postgres* [Computer software]. GitHub. https://github.com/pgvector/pgvector

Wu, Q., Bansal, G., Zhang, J., Wu, Y., Li, B., Zhu, E., Jiang, L., Zhang, X., Zhang, S., Liu, J., Awadallah, A. H., White, R. W., Burger, D., & Wang, C. (2023). *AutoGen: Enabling next-gen LLM applications via multi-agent conversation* (arXiv:2308.08155). arXiv. https://doi.org/10.48550/arXiv.2308.08155

---

Next: **[Lesson 2 — Getting set up (TypeScript)](./02-getting-set-up-typescript.md)** · [Course index](../README.md)
