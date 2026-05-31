// src/app/not-found.tsx
// Friendly 404 — also what a visitor sees on the deployed app if they hit a
// path that doesn't exist here (e.g. /course/multi-agent or /podcast, which the
// README used to link to).
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-semibold text-sky-700">404</p>
      <h1 className="mt-1 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-gray-600">
        That page doesn’t exist here. It may have moved, or never lived on this
        domain.
      </p>
      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/" className="text-sky-700 hover:underline">
          Home
        </Link>
        <Link href="/coach" className="text-sky-700 hover:underline">
          Coach
        </Link>
      </div>
    </main>
  );
}
