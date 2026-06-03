# Module 0 · Lesson 3 · Getting set up (Python) + language-translation table

> **Tag:** `course/lesson-03` · **Module 0: Setup + scope** · ~3 min

LangChain Academy's courses are usually taught in Python. **This course's artifact
is TypeScript**, one runnable coach, so every lesson can point at the real files
you deploy (that is what keeps the course honest). This lesson is the bridge for
Python-first learners: there is no second Python codebase to maintain, but the
concepts map cleanly, and LangGraph ships in both languages with the same mental
model (LangChain, 2025a).

## If you want a Python environment alongside

You do not need Python to take this course. But if you want to follow the LangGraph
Python docs in parallel, or prototype a node in Python first:

```bash
python -m venv .venv && source .venv/bin/activate
pip install langgraph langchain-anthropic langsmith pydantic
```

Treat this as a Rosetta stone, not a fork. The coach you build, evaluate, and
deploy is the TypeScript repo.

## Translation table

| Concept | TypeScript (this repo) | Python (LangGraph) |
|---|---|---|
| Graph builder | `new StateGraph(CoachAnnotation)` | `StateGraph(CoachState)` |
| State definition | `Annotation.Root({ ... })` in `src/state.ts` | `TypedDict` + `Annotated[...]` |
| Channel reducer | `Annotation<T>({ reducer, default })` | `Annotated[T, reducer]` |
| Structured output | `model.withStructuredOutput(Schema, { name })` | `model.with_structured_output(Schema)` |
| Schema library | **Zod** (`routing.schema.ts`) | **Pydantic** (Pydantic, 2025) |
| Chat model | `new ChatAnthropic({ ... })` | `ChatAnthropic(...)` |
| Add node / edge | `.addNode(...)` / `.addConditionalEdges(...)` | `.add_node(...)` / `.add_conditional_edges(...)` |
| Run | `await graph.invoke(state)` / `graph.stream(...)` | `graph.invoke(state)` / `graph.stream(...)` |
| Evaluation | `evaluate(target, { data, evaluators })` (`langsmith/evaluation`) | `evaluate(target, data=..., evaluators=...)` / `aevaluate(...)` |
| Tracing | `LANGSMITH_API_KEY` + `configureLangSmith()` | `LANGSMITH_API_KEY` env (auto) |

The shapes match because LangGraph models the same thing in both languages: a state
graph with typed channels, reducers that merge concurrent writes, and conditional
edges for routing (LangChain, 2025a). The two places the languages diverge in this
course are the schema library (Zod vs. Pydantic, both produce JSON Schema for
structured output) and the evaluation SDK surface, which is `evaluate` in the
JavaScript `langsmith` package and `evaluate`/`aevaluate` in the Python one
(LangChain, 2025b).

## Why the artifact stays TypeScript

A single runnable artifact lets every lesson cite a real file path you can open and
a real trace you can inspect, and lets the branch tag one commit per lesson. A
parallel Python copy would double the surface that can drift out of sync with the
deployed coach. So Python here is a reference, and the rest of the course works the
TypeScript repo directly.

## References

LangChain. (2025a). *LangGraph documentation: Concepts (Python and JavaScript)*. https://langchain-ai.github.io/langgraph/

LangChain. (2025b). *LangSmith documentation: Evaluation*. https://docs.langchain.com/langsmith/evaluation

Pydantic. (2025). *Pydantic documentation*. https://docs.pydantic.dev/

---

Previous: [Lesson 2 · Getting set up (TypeScript)](./02-getting-set-up-typescript.md) · Next: **[Lesson 4 · First-run smoke test](./04-first-run-smoke-test.md)** · [Course index](../README.md)
