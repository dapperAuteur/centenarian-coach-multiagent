// src/lib/submit-to-inbox.ts
// Thin wrapper around the verbatim WitUS Inbox sender. Reads the three
// INBOX_* env vars directly (matching this repo's convention — no validated
// env module). When any of them is unset, log once and short-circuit so dev
// and self-hosted setups work without the integration configured.

import { sendToInbox, type InboxSubmission } from "./inbox-sender";

export async function submitToInbox(submission: InboxSubmission) {
  const url = process.env.INBOX_INGEST_URL;
  const secret = process.env.INBOX_INGEST_SECRET;
  const slug = process.env.INBOX_SOURCE_SLUG;

  if (!url || !secret || !slug) {
    console.log("[inbox] dev-log fallback (env unset):", submission.form_type);
    return { ok: false as const, status: 0, detail: "env unset" };
  }

  return sendToInbox({
    inboxUrl: url,
    hmacSecret: secret,
    sourceSlug: slug,
    submission,
  });
}
