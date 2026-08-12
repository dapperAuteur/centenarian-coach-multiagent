// Guards the deterministic specificity gate.
//
// The defect it exists for, measured 2026-08-11: retrieved snippets carried 65
// concrete specifics across nine cases, specialist findings kept 15, answers
// kept 11. Nothing in the pipeline asked for a prescription, and cite-or-drop
// made a vague answer the cheapest correct thing to write.
// See plans/11-actionability-regression.md.
import { describe, expect, it } from "vitest";
import {
  checkSpecificity,
  findSpecifics,
  specificityRevisionNote,
} from "@/agents/specificity-gate";

// Verbatim shapes from the corpus, including the en dashes it actually uses.
const ACUTE_VARIABLES =
  "Stabilization and muscular endurance • Moderate to high repetitions: ~12–20 or higher • Low to moderate sets: ~1–3 sets • Low to moderate training intensities: ~50–70% 1RM";
const OPT_TABLE =
  "EXERCISE SETS REPS TEMPO REST Core: Floor Bridge 1 15 Slow 0 Plyometric: Squat Jump with Stabilization 1 8 Slow 90 sec";
const CONCEPTUAL =
  "Resistance exercises should progress systematically in three steps: stabilization-focused, then strength-focused, then power-focused. [5]";

describe("findSpecifics", () => {
  it("finds quantities, ranges, and intensities in real corpus text", () => {
    const hits = findSpecifics(ACUTE_VARIABLES);
    expect(hits.some((h) => h.includes("12–20") || h.includes("12-20"))).toBe(true);
    expect(hits.some((h) => h.includes("sets"))).toBe(true);
    expect(hits.some((h) => h.includes("1rm") || h.includes("%"))).toBe(true);
  });

  it("finds a gram amount", () => {
    expect(findSpecifics("aim for 195 grams of protein daily").length).toBeGreaterThan(0);
  });

  it("finds nothing in purely conceptual prose", () => {
    expect(findSpecifics(CONCEPTUAL)).toEqual([]);
  });

  // This is the assertion that keeps the gate honest. The corpus is largely
  // study abstracts pulled from bibliographies, so page ranges are everywhere.
  // Counting them as prescriptions would make the gate pass on exactly the
  // answers it was built to catch.
  it("ignores page-number artifacts, which this corpus is full of", () => {
    expect(findSpecifics("Journal of Strength Res 2004;18:1168-1173")).toEqual([]);
    expect(findSpecifics("see pp. 767-71 and 342-92")).toEqual([]);
  });

  it("deduplicates repeats", () => {
    expect(findSpecifics("3 sets, then 3 sets, then 3 sets")).toHaveLength(1);
  });
});

describe("checkSpecificity", () => {
  it("fails when the sources offered numbers and the draft kept none", () => {
    const r = checkSpecificity({ draftText: CONCEPTUAL, sourceText: ACUTE_VARIABLES });
    expect(r.pass).toBe(false);
    expect(r.available.length).toBeGreaterThan(0);
    expect(r.carried).toEqual([]);
  });

  it("passes when the draft carries a specific through", () => {
    const r = checkSpecificity({
      draftText: "Start at 1 to 3 sets of 12–20 reps [5].",
      sourceText: ACUTE_VARIABLES,
    });
    expect(r.pass).toBe(true);
  });

  // A specialist cannot invent a number it was not given, and cite-or-drop
  // correctly forbids trying. Failing here would push the model toward
  // fabrication, which is a worse defect than vagueness.
  it("passes when the sources offered nothing to carry", () => {
    const r = checkSpecificity({
      draftText: CONCEPTUAL,
      sourceText: "Progressive overload is the governing principle of adaptation.",
    });
    expect(r.pass).toBe(true);
    expect(r.available).toEqual([]);
  });

  it("passes on a partial carry, because the loss it targets is total", () => {
    const r = checkSpecificity({
      draftText: "Use 90 sec rest between plyometric sets.",
      sourceText: OPT_TABLE,
    });
    expect(r.pass).toBe(true);
  });
});

describe("specificityRevisionNote", () => {
  it("names the real available specifics and forbids inventing one", () => {
    const r = checkSpecificity({ draftText: CONCEPTUAL, sourceText: ACUTE_VARIABLES });
    const note = specificityRevisionNote(r);
    expect(note).toContain(r.available[0]!);
    expect(note).toContain("Do not invent");
    expect(note).toContain("[n]");
  });

  it("caps a long list so the instruction stays readable", () => {
    const many = Array.from({ length: 20 }, (_, i) => `${i + 1} reps`).join(", ");
    const note = specificityRevisionNote(
      checkSpecificity({ draftText: CONCEPTUAL, sourceText: many }),
    );
    expect(note).toContain("more)");
  });
});
