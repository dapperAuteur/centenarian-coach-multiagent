// Regression guard: the ingest chunker must keep prescriptive tables whole.
//
// The bug this locks down (found 2026-08-11): the corpus is built from PDFs
// whose acute variables live in tables that extraction flattens into one long
// run of text. Chunking at 80 target / 140 max words cut those apart, so a
// chunk could carry "Muscular hypertrophy * Low to moderate repetitions:" and
// leave the numbers in the next chunk, or carry numbers with no idea which
// adaptation they belong to. Measured on the operator's local corpus before
// the fix: the OPT program-template page `07-03-01-CPT7_Performance05 p. 1`
// was cut mid-row at "Cone Drills: 5-10-5 Drill, Modified Box Drill, L. E." /
// "F. T Drill 2 1 Fast 60 sec", stranding every resistance-training row from
// its column header. See scripts/chunk-kb.mjs.
//
// The table fixtures below are trimmed excerpts of real extracted pages in
// the operator's private corpus (NASM CPT program templates and the
// study-guide acute-variables table), not invented text. Client name changed;
// row shapes, column headers, numbers, and dash characters kept as extracted.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MAX_TABLE_CHUNK_WORDS,
  findTableRegions,
  splitIntoChunks,
  wordCount,
} from "../scripts/chunk-kb.mjs";

// ---------------------------------------------------------------------------
// The chunker as it behaved before table protection was added. Prose must
// still go through exactly this path, so the regression test below compares
// the two implementations over the whole tracked corpus.
// ---------------------------------------------------------------------------

const MIN_CHUNK_WORDS = 20;
const TARGET_CHUNK_WORDS = 80;
const MAX_CHUNK_WORDS = 140;

function previousSplitIntoChunks(pageText: string): string[] {
  const paragraphs = pageText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let buf = "";
  let bufWords = 0;

  function flush() {
    if (buf && bufWords >= MIN_CHUNK_WORDS) chunks.push(buf);
    buf = "";
    bufWords = 0;
  }

  for (const para of paragraphs) {
    const w = wordCount(para);
    if (w >= MAX_CHUNK_WORDS) {
      flush();
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
      let s = "";
      let sw = 0;
      for (const sent of sentences) {
        const sentWords = wordCount(sent);
        if (sw + sentWords > MAX_CHUNK_WORDS && sw >= MIN_CHUNK_WORDS) {
          chunks.push(s.trim());
          s = sent;
          sw = sentWords;
        } else {
          s += (s ? " " : "") + sent;
          sw += sentWords;
        }
      }
      if (s && sw >= MIN_CHUNK_WORDS) chunks.push(s.trim());
      continue;
    }
    if (bufWords + w > TARGET_CHUNK_WORDS && bufWords >= MIN_CHUNK_WORDS) {
      chunks.push(buf);
      buf = para;
      bufWords = w;
    } else {
      buf = buf ? `${buf} ${para}` : para;
      bufWords += w;
    }
  }
  flush();
  return chunks;
}

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const OPT_HEADER =
  "Optimum Performance Training® CLIENT’S NAME: Sample Client " +
  "GOAL: Fat Loss PHASE: 1 Stabilization Endurance Training DATE: 1 of 12 " +
  "EXERCISE SETS REPS TEMPO REST NOTES";

const OPT_ROWS = [
  "WARM-UP Foam Roll: Calves, Adductors, Lats 1 1 30 sec 0 sec Hold tender spot for 30 sec",
  "Cardio 1 1 5 min 60 sec Brisk walk or slow jog for 5 minutes",
  "ACTIVATION (core & balance) Core: Floor Bridge 1 15 Slow 0 Core: Floor Cobra 1 15 Slow 0",
  "Balance: Single-leg Balance Reach: Frontal Plane 1 16 Slow 90 sec 8 reps each leg",
  "SKILL DEVELOPMENT (plyometric & SAQ) Plyometric: Squat Jump with Stabilization 1 8 Slow 90 sec Hold landing 3-5 sec",
  "RESISTANCE TRAINING Squat Pattern: Ball Squat 1 20 Slow 0",
  "Push Pattern: Incline Push-up 1 20 Slow 0",
  "Press Pattern: Standing Dumbbell Shoulder Press 1 20 Slow 90 sec",
  "CLIENT’S CHOICE Plank 1 1 Slow 90 sec Hold for 30 sec",
  "COOL-DOWN Cardio 1 1 5 min 0 sec Gradually reduce speed",
];

const OPT_TABLE = `${OPT_HEADER} ${OPT_ROWS.join(" ")} Coaching Tips: Perform activation and resistance exercises in two mini circuits.`;

// Extraction emits an en dash inside ranges on some pages and a hyphen on
// others, sometimes with a space after the dash ("~12– 20"). The
// hypertrophy row below uses hyphens for that reason; the rest use en dashes,
// exactly as the two source PDFs do.
const ACUTE_VARIABLES =
  "Suggested repetitions, sets, and training intensity Training Adaptation " +
  "Suggested Acute Variables* " +
  "Stabilization and muscular endurance • Moderate to high repetitions: ~12– 20 or higher " +
  "• Low to moderate sets: ~1–3 sets " +
  "• Low to moderate training intensities: ~50–70% 1RM " +
  "Muscular hypertrophy† • Low to moderate repetitions: ~6-12 or higher " +
  "• Moderate to high sets: ~3-6 sets " +
  "• Moderate to high training intensities: ~75-85% 1RM " +
  "Maximal strength • Low repetitions: ~1–5 • High sets: ~4–6 sets " +
  "• High training intensities: ~85–100% 1RM " +
  "Power • Low to moderate repetitions: ~1–10 • Moderate to high sets: ~3–6 " +
  "• Low training intensities: ~10% of bodyweight (when using a medicine ball) " +
  "or ~30–45% (when using weights)";

const PROSE =
  "Repetition refers to the number of times an exercise is completed, for " +
  "example, performing a biceps curl involves lowering and raising the " +
  "weight through a full range of motion. A set is a group of consecutive " +
  "repetitions performed without rest. There is an inverse relationship " +
  "between sets and repetitions. The individual usually performs fewer sets " +
  "when performing higher repetitions at a lower intensity and more sets " +
  "when performing lower repetitions at a higher intensity. Training " +
  "intensity, as it relates to resistance training, has been shown to " +
  "influence muscle hypertrophy and is often argued as the single most " +
  "important exercise variable for stimulating muscle mass. Although " +
  "intensity can be described as the degree of effort involved with " +
  "training, it is commonly expressed as a percentage of one repetition " +
  "maximum and equates to the number of repetitions that can be performed " +
  "with a given weight. A client's physical capabilities, fitness level, " +
  "nutritional status, and goals determine the quantity of repetitions, " +
  "sets, and training intensity.";

/** Every page in the tracked (public) fixtures, one string per citation
 * label. Chunks are joined back together so both chunkers see the same
 * input; the comparison is old-vs-new on identical text. */
function trackedCorpusPages(): string[] {
  const dir = resolve(process.cwd(), "kb-fixtures");
  const pages: string[] = [];
  for (const file of [
    "workout_kb.json",
    "nutrition_kb.json",
    "recovery_kb.json",
    "corrective_kb.json",
  ]) {
    const path = resolve(dir, file);
    if (!existsSync(path)) continue;
    const docs = JSON.parse(readFileSync(path, "utf8")) as Array<{
      source: string;
      content: string;
    }>;
    const bySource = new Map<string, string[]>();
    for (const doc of docs) {
      const seen = bySource.get(doc.source) ?? [];
      if (!seen.includes(doc.content)) seen.push(doc.content);
      bySource.set(doc.source, seen);
    }
    for (const contents of bySource.values()) pages.push(contents.join(" "));
  }
  return pages;
}

// ---------------------------------------------------------------------------

describe("chunker: prescriptive tables", () => {
  it("keeps an OPT program template in one chunk, header and rows together", () => {
    expect(wordCount(OPT_TABLE)).toBeGreaterThan(MAX_CHUNK_WORDS);

    const chunks = splitIntoChunks(OPT_TABLE);

    expect(chunks).toHaveLength(1);
    const [chunk] = chunks;
    // The header run, the goal/phase line, the first row, and the last row
    // all have to be in the same chunk or the numbers lose their meaning.
    expect(chunk).toContain("EXERCISE SETS REPS TEMPO REST");
    expect(chunk).toContain("GOAL: Fat Loss PHASE: 1");
    expect(chunk).toContain("Core: Floor Bridge 1 15 Slow 0");
    expect(chunk).toContain("COOL-DOWN Cardio 1 1 5 min 0 sec");
    expect(chunk).toContain("Coaching Tips:");
  });

  it("keeps an acute-variables bullet block in one chunk", () => {
    const chunks = splitIntoChunks(ACUTE_VARIABLES);

    expect(chunks).toHaveLength(1);
    const [chunk] = chunks;
    // Every adaptation keeps its own numbers, en dash and hyphen alike.
    expect(chunk).toContain("Stabilization and muscular endurance");
    expect(chunk).toContain("~12– 20");
    expect(chunk).toContain("~1–3 sets");
    expect(chunk).toContain("~50–70% 1RM");
    expect(chunk).toContain("Muscular hypertrophy");
    expect(chunk).toContain("~6-12");
    expect(chunk).toContain("~75-85% 1RM");
    expect(chunk).toContain("Maximal strength");
    expect(chunk).toContain("~85–100% 1RM");
    expect(chunk).toContain("Power");
    expect(chunk).toContain("~30–45%");
  });

  it("keeps a table whole when it is embedded in a page of prose", () => {
    const page = `${PROSE}\n\n${ACUTE_VARIABLES}\n\n${PROSE}`;
    const chunks = splitIntoChunks(page);

    const holdingTheTable = chunks.filter((c) => c.includes("~50–70% 1RM"));
    expect(holdingTheTable).toHaveLength(1);
    expect(holdingTheTable[0]).toContain("Training Adaptation");
    expect(holdingTheTable[0]).toContain("~30–45%");
  });

  it("does not treat ordinary prose as a table", () => {
    expect(findTableRegions(PROSE)).toHaveLength(0);
  });
});

describe("chunker: oversized tables", () => {
  // Three concatenated templates: past the cap, so the split path runs.
  const oversized = `${OPT_HEADER} ${[...OPT_ROWS, ...OPT_ROWS, ...OPT_ROWS, ...OPT_ROWS].join(" ")}`;

  it("splits at a row boundary and repeats the header on every piece", () => {
    expect(wordCount(oversized)).toBeGreaterThan(MAX_TABLE_CHUNK_WORDS);

    const chunks = splitIntoChunks(oversized);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Every piece says what its numbers mean.
      expect(chunk).toContain("EXERCISE SETS REPS TEMPO REST");
      expect(chunk).toContain("GOAL: Fat Loss PHASE: 1");
      // And no piece runs past the cap by more than the repeated header.
      expect(wordCount(chunk)).toBeLessThanOrEqual(MAX_TABLE_CHUNK_WORDS);
    }
  });

  it("cuts between rows, never through one", () => {
    const chunks = splitIntoChunks(oversized);

    for (const chunk of chunks) {
      const body = chunk.slice(chunk.indexOf("NOTES") + "NOTES".length).trim();
      // A cut through a row would leave a piece starting on a bare number or
      // a tempo word: "60 sec RESISTANCE TRAINING ...".
      expect(body).not.toMatch(/^\d/);
      expect(body).not.toMatch(/^(?:Slow|Moderate|Fast|Repeating)\b/i);
      // Each piece opens on a section band of the template.
      expect(body).toMatch(
        /^(?:WARM-UP|ACTIVATION|SKILL DEVELOPMENT|RESISTANCE TRAINING|CLIENT’S CHOICE|COOL-DOWN)\b/,
      );
    }
    // Nothing is dropped: every row survives somewhere.
    const joined = chunks.join(" ");
    for (const row of OPT_ROWS) expect(joined).toContain(row);
  });
});

describe("chunker: prose is unchanged", () => {
  it("chunks a prose page exactly as the previous chunker did", () => {
    expect(splitIntoChunks(PROSE)).toEqual(previousSplitIntoChunks(PROSE));
  });

  it("chunks every page of the tracked corpus exactly as before", () => {
    const pages = trackedCorpusPages();
    expect(pages.length).toBeGreaterThan(0);

    const differing = pages.filter(
      (page) =>
        JSON.stringify(splitIntoChunks(page)) !==
        JSON.stringify(previousSplitIntoChunks(page)),
    );
    expect(differing).toEqual([]);
  });
});

// The operator's private corpus is gitignored, so this runs locally and skips
// everywhere else. It checks the real pages the fix was written for.
describe("chunker: private corpus (skipped when absent)", () => {
  const path = resolve(process.cwd(), "kb-fixtures", "private", "workout_kb.json");
  const present = existsSync(path);

  it.skipIf(!present)("emits each detected table region inside one chunk", () => {
    const docs = JSON.parse(readFileSync(path, "utf8")) as Array<{
      source: string;
      content: string;
    }>;
    const bySource = new Map<string, string[]>();
    for (const doc of docs) {
      const seen = bySource.get(doc.source) ?? [];
      if (!seen.includes(doc.content)) seen.push(doc.content);
      bySource.set(doc.source, seen);
    }

    let regionsChecked = 0;
    for (const contents of bySource.values()) {
      const page = contents.join(" ");
      const regions = findTableRegions(page.replace(/\s+/g, " ").trim());
      if (regions.length === 0) continue;
      const chunks = splitIntoChunks(page);
      for (const region of regions) {
        if (wordCount(region.text) > MAX_TABLE_CHUNK_WORDS) continue;
        regionsChecked++;
        expect(chunks.some((c) => c.includes(region.text))).toBe(true);
      }
    }
    expect(regionsChecked).toBeGreaterThan(0);
  });
});
