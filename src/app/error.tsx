"use client";

// src/app/error.tsx
// Route-level error boundary. Catches render/runtime errors below the root
// layout and shows a friendly recovery screen instead of a blank page.
import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
    // Errors caught by a route boundary are not reported by onRequestError, so
    // without this they would only ever land in the user's own devtools. A no-op
    // when no DSN is configured. (The console.error above is deliberately kept
    // for local dev; sentry-scrub drops console breadcrumbs, so it cannot leak.)
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">
        An unexpected error interrupted this page. You can try again, or head
        back to the coach.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-gray-400">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-6 flex items-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <Link href="/coach" className="text-sm text-sky-700 hover:underline">
          Back to coach
        </Link>
      </div>
    </main>
  );
}
