// scripts/ingest-nasm-pdfs.mjs
// Extracts text from NASM study PDFs, chunks it, and writes per-namespace
// JSON files to kb-fixtures/private/ (gitignored). The companion
// `scripts/seed-kb.mjs` then embeds and uploads them to coach_kb.
//
// Run:  pnpm kb:ingest [--dry-run]
// No env vars required at ingest time (the seed step is where the API key
// comes in). --env-file=.env.local is harmless if .env.local is missing.
//
// Inputs are the four NASM directories the operator listed; edit INPUTS if
// they move. CES books are split between workout_kb and recovery_kb by
// filename keyword — the split rule prints in the dry-run table so it can
// be tuned before a real run.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { getDocumentProxy, extractText } from "unpdf";

// ---------------------------------------------------------------------------
// Inputs — edit when source dirs move.
// ---------------------------------------------------------------------------

const INPUTS = [
  {
    dir: "/Users/bam/Google Drive/My Drive/files/fitness/nasm/nutrition",
    namespace: "nutrition_kb",
    cert: "CNC",
  },
  {
    dir: "/Users/bam/Google Drive/My Drive/files/fitness/nasm/fitness/certified personal trainer/Handouts - EN/NASM CPT Handouts By Chapter",
    namespace: "workout_kb",
    cert: "CPT",
  },
  {
    dir: "/Users/bam/Google Drive/My Drive/files/fitness/nasm/fitness/certified personal trainer/scripts/CPT7",
    namespace: "workout_kb",
    cert: "CPT",
  },
  {
    dir: "/Users/bam/Google Drive/My Drive/files/fitness/nasm/fitness/corrective exercise science/NASM CES Books/NASM CES Books By Chapter",
    classifyByFilename: true,
    cert: "CES",
  },
];

// CES split rule. Filename matches RECOVERY → recovery_kb, unless it also
// matches ASSESS (which keeps assessment chapters in workout_kb).
const RECOVERY_PATTERN = /smr|myofascial|foam roll|stretch|flexibility|mobility/i;
const ASSESS_PATTERN = /assess/i;

function classifyCES(filename) {
  if (RECOVERY_PATTERN.test(filename) && !ASSESS_PATTERN.test(filename)) {
    return "recovery_kb";
  }
  return "workout_kb";
}

// ---------------------------------------------------------------------------
// Chunking.
// ---------------------------------------------------------------------------

const MIN_CHUNK_WORDS = 20;
const TARGET_CHUNK_WORDS = 80;
const MAX_CHUNK_WORDS = 140;

function wordCount(text) {
  return (text.match(/\S+/g) ?? []).length;
}

/** Split one cleaned page into chunks of roughly TARGET_CHUNK_WORDS words,
 * preferring paragraph boundaries and falling back to sentences. Paragraphs
 * shorter than MIN_CHUNK_WORDS are merged forward; paragraphs longer than
 * MAX_CHUNK_WORDS are split at sentence boundaries. */
function splitIntoChunks(pageText) {
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
// Page cleaning.
// ---------------------------------------------------------------------------

const NOISE_PATTERNS = [
  /^\s*\d+\s*$/, // bare page number
  /^\s*page\s+\d+\s*$/i, // "Page 12"
  /copyright|©|all rights reserved/i,
  /^\s*chapter\s+\d+\s*$/i, // bare chapter slug
  /isbn[: ]/i,
];

/** Lines that appear on >50% of pages are treated as repeated headers /
 * footers and dropped. */
function detectRepeatedLines(pages) {
  const counts = new Map();
  for (const text of pages) {
    const seen = new Set();
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line.length < 3 || line.length > 80) continue;
      if (seen.has(line)) continue;
      seen.add(line);
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.5));
  const repeated = new Set();
  for (const [line, n] of counts) if (n >= threshold) repeated.add(line);
  return repeated;
}

function cleanPage(text, repeated) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length === 0) return true; // keep blank lines as paragraph breaks
      if (repeated.has(line)) return false;
      if (NOISE_PATTERNS.some((re) => re.test(line))) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ---------------------------------------------------------------------------
// PDF I/O.
// ---------------------------------------------------------------------------

async function extractPdf(filePath) {
  const buffer = readFileSync(filePath);
  const data = new Uint8Array(buffer);
  // verbosity: 0 silences pdfjs's per-page font warnings like
  // "TT: undefined function: 32" — noisy and not actionable.
  const pdf = await getDocumentProxy(data, { verbosity: 0 });
  const result = await extractText(pdf, { mergePages: false });
  if (Array.isArray(result.text)) return result.text;
  return [result.text ?? ""];
}

function findPdfs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop();
    let entries;
    try {
      entries = readdirSync(d);
    } catch {
      continue;
    }
    for (const name of entries) {
      // Skip hidden files. The important case is macOS AppleDouble
      // sidecars (e.g. `._foo.pdf`) — they have a .pdf extension but are
      // metadata blobs that crash unpdf with "Invalid PDF structure".
      if (name.startsWith(".")) continue;
      const full = join(d, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(full);
      else if (extname(name).toLowerCase() === ".pdf") out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Output table formatting.
// ---------------------------------------------------------------------------

function pad(s, w) {
  if (s.length === w) return s;
  if (s.length > w) return `${s.slice(0, w - 1)}…`;
  return s + " ".repeat(w - s.length);
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  /** @type {Map<string, Array<{ source: string, content: string }>>} */
  const byNamespace = new Map();
  /** @type {Array<{ file: string, pages: number, chunks: number, namespace: string, scanned: number, firstSource: string }>} */
  const report = [];

  for (const input of INPUTS) {
    const files = findPdfs(input.dir).sort();
    if (files.length === 0) {
      console.warn(`! no PDFs found under ${input.dir}`);
      continue;
    }
    for (const file of files) {
      const name = basename(file, extname(file));
      const ns = input.classifyByFilename
        ? classifyCES(name)
        : input.namespace;
      try {
        const rawPages = await extractPdf(file);
        const repeated = detectRepeatedLines(rawPages);
        let chunkCount = 0;
        let scannedPages = 0;
        let firstSource = "";
        for (let i = 0; i < rawPages.length; i++) {
          const raw = rawPages[i] ?? "";
          if (wordCount(raw) < MIN_CHUNK_WORDS) {
            scannedPages++;
            continue;
          }
          const cleaned = cleanPage(raw, repeated);
          if (wordCount(cleaned) < MIN_CHUNK_WORDS) continue;
          for (const content of splitIntoChunks(cleaned)) {
            const source = `NASM ${input.cert} · ${name} · p. ${i + 1}`;
            if (!firstSource) firstSource = source;
            if (!byNamespace.has(ns)) byNamespace.set(ns, []);
            byNamespace.get(ns).push({ source, content });
            chunkCount++;
          }
        }
        report.push({
          file: name,
          pages: rawPages.length,
          chunks: chunkCount,
          namespace: ns,
          scanned: scannedPages,
          firstSource,
        });
        if (rawPages.length > 0 && scannedPages > rawPages.length / 2) {
          console.warn(
            `! ${name}: ${scannedPages}/${rawPages.length} pages near-empty (likely scanned; no OCR)`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`! failed to read ${file}: ${msg}`);
      }
    }
  }

  // Per-file classification table.
  const headerFile = pad("File", 52);
  const headerNs = pad("Namespace", 14);
  console.log(
    `\n${headerFile}  ${pad("Pages", 5)}  ${pad("Chunks", 6)}  ${headerNs}  Sample source`,
  );
  console.log(
    `${"-".repeat(52)}  -----  ------  ${"-".repeat(14)}  -------------`,
  );
  for (const row of report) {
    console.log(
      `${pad(row.file, 52)}  ${pad(String(row.pages), 5)}  ${pad(String(row.chunks), 6)}  ${pad(row.namespace, 14)}  ${row.firstSource}`,
    );
  }

  // Per-namespace totals.
  console.log("");
  for (const [ns, docs] of byNamespace) {
    console.log(`${ns}: ${docs.length} chunks across ${report.filter((r) => r.namespace === ns).length} files`);
  }

  if (dryRun) {
    console.log("\n--dry-run: writing no files.");
    return;
  }

  if (byNamespace.size === 0) {
    console.error("No chunks produced. Nothing to write.");
    process.exitCode = 1;
    return;
  }

  const outDir = resolve(process.cwd(), "kb-fixtures", "private");
  mkdirSync(outDir, { recursive: true });
  for (const [ns, docs] of byNamespace) {
    const outPath = join(outDir, `${ns}.json`);
    writeFileSync(outPath, `${JSON.stringify(docs, null, 2)}\n`);
    console.log(`Wrote ${docs.length} docs -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
