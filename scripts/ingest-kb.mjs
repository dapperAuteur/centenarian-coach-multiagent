// scripts/ingest-kb.mjs
// Extracts text from a configured set of PDF directories, chunks it, and
// writes per-namespace JSON files to kb-fixtures/private/ (gitignored).
// The companion `scripts/seed-kb.mjs` then embeds and uploads them to
// coach_kb. Script is namespace-agnostic — add an entry to INPUTS for any
// new specialist KB.
//
// Run:  pnpm kb:ingest [--dry-run] [--append]
//   --dry-run  print what would be written; write nothing.
//   --append   add NEW source files to existing JSON without disturbing what
//              is already there. Loads each namespace's current
//              kb-fixtures/private/<ns>.json, skips any PDF whose basename
//              is already represented (matched via the source label), and
//              appends only new files' chunks to the END of the array. This
//              keeps existing doc_index positions stable so `pnpm kb:seed`
//              embeds only the newly-appended tail. Without --append the
//              namespace JSON is rebuilt from scratch (which can shift
//              indices if a new file sorts into the middle).
//
// Source directories are configured via env vars (set in .env.local, which
// is gitignored) so personal paths and source names stay out of the public
// repo. Each var is a comma-separated list of directories; all of a
// namespace's dirs are merged:
//   INGEST_NUTRITION_DIRS   -> nutrition_kb
//   INGEST_WORKOUT_DIRS     -> workout_kb
//   INGEST_CORRECTIVE_DIRS  -> corrective_kb
//   INGEST_RECOVERY_DIRS    -> recovery_kb
// The Gemini API key is only needed at seed time, not here.

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
// Inputs. Directories come from env vars (comma-separated, merged per
// namespace). `cert` is a short domain tag prefixed onto each citation's
// source label. Add a row here to support a new specialist namespace.
// ---------------------------------------------------------------------------

const NAMESPACE_INPUTS = [
  { env: "INGEST_NUTRITION_DIRS", namespace: "nutrition_kb", cert: "Nutrition" },
  { env: "INGEST_WORKOUT_DIRS", namespace: "workout_kb", cert: "Training" },
  { env: "INGEST_CORRECTIVE_DIRS", namespace: "corrective_kb", cert: "Corrective" },
  { env: "INGEST_RECOVERY_DIRS", namespace: "recovery_kb", cert: "Recovery" },
];

const INPUTS = NAMESPACE_INPUTS.flatMap(({ env, namespace, cert }) =>
  (process.env[env] ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((dir) => ({ dir, namespace, cert })),
);

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

// C0 control chars Postgres rejects in `text` columns (most importantly
// 0x00, which pdfjs sometimes emits from quirky embedded fonts). Keep
// TAB, LF, CR.
const C0_NOISE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function cleanPage(text, repeated) {
  return text
    .replace(C0_NOISE, "")
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

/** Recover the source file's basename from a citation label of the form
 * `<cert> · <basename> · p. <n>`. Used in --append mode to detect which
 * files are already represented in an existing JSON. Returns null when the
 * label doesn't match the expected shape. */
function sourceBasename(source) {
  const parts = String(source).split(" · ");
  if (parts.length < 3) return null;
  return parts.slice(1, -1).join(" · ");
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const append = process.argv.includes("--append");

  if (INPUTS.length === 0) {
    console.error(
      "No source directories configured. Set one or more of " +
        NAMESPACE_INPUTS.map((i) => i.env).join(" / ") +
        " in .env.local (comma-separated absolute paths). See .env.example.",
    );
    process.exit(1);
  }

  const outDir = resolve(process.cwd(), "kb-fixtures", "private");

  /** @type {Map<string, Array<{ source: string, content: string }>>} */
  const byNamespace = new Map();
  /** @type {Array<{ file: string, pages: number, chunks: number, namespace: string, scanned: number, firstSource: string }>} */
  const report = [];
  /** ns -> Set of source basenames already present (append mode). */
  const seenByNamespace = new Map();
  /** ns -> count of pre-existing docs kept (append mode). */
  const baselineLen = new Map();
  /** Names of files skipped because already ingested (append mode). */
  const skippedFiles = [];

  if (append) {
    for (const ns of new Set(INPUTS.map((i) => i.namespace))) {
      const p = join(outDir, `${ns}.json`);
      if (!existsSync(p)) continue;
      const existing = JSON.parse(readFileSync(p, "utf8"));
      byNamespace.set(ns, existing);
      baselineLen.set(ns, existing.length);
      const seen = new Set();
      for (const doc of existing) {
        const b = sourceBasename(doc.source);
        if (b) seen.add(b);
      }
      seenByNamespace.set(ns, seen);
      console.log(
        `append: ${ns} has ${existing.length} existing docs across ` +
          `${seen.size} files; new files will be appended to the end.`,
      );
    }
  }

  for (const input of INPUTS) {
    const files = findPdfs(input.dir).sort();
    if (files.length === 0) {
      console.warn(`! no PDFs found under ${input.dir}`);
      continue;
    }
    for (const file of files) {
      const name = basename(file, extname(file));
      const ns = input.namespace;
      if (append && seenByNamespace.get(ns)?.has(name)) {
        skippedFiles.push(name);
        continue;
      }
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
            const source = `${input.cert} · ${name} · p. ${i + 1}`;
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
    const newFiles = report.filter((r) => r.namespace === ns).length;
    if (append) {
      const base = baselineLen.get(ns) ?? 0;
      const added = docs.length - base;
      console.log(
        `${ns}: ${docs.length} total (${added} new chunks from ${newFiles} new file(s); ${base} kept)`,
      );
    } else {
      console.log(`${ns}: ${docs.length} chunks across ${newFiles} files`);
    }
  }
  if (append && skippedFiles.length > 0) {
    console.log(
      `\nSkipped ${skippedFiles.length} already-ingested file(s) (append mode).`,
    );
  }

  if (dryRun) {
    console.log("\n--dry-run: writing no files.");
    return;
  }

  // In append mode with nothing new, byNamespace still holds the unchanged
  // existing docs — but there's no reason to rewrite identical files.
  if (append) {
    const anyNew = [...byNamespace.keys()].some(
      (ns) => (byNamespace.get(ns)?.length ?? 0) > (baselineLen.get(ns) ?? 0),
    );
    if (!anyNew) {
      console.log("\nNo new files to append. Nothing written.");
      return;
    }
  } else if (byNamespace.size === 0) {
    console.error("No chunks produced. Nothing to write.");
    process.exitCode = 1;
    return;
  }

  mkdirSync(outDir, { recursive: true });
  for (const [ns, docs] of byNamespace) {
    // In append mode, only rewrite namespaces that actually gained docs.
    if (append && docs.length === (baselineLen.get(ns) ?? 0)) continue;
    const outPath = join(outDir, `${ns}.json`);
    writeFileSync(outPath, `${JSON.stringify(docs, null, 2)}\n`);
    console.log(`Wrote ${docs.length} docs -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
