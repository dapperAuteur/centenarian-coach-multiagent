// scripts/review.mjs
// Manual quality-review harness (PRD §12, Day 4). Runs 10 questions through the
// running coach API and prints routing + findings + the synthesized answer for
// each, so you can eyeball answer quality and routing accuracy.
//
// Usage:
//   1. Start the app:   pnpm dev
//   2. In another shell: pnpm review
//      (or: COACH_URL=https://your-deployment node scripts/review.mjs)
//
// Each question's block shows which specialists were routed to, how many
// citations each returned, and the final answer.

const COACH_URL = process.env.COACH_URL ?? "http://localhost:3000";

/** 3 pure-nutrition, 3 pure-workout, 4 cross-domain. */
const QUESTIONS = [
  "How much protein should a 75-year-old eat to preserve muscle?",
  "Are there real longevity benefits to time-restricted eating?",
  "What kinds of foods make a moderate calorie deficit easier to sustain?",
  "How should I progress my deadlift once I can complete every prescribed rep?",
  "How many days a week should I strength train to keep getting stronger?",
  "Why does ankle mobility matter for squatting safely as I age?",
  "I slept 6 hours and feel tired — should I still train legs today, and what should I eat afterward?",
  "I want to build muscle in my 60s — how should I combine my eating and my training?",
  "Is it better to do cardio or lifting first if my main goal is healthy aging?",
  "I'm cutting calories but also lifting — how do I keep my strength while losing fat?",
];

async function ask(question) {
  const res = await fetch(`${COACH_URL}/api/coach/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userQuery: question }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Request failed (${res.status})`);
  }

  const result = { routing: null, findings: [], answer: null, runId: null, error: null };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "routing") result.routing = event.routing;
      else if (event.type === "finding") result.findings.push(event.finding);
      else if (event.type === "answer") result.answer = event.finalAnswer;
      else if (event.type === "done") result.runId = event.langsmithRunId ?? null;
      else if (event.type === "error") result.error = event.message;
    }
  }
  return result;
}

function printBlock(index, question, r) {
  console.log("\n" + "=".repeat(72));
  console.log(`Q${index + 1}. ${question}`);
  console.log("-".repeat(72));
  if (r.error) {
    console.log(`  ERROR: ${r.error}`);
    return;
  }
  console.log(`  Routed to: ${(r.routing?.agents ?? []).join(", ") || "(none)"}`);
  console.log(`  Rationale: ${r.routing?.rationale ?? "(none)"}`);
  for (const f of r.findings) {
    console.log(`  - ${f.agent}: ${f.citations.length} citations, ${f.toolCalls.length} tool calls, ${f.durationMs}ms`);
  }
  console.log("\n  ANSWER:");
  for (const para of (r.answer?.text ?? "(no answer)").split("\n").filter(Boolean)) {
    console.log(`  ${para}`);
  }
  console.log(`\n  Citations: ${r.answer?.citations.length ?? 0}  |  LangSmith run: ${r.runId ?? "(tracing off)"}`);
}

async function main() {
  console.log(`Quality review — ${QUESTIONS.length} questions against ${COACH_URL}`);
  let ok = 0;
  for (let i = 0; i < QUESTIONS.length; i++) {
    try {
      const r = await ask(QUESTIONS[i]);
      printBlock(i, QUESTIONS[i], r);
      if (!r.error && r.answer) ok++;
    } catch (err) {
      console.log(`\nQ${i + 1} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log("\n" + "=".repeat(72));
  console.log(`Done — ${ok}/${QUESTIONS.length} questions answered. Review the answers above for quality.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
