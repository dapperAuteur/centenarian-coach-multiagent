# Module 2 · Lesson 11 — Building the first specialist subgraph (Nutrition)

> **Tag:** `course/lesson-11` · **Module 2: Specialist #1 (Nutrition)** · ~7 min

A specialist is not a prompt — it is a **small graph of its own**. This lesson
builds the Nutrition specialist, the template every other specialist follows.

## A specialist is a compiled sub-StateGraph

[`src/agents/nutrition/subgraph.ts`](../../../src/agents/nutrition/subgraph.ts)
defines a four-node graph and compiles it:

```ts
const nutritionSubgraph = new StateGraph(NutritionAnnotation)
  .addNode("retrieve", retrieveNode)
  .addNode("assess", assessNode)
  .addNode("tools", toolsNode)
  .addNode("compose", composeNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "assess")
  .addConditionalEdges("assess",
    (s) => (s.needsCalorieTool && s.calorieArgs ? "tools" : "compose"),
    { tools: "tools", compose: "compose" })
  .addEdge("tools", "compose")
  .addEdge("compose", END)
  .compile();
```

The shape — `retrieve → assess → (tools | compose) → compose → END` — is the same
pattern you saw at the top level in Module 1, one level down. Nesting graphs this
way keeps each specialist's logic self-contained and testable in isolation
(LangChain, 2025).

## The three working nodes

- **`retrieve`** pulls grounding documents from `nutrition_kb` (Lesson 9) into the
  `citations` channel.
- **`assess`** decides whether a tool should run. It is a structured-output call
  (the same Zod + `withStructuredOutput` pattern from Module 1) that returns
  `needsCalorieTool` and extracted `calorieArgs`. Deciding-then-acting — reason
  about whether a tool is warranted, then act — is the ReAct pattern applied to one
  specialist (Yao et al., 2023).
- **`compose`** writes the 2–3 paragraph finding, and it is given **only** the
  retrieved sources and any tool results:

  ```ts
  content: `Question: ${state.subQuestion}\n\nRetrieved sources:\n${sourcesBlock}\n\nTool results:\n${toolBlock}`
  ```

  The composer is told to ground its answer in `sourcesBlock`. That is the
  citation-grounding discipline made mechanical: the finding is built *from* the
  snippets, and those snippets ride along as the finding's citations.

The `assess → tools | compose` conditional means a question with enough data
("I'm a 70 kg, 175 cm, 70-year-old male, lightly active") runs the calorie tool,
while "how much protein should I eat?" skips straight to compose. Tools are
opt-in per question, not per specialist.

## The adapter node maps sub-graph to top-level state

The top-level graph does not know about `NutritionAnnotation`; it knows about
`CoachState`. The adapter `nutritionNode` bridges them:

```ts
export async function nutritionNode(state: CoachState): Promise<CoachUpdate> {
  const subQuestion = state.routing?.subQuestions.nutrition ?? state.userQuery;
  const result = await nutritionSubgraph.invoke({ subQuestion });
  const finding: SpecialistFinding = {
    agent: "nutrition", text: result.draftText ?? "",
    citations: result.citations, toolCalls: result.toolCalls,
    durationMs: Date.now() - startedAt,
  };
  return { findings: { nutrition: finding } };
}
```

It reads the supervisor's rewritten `subQuestions.nutrition` (Module 1), runs the
subgraph, packages the result as a `SpecialistFinding`, and writes **only**
`findings.nutrition`. Why it can only write its own slot — and can't read anyone
else's — is the next lesson.

### Build on the coach

Open the LangSmith trace for a nutrition question and find the nested subgraph:
`retrieve → assess → compose` (no `tools` for a question that lacks the calorie
inputs). Then ask one *with* full data ("I'm a lightly active 70-year-old, 70 kg,
175 cm — what should I eat to build muscle?") and watch the `tools` node fire.
Notice the finding's citations match the snippets `retrieve` pulled — that
traceability is what Module 4 will score.

## References

LangChain. (2025). *LangGraph documentation: Subgraphs and the Graph API*. https://langchain-ai.github.io/langgraphjs/

Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023). ReAct: Synergizing reasoning and acting in language models. In *International Conference on Learning Representations (ICLR)*. https://doi.org/10.48550/arXiv.2210.03629

---

Previous: [Lesson 10 — The embedding-consistency trap](./10-embedding-consistency-trap.md) · Next: **[Lesson 12 — The type-enforced isolation trick](./12-type-enforced-isolation.md)** · [Course index](../README.md)
