# Lesson 1 · Single-agent vs. multi-agent: when the extra complexity pays

Multi-agent systems are fashionable, and that is a problem. Most "AI agent"
tutorials reach for a supervisor and a swarm of sub-agents before they have a
reason to. This lesson is about the reason. By the end you should be able to
look at a problem and say, with evidence, "this needs one agent" or "this needs
several", and defend the answer in an interview.

## The problem a single agent has

Fit T. Cent 3.0 (Centenarian Coach Multi-Agent) answers health questions. Early
versions were one prompt:
a long system message that made the model a nutrition expert, a strength-training
expert, a recovery expert, and a careful synthesizer, all at once. It worked for
narrow questions. It fell apart on a question like:

> "I slept six hours and feel tired, should I still train legs today, and what
> should I eat afterward?"

A single agent has to do four things here in one pass: judge recovery, judge
training, judge nutrition, and weave the three into one coherent answer. Each
sub-judgement competes for the same context window and the same attention. The
retrieval call is worse: one query against one pile of documents returns a
blurry mix of sleep science, training theory, and macronutrient guidance, and
the model grounds its answer in whatever floated to the top.

The failure is not that the model is dumb. It is that the *architecture* gave it
no seam along which to divide the work.

## What multi-agent actually buys you

A multi-agent system splits one large prompt into a **supervisor** that routes
and a set of **specialists** that each own a slice of the problem. In this repo
the coach has a supervisor plus Nutrition, Workout, Recovery, and Corrective
Exercise specialists. The supervisor classifies the question, decides which
specialists to consult, and synthesizes their findings.

That split buys three concrete things:

1. **Isolated retrieval.** The Nutrition specialist queries only the
   `nutrition_kb` namespace; the Workout specialist queries only `workout_kb`.
   A training question never has to wade through recipe text. (Lesson 3.)
2. **Isolated tools.** The Nutrition specialist has a calorie calculator; the
   Workout specialist has a progression calculator and a mobility lookup.
   Neither model sees a tool list cluttered with the other domain's tools.
3. **Attributable answers.** Each specialist returns a structured finding with
   its own citations. The final answer can say *which* specialist said *what*,
   and link the source. A single agent can only gesture at "the documents."

None of this requires the specialists to be clever. It requires them to be
**separate**, separate context, separate retrieval, separate tools.

## The anti-pattern: routing for routing's sake

Here is the part the tutorials skip. Multi-agent is not free. Every request now
costs a supervisor LLM call, one call per specialist, and a synthesizer call, six calls where a single agent made one. Latency stacks. There is more code to
test, more state to thread, more ways to misroute.

If your "specialists" all read the **same** knowledge base and call the **same**
tools, you have not built a multi-agent system. You have built a single agent
with extra network hops and a routing bug surface. That is routing for routing's
sake, and it is the most common way these systems go wrong.

## A decision checklist

Before you split one agent into many, answer these:

- **Do the domains have genuinely different knowledge sources?** If a billing
  question and a technical question are answered from one combined doc set, one
  retriever is fine.
- **Do the domains need different tools?** A refund calculator is useless to a
  log-search agent. Different tool sets is a strong signal to split.
- **Do questions cross domains often enough to need synthesis?** If 95% of
  questions are single-domain, a router in front of one agent may be enough,   you may not need a synthesizer at all.
- **Does the answer need per-domain attribution?** If users (or auditors) must
  see which source supports which claim, separate specialists make that natural.

Two or more "yes" answers, and multi-agent earns its cost. Mostly "no", and you
are about to add complexity that buys nothing.

## How the coach scores

The coach is a clear "yes": nutrition and workout have distinct knowledge bases,
distinct tools, distinct citation trails, and cross-domain questions ("eat and
train to build muscle") are common. The supervisor + specialist split is not
decoration here, it is the only architecture that answers the six-hours-of-sleep
question cleanly.

## Build this yourself

Throughout this course you will build a parallel system in a different domain so
the pattern transfers. The running example is a **SaaS customer support desk**
with three specialists:

- **Billing**, answers from pricing and invoice policy docs; has a
  `refundEstimator` tool.
- **Technical**, answers from API and integration docs; has a `logSearch` tool.
- **Account**, answers from account, security, and permissions policy; has an
  `entitlementLookup` tool.

**Exercise.** Run the decision checklist above against this support desk. Write
two or three sentences for each checklist question. Then answer: does this desk
warrant a multi-agent system, and why? (It does, but the value of the exercise
is being able to *show the reasoning*, not guess the answer.) Keep your notes;
Lesson 2 starts building this desk's supervisor.

---

Next: **[Lesson 2 · Supervisor routing](./02-supervisor-routing.md)**, writing a
supervisor that returns a structured routing decision before any specialist runs.
