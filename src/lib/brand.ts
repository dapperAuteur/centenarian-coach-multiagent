// src/lib/brand.ts
// Single source of truth for the product's user-facing brand.
//
// The product is co-branded: "Fit T. Cent 3.0" is the lead brand, with
// "Centenarian Coach Multi-Agent" kept as the explanatory descriptor (this is
// the third version of the Fit T. Cent app). Import these constants instead of
// hardcoding the name so the two never drift apart.
//
// Internal identifiers — the package name, the repo/domain slug, the LangSmith
// project, DB tables, and the agent system prompts — deliberately keep the
// "centenarian-coach" name and are NOT governed by this file.

export const BRAND = {
  /** Lead brand, including the version. */
  name: "Fit T. Cent 3.0",
  /** Lead brand without the version, for inline prose. */
  shortName: "Fit T. Cent",
  /** The descriptive product name kept alongside the brand. */
  descriptor: "Centenarian Coach Multi-Agent",
  /** Short descriptor for tight spaces (e.g. the in-app coach header). */
  shortDescriptor: "Centenarian Coach",
  /** Marketing tagline. */
  tagline: "Get Fit and Learn Tryin'",
} as const;

/** "Fit T. Cent 3.0 — Centenarian Coach Multi-Agent" (em dash lockup). */
export const BRAND_LOCKUP = `${BRAND.name} — ${BRAND.descriptor}`;

/** Title-bar lockup for page <title> tags. */
export const BRAND_TITLE = BRAND_LOCKUP;
