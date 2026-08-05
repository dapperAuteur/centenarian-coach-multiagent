// src/components/InformationalNotice.tsx
// Compact informational-safety notices for the coach UI (plans/09 discussion,
// BAM's 2026-08-03 spec): one above the input box, one above each rendered
// answer. These are POINTERS, not the full partner-vetted Rise Wellness
// callout — that lives verbatim in SiteFooter and must not be duplicated or
// paraphrased here. Keep both variants short to avoid disclaimer blindness.
//
// No hooks, no state — safe to render from server components (history pages)
// and client components (the live coach page) alike.

const inlineLinkClasses =
  "font-medium text-amber-900 underline hover:text-amber-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded";

interface InformationalNoticeProps {
  /** Extra classes for spacing at the call site, e.g. "mt-6". */
  className?: string;
}

/**
 * Notice mounted above the question input: informational-only framing plus a
 * compact Rise Wellness pointer (site + phone), deferring to the footer for
 * the full vetted callout.
 */
export function InputSafetyNotice({ className = "" }: InformationalNoticeProps) {
  return (
    <div
      role="note"
      aria-label="Informational-use notice"
      className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ${className}`.trim()}
    >
      <p>
        <span className="font-semibold">Informational only.</span> This coach
        is not medical advice — see a qualified professional before acting on
        anything here. For mental health questions and their other
        specialties, contact{" "}
        <a
          href="https://risewellnessofindiana.com"
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLinkClasses}
        >
          Rise Wellness of Indiana
          <span className="sr-only"> (opens in new tab)</span>
        </a>{" "}
        ·{" "}
        <a href="tel:+13179650299" className={inlineLinkClasses}>
          317-965-0299
        </a>
        . Details in the footer.
      </p>
    </div>
  );
}

/**
 * One-line notice mounted above each rendered answer (live coach page and
 * history detail).
 */
export function ResponseSafetyNotice({
  className = "",
}: InformationalNoticeProps) {
  return (
    <p
      role="note"
      aria-label="Informational-use notice"
      className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs leading-relaxed text-amber-900 ${className}`.trim()}
    >
      Informational only — talk to a professional before implementing any of
      this. Mental health questions:{" "}
      <a
        href="https://risewellnessofindiana.com"
        target="_blank"
        rel="noopener noreferrer"
        className={inlineLinkClasses}
      >
        Rise Wellness of Indiana
        <span className="sr-only"> (opens in new tab)</span>
      </a>{" "}
      — details in the footer.
    </p>
  );
}
