// src/components/ErrorNotice.tsx
"use client";

interface ErrorNoticeProps {
  message: string;
  requestId?: string;
  onRetry?: () => void;
  /** Extra classes for spacing at the call site, e.g. "mt-4". */
  className?: string;
}

/**
 * Inline error box matching the app's existing red-50 / red-700 style, plus an
 * optional request id (so users can quote it for support) and an optional retry
 * button. Replaces the duplicated inline error JSX across the client pages.
 */
export default function ErrorNotice({
  message,
  requestId,
  onRetry,
  className = "",
}: ErrorNoticeProps) {
  return (
    <div
      role="alert"
      className={`rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`.trim()}
    >
      <p>{message}</p>
      {requestId && (
        <p className="mt-1 font-mono text-xs text-red-500">
          Request ID: {requestId}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-900"
        >
          Try again
        </button>
      )}
    </div>
  );
}
