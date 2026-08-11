// Regression guard: retrieval must dedupe by chunk id, never by page label.
//
// The bug this locks down (found 2026-08-11): `source` is a page-level label
// and pages hold roughly 3.5 chunks. Deduping on it kept the highest-ranked
// chunk per page and threw away its siblings, which is where the prescriptive
// numbers live. On case cx-easy-003 the acute-variables table (~12-20 reps,
// ~1-3 sets, ~50-70% 1RM) was retrieved and discarded one position after the
// conceptual chunk from the same page. See plans/11-actionability-regression.md.
import { beforeEach, describe, expect, it, vi } from "vitest";

const matchCoachKb = vi.fn();

vi.mock("@/lib/embeddings", () => ({
  embed: async () => new Array(768).fill(0),
}));
vi.mock("@/lib/pgvector", () => ({
  matchCoachKb: (...args: unknown[]) => matchCoachKb(...args),
}));

const { retrieveWorkoutKb } = await import("@/agents/workout/retrieval");

/** Two chunks off one page, plus a chunk from another page. */
const SAME_PAGE = [
  {
    id: "chunk-1",
    source: "NASM CPT · CPT7_Study-Guide_Section5 · p. 17",
    content: "Resistance exercises progress from stabilization to strength to power.",
    similarity: 0.9,
  },
  {
    id: "chunk-2",
    source: "NASM CPT · CPT7_Study-Guide_Section5 · p. 17",
    content:
      "Stabilization and muscular endurance: ~12-20 repetitions, ~1-3 sets, ~50-70% 1RM.",
    similarity: 0.88,
  },
  {
    id: "chunk-3",
    source: "NASM CPT · Some Other Page · p. 4",
    content: "Unrelated conceptual passage.",
    similarity: 0.8,
  },
];

describe("retrieval dedupe", () => {
  beforeEach(() => matchCoachKb.mockReset());

  it("keeps both chunks from the same page, because the numbers live in the sibling", async () => {
    matchCoachKb.mockResolvedValue(SAME_PAGE);
    const out = await retrieveWorkoutKb("beginner 3-day full body program", 8);

    expect(out).toHaveLength(3);
    // The load-bearing assertion: the acute-variables chunk survives.
    expect(out.some((c) => c.snippet.includes("12-20 repetitions"))).toBe(true);
    // And its page-mate is still there, so this is not just a swap.
    expect(out.some((c) => c.snippet.includes("stabilization to strength"))).toBe(
      true,
    );
  });

  it("still drops a genuine duplicate chunk returned by both queries", async () => {
    // Two queries run when `alsoQuery` differs, and the same chunk can rank in
    // both. That is the duplicate dedupe is actually for.
    matchCoachKb.mockResolvedValue([SAME_PAGE[0]!, SAME_PAGE[1]!]);
    const out = await retrieveWorkoutKb(
      "beginner program",
      8,
      "how do I start lifting",
    );

    expect(matchCoachKb).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((c) => c.snippet)).size).toBe(2);
  });

  it("scopes to the workout namespace", async () => {
    matchCoachKb.mockResolvedValue([]);
    await retrieveWorkoutKb("q", 8);
    expect(matchCoachKb).toHaveBeenCalledWith(
      expect.anything(),
      "workout_kb",
      8,
    );
  });
});
