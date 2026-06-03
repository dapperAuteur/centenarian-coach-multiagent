# Module 6 · Lesson 27 · Extending the eval suite as you extend the system

> **Tag:** `course/lesson-27` · **Module 6: Extension launching pad** · ~3 min

There is one rule that keeps an extensible system from rotting as it grows: **a new
capability ships with the evals that pin it.** Module 4 built the eval machinery;
this lesson is the discipline of using it every time you add something.

## A specialist arrives with its eval examples

When the Corrective specialist was added, the dataset gained examples for it
([`evals/dataset.json`](../../../evals/dataset.json)): `c1`, a corrective-only
question (the first in the set), and `wr3`, a cross-domain case that pairs
corrective with recovery. Without them, the eval suite would happily report green
while never once checking that the supervisor routes a postural question to the new
specialist. A specialist with no eval example is a specialist you are not testing.

So the routine for any new specialist is: add at least one pure-domain routing
example and one cross-domain example, each tagged with `addedIn` and a `note`
(Module 4). The deterministic routing evaluator then covers it for free, and the
grounding judge covers its corpus the moment it is exercised.

## A new feature arrives with its check

The same holds beyond specialists. Add conversation memory (extension #3)? Add an
example that asks a follow-up and asserts the prior turn was used. Add an MCP tool
(#4)? Add a question that should trigger it and assert the tool call appears. The
evaluator might be deterministic (did the expected thing happen) or an LLM judge
(was the result grounded). Either way it goes in the suite, not in your memory.

## Why this is the closing discipline of the course

An extensible architecture (Modules 1 to 3) plus built-in evaluation (Module 4)
plus this rule is what makes the coach safe to keep changing. The dataset is the
system's memory of how it has broken and what it now must always do. Grow the
system without growing the dataset and you are flying blind on everything you
added after the last eval (LangChain, 2025).

### Build on the coach

Whatever extension you chose in Lesson 26, write its eval first, before you finish
building it. Watch it fail (the capability does not exist yet), build until it
passes, and leave it in the suite. You will have practiced the single habit that
separates a demo that ages badly from a system that gets more trustworthy over
time.

## References

LangChain. (2025). *LangSmith documentation: Datasets and evaluation*. https://docs.langchain.com/langsmith/evaluation

---

Previous: [Lesson 26 · Five extensions with file paths](./26-extensions-with-file-paths.md) · Next: **[Lesson 28 · Capstone: ship your own specialist](./28-capstone.md)** · [Course index](../README.md)
