// src/app/guide/lessons/[slug]/page.tsx
// Renders one curriculum lesson from docs/lessons/<slug>.md. Public page.
// generateStaticParams + static render means the markdown is read at build
// time and baked into HTML — no runtime filesystem access.

import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listLessons, readLesson } from "@/lib/lessons";

export function generateStaticParams() {
  return listLessons().map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = listLessons().find((l) => l.slug === slug);
  return {
    title: lesson
      ? `${lesson.title} | Centenarian Coach Guide`
      : "Lesson | Centenarian Coach Guide",
    description:
      "A lesson from the multi-agent coach curriculum: supervisor routing, per-agent retrieval, state passing, and evals.",
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const markdown = readLesson(slug);
  if (!markdown) notFound();

  const lessons = listLessons();
  const index = lessons.findIndex((l) => l.slug === slug);
  const prev = index > 0 ? lessons[index - 1] : null;
  const next =
    index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs text-gray-500">
        <Link href="/guide" className="hover:underline">
          ← Guide
        </Link>
      </p>

      <article className="prose prose-gray mt-6 max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>

      <nav className="mt-12 flex justify-between gap-4 border-t border-gray-200 pt-6 text-sm">
        {prev ? (
          <Link
            href={`/guide/lessons/${prev.slug}`}
            className="text-sky-700 hover:underline"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/guide/lessons/${next.slug}`}
            className="text-right text-sky-700 hover:underline"
          >
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
