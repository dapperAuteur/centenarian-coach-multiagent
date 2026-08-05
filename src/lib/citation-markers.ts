// src/lib/citation-markers.ts
// Pure helpers for inline citation markers ("[n]") in specialist prose.
// Part of the inline-citation upgrade (BAM's 2026-08-05 decision: inline
// markers AND the rubric) fixing the 66.7% cx.no_uncited_claims finding —
// "most substantive prescriptions cannot be traced to a specific source".
//
// No imports, no side effects: these run inside the verify gate's
// deterministic pre-check (src/agents/verify-citations.ts) and the
// synthesizer's offset remap (src/synthesizer/synthesize.ts), and are
// unit-tested directly in tests/verify-citations.test.ts.

/**
 * An inline citation marker: one or more digits in square brackets.
 * Multiple markers may sit adjacent ("[1][3]"). Matches "[12]" but not
 * "[a]", "[1.5]", or markdown links.
 */
const MARKER_RE = /\[(\d+)\]/g;

/** Every marker number in the text, in order of appearance (duplicates kept). */
export function extractMarkers(text: string): number[] {
  const markers: number[] = [];
  for (const match of text.matchAll(MARKER_RE)) {
    markers.push(Number(match[1]));
  }
  return markers;
}

/**
 * Distinct marker numbers that cannot refer to any entry of a numbered
 * source list of length `citationCount` (1-based: valid range is
 * 1..citationCount). "[0]" is always out of range.
 */
export function findOutOfRangeMarkers(
  text: string,
  citationCount: number,
): number[] {
  const seen = new Set<number>();
  for (const n of extractMarkers(text)) {
    if (n < 1 || n > citationCount) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Shift every "[n]" marker in the text by `offset` ("[2]" with offset 3 ->
 * "[5]"). Used by the synthesizer to remap each specialist's LOCAL marker
 * numbering onto the GLOBAL flatMapped citations array: the offset is the
 * count of citations contributed by prior specialists. Deterministic regex
 * replace — the model never renumbers.
 */
export function offsetMarkers(text: string, offset: number): string {
  if (offset === 0) return text;
  return text.replace(MARKER_RE, (_m, digits: string) => {
    return `[${Number(digits) + offset}]`;
  });
}

/**
 * Remap each specialist finding's LOCAL "[n]" markers onto the GLOBAL
 * numbering of the flatMapped citations array: finding i's offset is the
 * total citation count of findings 0..i-1, i.e. exactly where finding i's
 * own sources land in `findings.flatMap((f) => f.citations)`. Returns the
 * remapped texts in the same order. Pure and deterministic — the
 * synthesizer model is never asked to renumber.
 */
export function remapFindingMarkers(
  findings: ReadonlyArray<{ text: string; citations: readonly unknown[] }>,
): string[] {
  let offset = 0;
  return findings.map((f) => {
    const text = offsetMarkers(f.text, offset);
    offset += f.citations.length;
    return text;
  });
}
