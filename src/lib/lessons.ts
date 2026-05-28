// src/lib/lessons.ts
// Reads the five-lesson curriculum from docs/lessons/*.md so the guide can
// render them in-app at /guide/lessons/[slug]. Filesystem reads happen at
// build time (the lesson route uses generateStaticParams + static render),
// so the markdown never needs to ship in the serverless bundle.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const LESSONS_DIR = resolve(process.cwd(), "docs", "lessons");

export interface LessonMeta {
  /** Filename without `.md`, e.g. "02-supervisor-routing". */
  slug: string;
  /** First `#` heading in the file. */
  title: string;
}

/** Strip a leading YAML frontmatter block if present. Current lessons have
 * none, but this keeps the renderer robust if one is added later. */
function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "");
}

/** First markdown `# heading` in the content, or the slug as a fallback. */
function firstHeading(md: string, slug: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : slug;
}

/** All lessons, sorted by their numeric filename prefix. Excludes README. */
export function listLessons(): LessonMeta[] {
  let files: string[];
  try {
    files = readdirSync(LESSONS_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort()
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const md = stripFrontmatter(readFileSync(resolve(LESSONS_DIR, file), "utf8"));
      return { slug, title: firstHeading(md, slug) };
    });
}

/** Markdown body for one lesson, or null if the slug is unknown. */
export function readLesson(slug: string): string | null {
  // Guard against path traversal — slugs are flat filenames.
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  try {
    const md = readFileSync(resolve(LESSONS_DIR, `${slug}.md`), "utf8");
    return stripFrontmatter(md);
  } catch {
    return null;
  }
}
