// src/agents/specificity-gate.ts
//
// Deterministic gate: if the retrieved sources handed a specialist concrete
// numbers and the specialist's draft carries none of them, that is a defect and
// the draft gets one revision.
//
// WHY THIS EXISTS. Nothing else in the pipeline ever asks for a prescription.
// The compose prompts ask for "2-3 short paragraphs," the output schema is a
// single free-text field, and `CITE_OR_DROP_RULE` raises the cost of making a
// specific claim (a rep range needs a marker that a second model checks for
// aptness) while nothing raises the cost of staying vague. The cheapest thing a
// composer can write is a correct, well-cited generality.
//
// Measured 2026-08-11 across the nine failing cases of the actionability
// investigation: retrieved snippets carried 65 concrete specifics, specialist
// findings kept 15, final answers kept 11. See
// plans/11-actionability-regression.md.
//
// This is deliberately NOT a prompt request. The standing rule on this project
// is that asking a model nicely is not a guarantee; a mechanical check that
// fails is. Like the marker-range pre-check in verify-citations.ts, this is
// pure regex over text: no model call, no key, no network, and it cannot fail
// for infrastructure reasons.
//
// It does NOT assert that a specific claim is correct, only that one is present
// when the sources offered one. Correctness is the citation verifier's job.

/**
 * A concrete, actionable specific: a quantity with a unit, or a small range
 * with a unit.
 *
 * Deliberately narrow. Page-number artifacts like "1168-1173" and citation
 * ranges like "767-71" are extremely common in this corpus (the public layer is
 * study abstracts harvested from bibliographies) and must not count as
 * prescriptions, so a bare number range with no unit is ignored. Requiring a
 * unit is what makes this measure prescriptions rather than digits.
 */
const SPECIFIC = new RegExp(
  [
    // "1.6 g", "195 grams", "500 mg", "12 reps", "3 sets", "90 sec", "8 weeks"
    String.raw`\b\d{1,4}(?:\.\d+)?\s*(?:g|grams?|mg|kcal|calories?|reps?|repetitions?|sets?|sec(?:onds?)?|min(?:utes?)?|hours?|hrs?|weeks?|days?|%)\b`,
    // "12-20 reps", "1–3 sets", "50–70% 1RM". En dash and hyphen both appear.
    String.raw`\b\d{1,3}\s*(?:to|[-–])\s*\d{1,3}\s*(?:g|grams?|mg|reps?|repetitions?|sets?|sec(?:onds?)?|min(?:utes?)?|hours?|weeks?|days?|%)\b`,
    // "70% 1RM" and "1RM" intensity prescriptions
    String.raw`\b\d{1,3}\s*%\s*(?:of\s*)?1\s*RM\b`,
    // "3 times per week", "2x per week", "twice daily" style frequencies
    String.raw`\b\d{1,2}\s*(?:x|times)\s*(?:per|a|each)\s*(?:day|week|session)\b`,
    // Unit BEFORE the number, which is how the NASM acute-variables tables are
    // written: "Moderate to high repetitions: ~12-20 or higher", "Low to
    // moderate sets: ~1-3 sets". A test using verbatim corpus text caught this
    // gap; the unit-after patterns above miss it entirely because the range is
    // followed by "or higher" rather than a unit. The optional trailing "%"
    // and "1RM" matter: this alternative sits earlier in the string than the
    // %1RM pattern below and would otherwise consume the digits and leave the
    // intensity marker unmatched, so "intensities: ~50-70% 1RM" would be
    // recorded as "intensities: ~50-70" with the unit silently lost.
    String.raw`\b(?:reps?|repetitions?|sets?|intensities|intensity|volume)\b\s*:?\s*~?\s*\d{1,3}\s*(?:to|[-–])\s*~?\s*\d{1,3}\s*%?(?:\s*1\s*RM)?`,
  ].join("|"),
  "gi",
);

/** Every distinct concrete specific in a block of text, lowercased. */
export function findSpecifics(text: string): string[] {
  const hits = text.match(SPECIFIC) ?? [];
  return [...new Set(hits.map((h) => h.replace(/\s+/g, " ").trim().toLowerCase()))];
}

export interface SpecificityResult {
  /** False when sources offered specifics and the draft carried none. */
  pass: boolean;
  /** Distinct specifics present in the retrieved sources. */
  available: string[];
  /** Distinct specifics that made it into the draft. */
  carried: string[];
}

/**
 * Compare what the sources offered against what the draft kept.
 *
 * Passes when the draft carries at least one specific, and passes when the
 * sources offered none, because a specialist cannot invent a number it was not
 * given and the cite-or-drop rule correctly forbids trying. The only failing
 * shape is: the material was there, and none of it survived.
 *
 * This is deliberately a floor, not a coverage ratio. A draft that keeps one of
 * twelve available specifics passes. Tightening it to a ratio would trade a
 * clear signal for a tunable threshold, and the loss this was built to catch is
 * total, not partial.
 */
export function checkSpecificity(input: {
  draftText: string;
  sourceText: string;
}): SpecificityResult {
  const available = findSpecifics(input.sourceText);
  const carried = findSpecifics(input.draftText);
  return {
    pass: available.length === 0 || carried.length > 0,
    available,
    carried,
  };
}

/**
 * The revision instruction for a failed check.
 *
 * Names the actual specifics that were available rather than saying "be more
 * specific," so the composer is pointed at real retrieved material and cannot
 * satisfy the instruction by inventing a number. Caps the list because a source
 * block can carry dozens and the instruction should stay readable.
 */
export function specificityRevisionNote(result: SpecificityResult): string {
  const shown = result.available.slice(0, 8);
  const more =
    result.available.length > shown.length
      ? ` (and ${result.available.length - shown.length} more)`
      : "";
  return (
    `- Your answer contains no concrete quantity, range, or frequency, but the retrieved sources do: ${shown.join(", ")}${more}. ` +
    `Carry at least the ones that answer the question into your reply, with the correct inline [n] marker for the source each came from. ` +
    `Do not invent a number that is not in a provided source; if none of the available specifics actually answer the question, leave the answer as it is.`
  );
}
