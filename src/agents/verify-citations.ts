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
// The verifier is a second, temperature-0 model call that sentence-splits the
// draft and lists every substantive claim not supported by the retrieved
// sources or tool results. Its prompt embeds CITE_OR_DROP_RULE from
// shared-rules.ts so the compose rule and the verify rule can never drift
// apart. Max ONE revision, by design: no second verification loop.
//
// Failure policy: a failed or malformed verifier call must never block the
// user. It logs with context and passes the draft through with
// `verifierError: true` recorded on the finding — visible, not silent.

import { z } from "zod";
import { withRoleFallback } from "@/lib/with-fallback";
import type { Citation, CitationCheck, ToolCallRecord } from "@/state";
import { CITE_OR_DROP_RULE } from "./shared-rules";

export const VERIFY_CITATIONS_SYSTEM = `You are a citation-coverage verifier for a health-coach specialist. The specialist composed a draft answer under this rule:

${CITE_OR_DROP_RULE}

Your job: check whether the draft obeys it. Sentence-split the draft. For every sentence, decide whether it makes a SUBSTANTIVE claim or recommendation — a factual statement or a piece of advice — and if so, whether the provided retrieved sources or tool results support it. List every substantive claim or recommendation that is NOT supported by them, quoting or closely paraphrasing each one.

Exemptions — do NOT list these:
- Conversational framing: greetings, transitions, restating the user's situation or question.
- Safety referrals such as "consult a physician / physical therapist / registered dietitian" — these are policy, not factual claims.

If every substantive claim is supported, return an empty list.`;

const VerifySchema = z.object({
  unsupportedClaims: z
    .array(z.string())
    .describe(
      "Every substantive claim or recommendation in the draft not supported by the provided sources or tool results. Empty when the draft is fully covered.",
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
  /** Set when the verifier call failed or returned a malformed shape. */
  verifierError?: boolean;
}

/**
 * One temperature-0 LLM call that checks the draft against its sources and
 * tool results. Never throws: on any failure it logs and returns
 * `pass: true` with `verifierError: true` — the user is not blocked on
 * verifier infrastructure, but the failure is recorded.
 */
export async function verifyCitationCoverage(input: {
  draftText: string;
  citations: Citation[];
  toolCalls: ToolCallRecord[];
}): Promise<VerifyResult> {
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
    return { pass: unsupportedClaims.length === 0, unsupportedClaims };
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
    return { pass: true, unsupportedClaims: [], verifierError: true };
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
    const claimsList = check.unsupportedClaims
      .map((c) => `- ${c}`)
      .join("\n");

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
          content: `A citation review found the following claims in your answer unsupported by the provided sources and tool results:\n${claimsList}\n\nRevise your answer: for each listed claim, either ground it in the provided sources/tool results or cut it entirely. Change nothing else.`,
        },
      ]);
      return {
        draftText: result.text,
        citationCheck: {
          unsupportedCount: check.unsupportedClaims.length,
          revised: true,
        },
      };
    } catch (err) {
      // Revision infrastructure failed: keep the original draft, record it.
      console.error(
        "[coach] citation revision failed; keeping original draft",
        {
          error: err instanceof Error ? err.message : String(err),
          unsupportedCount: check.unsupportedClaims.length,
        },
      );
      return {
        citationCheck: {
          unsupportedCount: check.unsupportedClaims.length,
          revised: false,
          verifierError: true,
        },
      };
    }
  };
}
