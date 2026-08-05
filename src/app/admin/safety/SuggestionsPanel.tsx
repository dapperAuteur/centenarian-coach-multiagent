"use client";

// "Generate improvement suggestions" panel on /admin/safety. Calls the
// generateSafetySuggestions server action and renders the returned markdown.
// The report is per-request only (not persisted) in v1.

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { generateSafetySuggestions } from "./actions";

export function SuggestionsPanel() {
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateSafetySuggestions();
      setReport(result.report);
      setError(result.error);
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          One LLM pass over the ~50 most recent events: patterns, missed
          referrals, and concrete prompt/product suggestions.
        </p>
        <Button type="button" onClick={generate} disabled={isPending}>
          {isPending ? "Generating…" : "Generate improvement suggestions"}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      {report && (
        <div className="prose prose-sm mt-4 max-w-none border-t border-gray-100 pt-4">
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
