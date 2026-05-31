"use client";

// src/app/global-error.tsx
// Last-resort boundary for errors thrown in the root layout itself. It replaces
// the root layout when it fires, so it must render its own <html>/<body> and
// stay dependency-light.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            The application hit an unexpected error. Please try again.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-gray-400">
              Error ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex w-fit items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
