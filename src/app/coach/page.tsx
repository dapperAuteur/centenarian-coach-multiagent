// src/app/coach/page.tsx
// Thin server wrapper around the coach UI (CoachClient.tsx, a client component).
// Its only job is to resolve server-side env and hand it down: the WitUS
// end-session endpoint that global sign-out navigates to, which is null when this
// app is not a configured ecosystem OIDC client. A client component must never
// read the raw env, which is why this boundary exists at all.

import { witusEndSessionEndpoint } from "@/lib/witus-sso";
import CoachClient from "./CoachClient";

export default function CoachPage() {
  return <CoachClient endSessionUrl={witusEndSessionEndpoint} />;
}
