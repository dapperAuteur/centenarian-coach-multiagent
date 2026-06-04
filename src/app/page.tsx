// src/app/page.tsx
// Landing page — a short pitch and a link into /coach. Replaces the
// create-next-app scaffold.

import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Logo className="mb-6 h-14 w-auto" />
      <h1 className="text-3xl font-bold tracking-tight">
        Centenarian Coach Multi-Agent
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        This is a portfolio + course artifact. The demo runs without
        authentication.
      </p>

      <p className="mt-8 leading-relaxed text-gray-800">
        A LangGraph supervisor with specialist subgraphs. You ask one question;
        a coordinator decides which specialists to consult across four domains:{" "}
        <span className="font-medium">Nutrition</span>,{" "}
        <span className="font-medium">Workout</span>,{" "}
        <span className="font-medium">Recovery</span>, and{" "}
        <span className="font-medium">Corrective Exercise</span>. Each has its
        own knowledge base (grounded in a science-based fitness and nutrition
        curriculum) and
        its own tools. The coordinator weaves their findings into one answer
        with per-specialist citations.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/coach"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Open the coach →
        </Link>
        <Link
          href="/guide"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Read the guide
        </Link>
        <Link
          href="/walkthrough"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Watch the walkthrough
        </Link>
        <Link
          href="/sources"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Browse the sources
        </Link>
        <a
          href="https://github.com/dapperAuteur/centenarian-coach-multiagent"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Source on GitHub ↗
        </a>
      </div>

      <p className="mt-12 text-xs text-gray-500">
        The architecture&rsquo;s design decisions are walked through in the{" "}
        <a
          href="https://github.com/dapperAuteur/centenarian-coach-multiagent/blob/main/docs/course/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          five-lesson curriculum
        </a>
        .
      </p>
    </main>
  );
}
