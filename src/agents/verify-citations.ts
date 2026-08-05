// src/agents/verify-citations.ts
// Citation-coverage verify gate, shared by every specialist subgraph.
//
// Fix for the eval's `cx.no_uncited_claims` finding (57.1% pass on
// 2026-08-03; see plans/09-eval-harness-findings-citation-discipline-and-blog.md
// Finding 1). BAM chose the combined design — prompt rule + mechanical check +
// second-model verifier — enforced in code as ONE verify step after compose:
//
//   compose -> verify -> (pass ? END : one revision) -> END
//
// Since the inline-citation upgrade (BAM's 2026-08-05 decision, fixing the
// 66.7% cx.no_uncited_claims traceability gap) the gate has two layers:
//
//   1. DETERMINISTIC pre-check (no model call): regex-extract the draft's
//      "[n]" markers and flag any that fall outside 1..citations.length.
//      Recorded as citationCheck.markersOutOfRange and included in the
//      revision instruction.
//   2. LLM check: a second, temperature-0 model call that sentence-splits
//      the draft and lists (a) substantive claims with no supporting source
//      or tool result, (b) substantive claims carrying no marker when a
//      numbered source grounds them, and (c) claims whose cited marker
//      points at a source that does NOT actually support them (aptness).
//
// The verifier prompt embeds CITE_OR_DROP_RULE from shared-rules.ts so the
// compose rule and the verify rule can never drift apart. Max ONE revision,
// by design: no second verification loop.
//
// Failure policy: a failed or malformed verifier call must never block the
// user. It logs with context and passes the draft through with
// `verifierError: true` recorded on the finding — visible, not silent.

import { z } from "zod";
import { withRoleFallback } from "@/lib/with-fallback";
import { findOutOfRangeMarkers } from "@/lib/citation-markers";
import type { Citation, CitationCheck, ToolCallRecord } from "@/state";
import { CITE_OR_DROP_RULE } from "./shared-rules";

export const VERIFY_CITATIONS_SYSTEM = `You are a citation-coverage verifier for a health-coach specialist. The specialist composed a draft answer under this rule:

${CITE_OR_DROP_RULE}

Your job: check whether the draft obeys it. Sentence-split the draft. For every sentence, decide whether it makes a SUBSTANTIVE claim or recommendation — a factual statement or a piece of advice. List every substantive claim or recommendation that breaks the rule, quoting or closely paraphrasing each one. A claim breaks the rule when:
- No provided retrieved source or tool result supports it, OR
- It carries no inline [n] marker even though a numbered retrieved source grounds it (a claim grounded only in a tool result is fine without a marker), OR
- It carries a marker [n] but source number n does not actually support THAT claim — check each marker's aptness against the specific numbered source it points to, not merely whether some source somewhere supports the claim.

Exemptions — do NOT list these:
- Conversational framing: greetings, transitions, restating the user's situation or question.
- Safety referrals such as "consult a physician / physical therapist / registered dietitian" — these are policy, not factual claims.

If every substantive claim is supported and correctly marked, return an empty list.`;

const VerifySchema = z.object({
  unsupportedClaims: z
    .array(z.string())
    .describe(
      "Every substantive claim or recommendation in the draft that is unsupported by the provided sources or tool results, lacks a required inline [n] marker, or cites a source that does not support it. Empty when the draft is fully covered and correctly marked.",
    ),
});

const ReviseSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe("The revised specialist finding, grounded in the sources."),
});

/** Same sources formatting the compose nodes use, kept in one place. */
export function formatSourcesBlock(citations: Citation[]): string {
  return citations.length > 0
    ? citations
        .map((c, i) => `[${i + 1}] ${c.source}\n${c.snippet}`)
        .join("\n\n")
    : "(no sources retrieved)";
}

/** Same tool-results formatting the compose nodes use, kept in one place. */
export function formatToolBlock(toolCalls: ToolCallRecord[]): string {
  return toolCalls.length > 0
    ? toolCalls
        .map((t) => `${t.name} -> ${JSON.stringify(t.output)}`)
        .join("\n")
    : "(no tools used)";
}

export interface VerifyResult {
  pass: boolean;
  unsupportedClaims: string[];
  /**
   * Distinct "[n]" markers in the draft outside 1..citations.length, found
   * by the deterministic pre-check. Non-empty forces a revision even when
   * the LLM check passes (or fails infrastructurally).
   */
  outOfRangeMarkers: number[];
  /** Set when the verifier call failed or returned a malformed shape. */
  verifierError?: boolean;
}

/**
 * Two-layer check of the draft against its sources and tool results: a
 * deterministic marker-range pre-check (pure regex, cannot fail), then one
 * temperature-0 LLM call for coverage and marker aptness. Never throws: on
 * any LLM failure it logs and passes the LLM layer with
 * `verifierError: true` — the user is not blocked on verifier
 * infrastructure, but the failure is recorded. The deterministic layer
 * still gates in that case.
 */
export async function verifyCitationCoverage(input: {
  draftText: string;
  citations: Citation[];
  toolCalls: ToolCallRecord[];
}): Promise<VerifyResult> {
  const outOfRangeMarkers = findOutOfRangeMarkers(
    input.draftText,
    input.citations.length,
  );
  try {
    const model = await withRoleFallback(
      { role: "composer", temperature: 0 },
      (m) => m.withStructuredOutput(VerifySchema, { name: "verify_citations" }),
    );
    const result: unknown = await model.invoke([
      { role: "system", content: VERIFY_CITATIONS_SYSTEM },
      {
        role: "user",
        content: `Draft answer:\n${input.draftText}\n\nRetrieved sources:\n${formatSourcesBlock(input.citations)}\n\nTool results:\n${formatToolBlock(input.toolCalls)}`,
      },
    ]);
    // Defensive: structured output is typed but not runtime-guaranteed. A
    // malformed shape must surface as verifierError, never a silent pass.
    const parsed = VerifySchema.safeParse(result);
    if (!parsed.success) {
      throw new Error(
        `malformed verifier output: ${JSON.stringify(result)?.slice(0, 200)}`,
      );
    }
    const unsupportedClaims = parsed.data.unsupportedClaims;
    return {
      pass: unsupportedClaims.length === 0 && outOfRangeMarkers.length === 0,
      unsupportedClaims,
      outOfRangeMarkers,
    };
  } catch (err) {
    console.error(
      "[coach] citation verifier failed; passing draft through unverified",
      {
        error: err instanceof Error ? err.message : String(err),
        draftChars: input.draftText.length,
        citationCount: input.citations.length,
        toolCallCount: input.toolCalls.length,
      },
    );
    // The deterministic layer needs no model: out-of-range markers still
    // force a revision attempt even when the LLM verifier is down.
    return {
      pass: outOfRangeMarkers.length === 0,
      unsupportedClaims: [],
      outOfRangeMarkers,
      verifierError: true,
    };
  }
}

/** Minimal slice of a specialist subgraph's state the verify node reads. */
interface VerifiableState {
  subQuestion: string;
  citations: Citation[];
  toolCalls: ToolCallRecord[];
  draftText: string;
}

/**
 * Factory for the `verify` node each specialist subgraph adds after compose.
 * Runs the verifier; when claims are unsupported, performs exactly ONE
 * revision — re-invoking the same compose model with the original compose
 * messages plus an instruction listing the unsupported claims — then ends.
 * No second verification loop, by design.
 */
export function makeVerifyReviseNode(options: {
  /** The specialist's compose system prompt, reused verbatim for revision. */
  composeSystem: string;
  /** False for specialists whose compose message has no tool block (corrective). */
  includeToolBlock: boolean;
}) {
  return async function verifyNode(
    state: VerifiableState,
  ): Promise<{ draftText?: string; citationCheck?: CitationCheck }> {
    const check = await verifyCitationCoverage({
      draftText: state.draftText,
      citations: state.citations,
      toolCalls: state.toolCalls,
    });

    const markersOutOfRangeTelemetry =
      check.outOfRangeMarkers.length > 0
        ? { markersOutOfRange: check.outOfRangeMarkers.length }
        : {};

    if (check.pass) {
      return {
        citationCheck: {
          unsupportedCount: check.unsupportedClaims.length,
          revised: false,
          ...(check.verifierError ? { verifierError: true } : {}),
        },
      };
    }

    // Rebuild the original compose user message (same deterministic format
    // the compose node used), then ask for one grounded revision.
    const sourcesBlock = formatSourcesBlock(state.citations);
    const composeContent = options.includeToolBlock
      ? `Question: ${state.subQuestion}\n\nRetrieved sources:\n${sourcesBlock}\n\nTool results:\n${formatToolBlock(state.toolCalls)}`
      : `Question: ${state.subQuestion}\n\nRetrieved sources:\n${sourcesBlock}`;
    const problems = [
      ...check.outOfRangeMarkers.map(
        (n) =>
          `- The inline marker [${n}] does not refer to any of the ${state.citations.length} numbered retrieved sources. Replace it with the correct source number, or cut the claim if no provided source supports it.`,
      ),
      ...check.unsupportedClaims.map((c) => `- ${c}`),
    ];
    const claimsList = problems.join("\n");

    try {
      const model = await withRoleFallback(
        { role: "composer", temperature: 0.2, maxTokens: 2048 },
        (m) => m.withStructuredOutput(ReviseSchema, { name: "compose_finding" }),
      );
      const result = await model.invoke([
        { role: "system", content: options.composeSystem },
        { role: "user", content: composeContent },
        { role: "assistant", content: state.draftText },
        {
          role: "user",
          content: `A citation review found the following problems in your answer (claims unsupported by the provided sources and tool results, missing or wrong inline [n] markers, or markers pointing at nonexistent sources):\n${claimsList}\n\nRevise your answer: for each listed problem, either ground the claim in the provided sources/tool results with the correct inline [n] marker(s), or cut it entirely. Change nothing else.`,
        },
      ]);
      return {
        draftText: result.text,
        citationCheck: {
          unsupportedCount: check.unsupportedClaims.length,
          revised: true,
          ...markersOutOfRangeTelemetry,
          ...(check.verifierError ? { verifierError: true } : {}),
        },
      };
    } catch (err) {
      // Revision infrastructure failed: keep the original draft, record it.
      console.error(
        "[coach] citation revision failed; keeping original draft",
        {
          error: err instanceof Error ? err.message : String(err),
          unsupportedCount: check.unsupportedClaims.length,
          markersOutOfRange: check.outOfRangeMarkers.length,
        },
      );
      return {
        citationCheck: {
          unsupportedCount: check.unsupportedClaims.length,
          revised: false,
          ...markersOutOfRangeTelemetry,
          verifierError: true,
        },
      };
    }
  };
}
