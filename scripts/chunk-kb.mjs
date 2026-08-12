// scripts/chunk-kb.mjs
// Page -> chunk splitting for `scripts/ingest-kb.mjs`. Extracted into its own
// module so tests can import it without running the ingest script's main().
//
// Two behaviors live here:
//
//   1. Prose chunking (unchanged): roughly TARGET_CHUNK_WORDS per chunk,
//      preferring paragraph boundaries, falling back to sentence boundaries
//      for paragraphs over MAX_CHUNK_WORDS.
//
//   2. Prescriptive table protection (added 2026-08-11): the corpus is built
//      from PDFs whose acute variables live in tables that pdf extraction
//      flattens into one long run of text, e.g. an OPT program template
//      ("EXERCISE SETS REPS TEMPO REST NOTES ... Core: Floor Bridge 1 15
//      Slow 0 ...") or an acute-variables block ("Muscular hypertrophy
//      * Low to moderate repetitions: ~6-12 ... ~75-85% 1RM"). Word-count
//      chunking cuts those apart, and either half is useless: the labels lose
//      their numbers, or the numbers lose the adaptation they belong to. A
//      detected table region is emitted as one chunk even when it exceeds
//      MAX_CHUNK_WORDS.
//
// NOTE: this only affects content chunked from here on. Rows already in
// coach_kb keep the chunking they were ingested with until someone re-runs
// `pnpm kb:ingest` against the source PDFs and re-seeds.

export const MIN_CHUNK_WORDS = 20;
export const TARGET_CHUNK_WORDS = 80;
export const MAX_CHUNK_WORDS = 140;

// Upper bound on a protected table chunk. Measured basis: the largest intact
// OPT program-template page in the local private corpus is 285 words, and the
// largest page that mixes a table with surrounding prose is 318. 400 clears
// both with headroom while still bounding what a malformed page can produce
// (a mis-extracted page cannot turn into one 5,000-word chunk). A table over
// the cap is split at row boundaries, with the header run repeated on every
// piece, so no piece is a bare column of numbers.
export const MAX_TABLE_CHUNK_WORDS = 400;

// Unmarked words tolerated between two table signals before the run is
// treated as two separate regions. OPT rows carry long exercise labels
// ("SAQ: Speed Ladder- One-ins, Two-ins, Side Shuffle, In-In-Out-Out, Ali
// Shuffle") and some rows carry no numbers at all, so the gap has to be
// generous or a single table fragments into several regions.
const GAP_WORDS = 25;

// How far a region may reach past its outermost signal to pick up the table
// caption in front of it and the footnote behind it, and only as far as a
// sentence boundary.
const EDGE_WORDS = 25;

export function wordCount(text) {
  return (text.match(/\S+/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// Table signals.
//
// Every pattern below was checked against real extracted pages in the local
// private corpus (NASM CPT program templates and study-guide tables) rather
// than invented.
// ---------------------------------------------------------------------------

// A column-header word. A run of three or more of these in a row is the
// flattened header of a table; prose does not stack three of them without
// punctuation ("repetitions, sets, and training intensity" has commas and so
// is not a run).
const COLUMN_LABEL =
  "(?:exercises?|sets?|reps?|repetitions?|tempo|rest|intensity|intensities|notes?|loads?|duration|frequency|coaching\\s+tips?|training\\s+adaptation|suggested\\s+acute\\s+variables)";

// "EXERCISE SETS REPS TEMPO REST NOTES", "Sets Reps Tempo Rest Intensity",
// "Exercise Sets Reps Tempo Rest Coaching Tip", plus the two-label header
// "Training Adaptation Suggested Acute Variables*" spelled out because it is
// only two labels wide.
const HEADER_RUN = new RegExp(
  `(?:\\b${COLUMN_LABEL}(?:[ \\t]+${COLUMN_LABEL}){2,}\\*?)` +
    `|(?:\\btraining\\s+adaptation\\s+suggested\\s+acute\\s+variables\\*?)`,
  "gi",
);

const TEMPO_WORD =
  "(?:slow|moderate|fast|explosive|controlled|repeating|steady|isometric)";

const DURATION =
  "\\d{1,3}(?:\\s*[-‐‑–]\\s*\\d{1,3})?\\s*(?:sec|secs|second|seconds|min|mins|minute|minutes)\\b";

// One flattened prescriptive row: sets, reps, then a tempo word or a duration.
// Matches "1 15 Slow 0", "2 12 Moderate 60 sec", "1 1 30 sec 0 sec",
// "1 10 1-2 sec 0 sec", "2 8 Repeating 60 sec". The lookbehind keeps it off
// decimal runs in research data tables ("116. 562. 5 123. 762. 3").
const TABLE_ROW = new RegExp(
  `(?<![\\w.])\\d{1,3}\\s+\\d{1,3}\\s+(?:${TEMPO_WORD}\\b|${DURATION})`,
  "gi",
);

// An acute-variable range. The corpus uses an en dash inside ranges on some
// pages and a hyphen on others, and pdf extraction sometimes leaves a space
// after the dash ("~12- 20"), so all three shapes are matched.
const ACUTE_RANGE =
  /~\s*\d{1,3}\s*[-‐‑‒–—―]\s*\d{1,3}/g;

// A bulleted acute-variable line: "* Low to moderate sets: ~1-3 sets",
// "* Moderate to high training intensities: ~75-85% 1RM". Bullet glyphs vary
// by source pdf. The value after the colon has to be an approximation, a
// range, or a percentage; a bare number would also match bulleted prose like
// "* Breakfast at 7:00 a.m. = 7 cervical vertebrae", which is not a table.
const ACUTE_BULLET =
  /[•◆●▪‣○■]\s*[^•◆●▪‣○■]{0,80}?:\s*(?:~\s*\d{1,3}|\d{1,3}\s*[-‐‑‒–—―]\s*\d{1,3}|\d{1,3}\s*%)/g;

// Weak signals. These bridge the gap between strong signals inside one table
// but never qualify a region on their own, because each is common in ordinary
// prose ("rest 60 sec between sets"). OPT rows for supersets carry no set or
// rep numbers at all ("Legs: Dumbbell Squat Legs: Calf Raise Moderate
// Moderate Moderate 30 sec 30 sec 30 sec"), so without these a single
// template fragments into three regions.
const TEMPO_RUN = new RegExp(
  `\\b${TEMPO_WORD}(?:\\s+${TEMPO_WORD}\\b)+`,
  "gi",
);
const DURATION_CELL = new RegExp(`(?<![\\w.])${DURATION}`, "gi");
// Section bands of an OPT program template.
const TABLE_SECTION =
  /\b(?:WARM-?UP|COOL-?DOWN|ACTIVATION|RESISTANCE TRAINING|SKILL DEVELOPMENT|CLIENT[’'`]S CHOICE|Coaching Tips?)\b/g;

const STRONG_PATTERNS = [HEADER_RUN, TABLE_ROW, ACUTE_RANGE, ACUTE_BULLET];
const WEAK_PATTERNS = [TEMPO_RUN, DURATION_CELL, TABLE_SECTION];

/** Word spans of `text`, as {start, end} character offsets. */
function tokenize(text) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Index of the first word whose span contains or follows character `pos`. */
function wordIndexAt(words, pos) {
  for (let i = 0; i < words.length; i++) {
    if (words[i].end > pos) return i;
  }
  return words.length;
}

/** Every table signal in `text`, as word-index ranges tagged with its kind. */
function findSignals(text, words) {
  const signals = [];
  const scan = (patterns, strong) => {
    for (const pattern of patterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const from = wordIndexAt(words, m.index);
        const to = Math.max(
          from,
          wordIndexAt(words, m.index + m[0].length - 1),
        );
        signals.push({
          from,
          to,
          strong,
          header: pattern === HEADER_RUN,
          text: m[0],
        });
      }
    }
  };
  scan(STRONG_PATTERNS, true);
  scan(WEAK_PATTERNS, false);
  signals.sort((a, b) => a.from - b.from || a.to - b.to);
  return signals;
}

const SENTENCE_END = /[.!?]$/;

/** Pull the region's start back to the start of the sentence the first signal
 * sits in (the table caption / client-and-goal line), at most EDGE_WORDS. */
function extendStart(words, text, from) {
  const limit = Math.max(0, from - EDGE_WORDS);
  let start = from;
  for (let i = from - 1; i >= limit; i--) {
    const w = text.slice(words[i].start, words[i].end);
    if (SENTENCE_END.test(w)) break;
    start = i;
  }
  return start;
}

/** Push the region's end out to the next sentence boundary (the coaching-tips
 * line or the table footnote), at most EDGE_WORDS. Stops where it is if no
 * boundary is close enough, so a following prose paragraph is not swallowed. */
function extendEnd(words, text, to) {
  const limit = Math.min(words.length - 1, to + EDGE_WORDS);
  for (let i = to; i <= limit; i++) {
    const w = text.slice(words[i].start, words[i].end);
    if (SENTENCE_END.test(w)) return i;
  }
  return to;
}

/** Prescriptive table regions inside one paragraph, as word-index ranges.
 * A region qualifies on strong signals only: a column-header run plus at
 * least one row, or three rows / acute-variable lines. Weak signals bridge
 * gaps inside a region but never create one. Both thresholds are deliberately
 * strict: a false positive would glue prose into an oversized chunk. */
export function findTableRegions(paragraph) {
  const words = tokenize(paragraph);
  if (words.length === 0) return [];
  const signals = findSignals(paragraph, words);
  if (signals.length === 0) return [];

  const groups = [];
  let current = null;
  for (const s of signals) {
    if (current && s.from <= current.to + GAP_WORDS) {
      current.to = Math.max(current.to, s.to);
      current.signals.push(s);
    } else {
      current = { from: s.from, to: s.to, signals: [s] };
      groups.push(current);
    }
  }

  const regions = [];
  for (const g of groups) {
    const strong = g.signals.filter((s) => s.strong);
    const headers = strong.filter((s) => s.header);
    const rows = strong.length - headers.length;
    // Only strong signals qualify a region. A header run needs at least one
    // row of numbers under it, and a table with no recognizable header needs
    // three rows, so a stray "60 sec" in prose cannot start a table.
    const qualifies =
      (headers.length > 0 && rows >= 1) || strong.length >= 3;
    if (!qualifies) continue;
    const from = extendStart(words, paragraph, g.from);
    const to = extendEnd(words, paragraph, g.to);
    const last = regions[regions.length - 1];
    if (last && from <= last.to) {
      last.to = Math.max(last.to, to);
      continue;
    }
    regions.push({ from, to, headerText: headers[0]?.text ?? "" });
  }
  return regions.map((r) => ({
    ...r,
    text: paragraph.slice(words[r.from].start, words[r.to].end),
  }));
}

/** The text repeated at the head of each piece when an oversized table is
 * split, so every piece still says what its numbers mean. Prefers the matched
 * column-header run; falls back to the region's lead-in (caption line) up to
 * the first bullet or row. */
function tableHeaderPrefix(regionText, headerText) {
  if (headerText) {
    const at = regionText.indexOf(headerText);
    // Include the caption in front of the header run when it is short.
    if (at > 0) {
      const lead = regionText.slice(0, at + headerText.length);
      if (wordCount(lead) <= EDGE_WORDS) return lead.trim();
    }
    return headerText.trim();
  }
  const firstBullet = regionText.search(/[•◆●▪‣○■]/);
  if (firstBullet > 0) {
    const lead = regionText.slice(0, firstBullet).trim();
    if (lead && wordCount(lead) <= EDGE_WORDS) return lead;
  }
  return "";
}

/** Where an oversized table may be cut, best first.
 *
 * `preferred` are unambiguous row starts: a section band of a program
 * template ("RESISTANCE TRAINING") or a bullet glyph. `fallback` is the word
 * after a row's numbers, used only when no preferred point fits the budget.
 * The numbers themselves are never a cut point: a row reads
 * "<label> <sets> <reps> <tempo> <rest> <note>", so cutting at the first
 * number would strand the label in the previous piece. */
function rowBoundaries(regionText, words) {
  const preferred = new Set();
  const fallback = new Set();
  const collect = (pattern, into, atEnd) => {
    const re = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = re.exec(regionText)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const i = atEnd
        ? wordIndexAt(words, m.index + m[0].length - 1) + 1
        : wordIndexAt(words, m.index);
      if (i > 0 && i < words.length) into.add(i);
    }
  };
  collect(TABLE_SECTION, preferred, false);
  collect(ACUTE_BULLET, preferred, false);
  collect(TABLE_ROW, fallback, true);
  const sortNum = (a, b) => a - b;
  return {
    preferred: [...preferred].sort(sortNum),
    fallback: [...fallback].sort(sortNum),
  };
}

/** One table region -> one chunk, or several capped chunks split at row
 * boundaries with the header repeated. */
export function splitTableRegion(regionText, headerText = "") {
  const words = tokenize(regionText);
  if (words.length <= MAX_TABLE_CHUNK_WORDS) return [regionText];

  const header = tableHeaderPrefix(regionText, headerText);
  const headerWords = header ? wordCount(header) : 0;
  const boundaries = rowBoundaries(regionText, words);

  const pieces = [];
  let start = 0;
  while (start < words.length) {
    const first = pieces.length === 0;
    const budget = Math.max(
      MIN_CHUNK_WORDS,
      MAX_TABLE_CHUNK_WORDS - (first ? 0 : headerWords),
    );
    let end = words.length;
    if (words.length - start > budget) {
      // Last row boundary that fits, preferring a section/bullet start.
      // A hard cut happens only when one row is itself over the budget.
      const fits = (b) => b > start && b - start <= budget;
      const preferred = boundaries.preferred.filter(fits);
      const fallback = boundaries.fallback.filter(fits);
      end =
        preferred.length > 0
          ? preferred[preferred.length - 1]
          : fallback.length > 0
            ? fallback[fallback.length - 1]
            : start + budget;
    }
    const body = regionText.slice(words[start].start, words[end - 1].end);
    pieces.push(first || !header ? body : `${header} ${body}`);
    start = end;
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// Chunking.
// ---------------------------------------------------------------------------

/** Split one cleaned page into chunks of roughly TARGET_CHUNK_WORDS words,
 * preferring paragraph boundaries and falling back to sentences. Paragraphs
 * shorter than MIN_CHUNK_WORDS are merged forward; paragraphs longer than
 * MAX_CHUNK_WORDS are split at sentence boundaries. Prescriptive table
 * regions are lifted out first and kept whole (see MAX_TABLE_CHUNK_WORDS). */
export function splitIntoChunks(pageText) {
  const paragraphs = pageText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const chunks = [];
  let buf = "";
  let bufWords = 0;

  function flush() {
    if (buf && bufWords >= MIN_CHUNK_WORDS) chunks.push(buf);
    buf = "";
    bufWords = 0;
  }

  /** The pre-existing prose path, unchanged. */
  function addProse(para) {
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
      return;
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

  for (const para of paragraphs) {
    const regions = findTableRegions(para);
    if (regions.length === 0) {
      addProse(para);
      continue;
    }
    // A paragraph holding a table becomes: prose before it (through the
    // ordinary path), the table whole, prose after it.
    const words = tokenize(para);
    flush();
    let cursor = 0;
    for (const region of regions) {
      if (region.from > cursor) {
        const lead = para
          .slice(words[cursor].start, words[region.from - 1].end)
          .trim();
        if (lead) addProse(lead);
      }
      // Leftover prose too short to stand as its own chunk rides along with
      // the table instead of being dropped by flush().
      let prefix = "";
      if (buf && bufWords < MIN_CHUNK_WORDS) {
        prefix = `${buf} `;
        buf = "";
        bufWords = 0;
      } else {
        flush();
      }
      const pieces = splitTableRegion(region.text, region.headerText);
      pieces[0] = `${prefix}${pieces[0]}`;
      for (const piece of pieces) chunks.push(piece.trim());
      cursor = region.to + 1;
    }
    if (cursor < words.length) {
      const tail = para.slice(words[cursor].start).trim();
      if (tail) {
        // Same reasoning as the lead: a short tail joins the table it belongs
        // to rather than vanishing at the final flush().
        if (wordCount(tail) < MIN_CHUNK_WORDS && chunks.length > 0) {
          chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${tail}`;
        } else {
          addProse(tail);
        }
      }
    }
  }
  flush();
  return chunks;
}
