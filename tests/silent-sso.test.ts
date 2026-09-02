// tests/silent-sso.test.ts
// The silent ecosystem-SSO check ("Continue as <name>") and global sign-out.
//
// Pinned here in order of what each would cost if it broke:
//   1. THE NAME IS NOT A CREDENTIAL. It crosses an origin boundary, so it is
//      client-supplied. It may only ever reach a label, sanitized.
//   2. THE REDIRECT LOOP. probe -> "Continue as X" -> click -> IdP declines ->
//      back to /signin -> probe -> forever. It never appears in normal use, so
//      the guard is simulated end to end below.
//   3. INVISIBLE FAILURE. Nothing the probe can return may produce an error, a
//      stuck spinner, or a claim about who the visitor is.
//   4. SIGN-OUT ORDERING. The local session must be destroyed BEFORE the hand-off
//      to the IdP, or an unreachable IdP leaves the person signed in here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  endSessionEndpointFromDiscovery,
  endSessionUrlForOrigin,
  hasAttemptMarker,
  parseSilentSsoIdentity,
  silentSsoDecision,
  silentSsoEndpointFromDiscovery,
  withAttemptMarker,
} from "@/lib/silent-sso";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

/** Assertions about what the CODE does must not be satisfied (or broken) by a comment. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DISCOVERY =
  "https://accounts.witus.online/api/idp/.well-known/openid-configuration";
const ENDPOINT = "https://accounts.witus.online/api/ecosystem/session";

describe("the configuration gate: no probe without a registered client", () => {
  it("stays dark when ecosystem SSO is not configured, whatever else is true", () => {
    for (const endpoint of [null, undefined, ""]) {
      for (const search of ["", "?sso=tried"]) {
        for (const signedIn of [false, true]) {
          expect(silentSsoDecision({ endpoint, search, signedIn })).toEqual({
            attempt: false,
            skip: "not-configured",
          });
        }
      }
    }
  });

  it("attempts on a configured client's clean first visit", () => {
    expect(silentSsoDecision({ endpoint: ENDPOINT, search: "" })).toEqual({
      attempt: true,
    });
  });

  it("does not ask on behalf of someone already signed in here", () => {
    expect(silentSsoDecision({ endpoint: ENDPOINT, signedIn: true })).toEqual({
      attempt: false,
      skip: "already-signed-in",
    });
  });

  it("is enforced on the sign-in page, not only inside the component", () => {
    const page = stripComments(read("src/app/signin/page.tsx"));
    // The endpoint is resolved on the server and handed down; the client never
    // reads the raw env.
    expect(page).toMatch(/witusSilentSsoEndpoint/);
    expect(page).toMatch(/witusSsoEnabled/);
    expect(stripComments(read("src/app/signin/WitusSsoButton.tsx"))).not.toMatch(
      /process\.env/,
    );
  });
});

describe("the loop guard", () => {
  it("recognises the query-param half in either form", () => {
    expect(hasAttemptMarker("?sso=tried")).toBe(true);
    expect(hasAttemptMarker("sso=tried")).toBe(true);
    expect(hasAttemptMarker("?next=%2Fcoach&sso=tried")).toBe(true);
    for (const s of [null, undefined, "", "?sso=nope", "?next=/coach"]) {
      expect(hasAttemptMarker(s)).toBe(false);
    }
  });

  it("adds the marker without dropping an existing query or hash", () => {
    expect(withAttemptMarker("/signin")).toBe("/signin?sso=tried");
    expect(withAttemptMarker("/signin?next=%2Fcoach")).toBe(
      "/signin?next=%2Fcoach&sso=tried",
    );
    expect(withAttemptMarker("/signin#top")).toBe("/signin?sso=tried#top");
  });

  it("stops the loop: a second visit carrying either half never probes again", () => {
    // First visit: clean, so we ask.
    expect(silentSsoDecision({ endpoint: ENDPOINT, search: "" })).toEqual({
      attempt: true,
    });
    // The click writes the sessionStorage marker, the IdP fails, we come back.
    expect(
      silentSsoDecision({ endpoint: ENDPOINT, search: "", attempted: true }),
    ).toEqual({ attempt: false, skip: "already-attempted" });
    // Or the browser has no usable sessionStorage and only the param survives.
    expect(
      silentSsoDecision({ endpoint: ENDPOINT, search: "?sso=tried" }),
    ).toEqual({ attempt: false, skip: "already-attempted" });
  });

  it("writes the marker BEFORE the redirect, not after the return", () => {
    const src = stripComments(read("src/app/signin/WitusSsoButton.tsx"));
    // The marker is written from the submit button's onClick, which runs before
    // the form's server action navigates to the IdP. A marker written on return
    // is a marker that never exists when the return is what failed.
    expect(src).toMatch(/onClick=\{writeAttempted\}/);
    expect(src).toMatch(/setItem\(SSO_ATTEMPT_STORAGE_KEY, "1"\)/);
    // The key itself is shared across the ecosystem, so it is pinned too.
    expect(SSO_ATTEMPT_STORAGE_KEY).toBe("witus.sso.attempted");
  });

  it("wraps every sessionStorage access in try/catch (it throws in privacy modes)", () => {
    const src = stripComments(read("src/app/signin/WitusSsoButton.tsx"));
    const accesses = src.match(/window\.sessionStorage\./g) ?? [];
    expect(accesses.length).toBeGreaterThan(0);
    expect((src.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(
      accesses.length,
    );
  });
});

describe("the identity is display copy, never a credential", () => {
  it("reads the ecosystem endpoint's shape", () => {
    expect(parseSilentSsoIdentity({ signedIn: true, user: { name: "Ada" } })).toEqual(
      { label: "Ada" },
    );
  });

  it("returns nothing for a signed-out answer or any junk", () => {
    for (const payload of [
      { signedIn: false },
      // A signed-out answer that still carries a stale name must not be believed.
      { signedIn: false, user: { name: "Ada" } },
      null,
      undefined,
      "Ada",
      42,
      {},
      { user: {} },
      { user: { name: "   " } },
      { user: { name: 7 } },
    ]) {
      expect(parseSilentSsoIdentity(payload)).toBeNull();
    }
  });

  it("strips control characters and caps the length", () => {
    const hostile = `\u0000 A\u0007d\u001Fa \u007F`;
    expect(parseSilentSsoIdentity({ user: { name: hostile } })).toEqual({
      label: "Ada",
    });
    const long = "x".repeat(200);
    const label = parseSilentSsoIdentity({ user: { name: long } })!.label;
    expect(label.length).toBeLessThanOrEqual(48);
    expect(label.endsWith("…")).toBe(true);
  });

  it("falls back to the email only when there is no name", () => {
    expect(parseSilentSsoIdentity({ user: { email: "ada@example.com" } })).toEqual(
      { label: "ada@example.com" },
    );
  });

  it("pins the exact button copy in both states", () => {
    expect(continueAsLabel(null)).toBe("Sign in with WitUS");
    expect(continueAsLabel({ label: "Ada" })).toBe("Continue as Ada");
  });

  it("never lets the probe result reach anything but the label", () => {
    const src = stripComments(read("src/app/signin/WitusSsoButton.tsx"));
    // The only thing done with the parsed identity is setIdentity(...), and the
    // only thing done with identity is render it.
    expect(src).toMatch(/setIdentity\(found\)/);
    expect(src).not.toMatch(/body:/);
    expect(src).not.toMatch(/method:\s*"POST"/);
  });
});

describe("a failed probe is invisible", () => {
  it("has no error state, no spinner, and no retry in the component", () => {
    const src = stripComments(read("src/app/signin/WitusSsoButton.tsx"));
    expect(src).not.toMatch(/setError|ErrorNotice|Spinner|retry/i);
    // A bare .catch() that renders nothing is the whole error policy.
    expect(src).toMatch(/\.catch\(\(\) => \{\s*\}\)/);
  });

  it("aborts rather than hanging", () => {
    const src = stripComments(read("src/app/signin/WitusSsoButton.tsx"));
    expect(src).toMatch(/new AbortController\(\)/);
    expect(src).toMatch(/SILENT_SSO_TIMEOUT_MS/);
    expect(src).toMatch(/signal: controller\.signal/);
  });

  it("sends the cross-origin request with credentials and no cache", () => {
    const src = stripComments(read("src/app/signin/WitusSsoButton.tsx"));
    expect(src).toMatch(/credentials: "include"/);
    expect(src).toMatch(/mode: "cors"/);
    expect(src).toMatch(/cache: "no-store"/);
  });
});

describe("endpoints are derived, never a second hardcoded host", () => {
  it("derives the probe endpoint from the configured discovery URL", () => {
    expect(silentSsoEndpointFromDiscovery(DISCOVERY)).toBe(ENDPOINT);
    expect(
      silentSsoEndpointFromDiscovery(
        "https://idp.example.test/auth/.well-known/openid-configuration",
      ),
    ).toBe("https://idp.example.test/api/ecosystem/session");
  });

  it("derives the end-session endpoint from the same URL, keeping the basePath", () => {
    expect(endSessionEndpointFromDiscovery(DISCOVERY)).toBe(
      "https://accounts.witus.online/api/idp/oauth2/endsession",
    );
  });

  it("returns null rather than guessing when the discovery URL is missing or odd", () => {
    for (const bad of [null, undefined, "", "not-a-url", "https://x.test/nope"]) {
      expect(silentSsoEndpointFromDiscovery(bad)).toBeNull();
      expect(endSessionEndpointFromDiscovery(bad)).toBeNull();
    }
  });

  it("names the IdP host in exactly one file", () => {
    // src/auth.ts used to carry its own copy of the discovery default.
    expect(stripComments(read("src/auth.ts"))).not.toMatch(
      /\.well-known\/openid-configuration/,
    );
    expect(stripComments(read("src/lib/witus-sso.ts"))).toMatch(
      /accounts\.witus\.online/,
    );
  });
});

describe("global sign-out", () => {
  const BASE =
    "https://accounts.witus.online/api/idp/oauth2/endsession?client_id=witus-coach";

  it("appends post_logout_redirect_uri with the REQUIRED trailing slash", () => {
    const url = endSessionUrlForOrigin(
      BASE,
      "https://centenarian-coach-multiagent.witus.online",
    );
    expect(url).toBe(
      `${BASE}&post_logout_redirect_uri=${encodeURIComponent("https://centenarian-coach-multiagent.witus.online/")}`,
    );
    // better-auth exact-matches this against the client's registered redirectUrls
    // (gemini/witus registers origin + "/"). Without the slash the IdP returns 400.
    expect(decodeURIComponent(url.split("post_logout_redirect_uri=")[1])).toMatch(
      /\/$/,
    );
  });

  it("does not double the slash when the origin already has one", () => {
    expect(
      endSessionUrlForOrigin(BASE, "https://centenarian-coach-multiagent.witus.online/"),
    ).toContain(encodeURIComponent("https://centenarian-coach-multiagent.witus.online/"));
  });

  it("uses ? when the endpoint carries no query yet", () => {
    expect(
      endSessionUrlForOrigin("https://idp.test/oauth2/endsession", "https://app.test"),
    ).toBe(
      `https://idp.test/oauth2/endsession?post_logout_redirect_uri=${encodeURIComponent("https://app.test/")}`,
    );
  });

  it("carries client_id, which better-auth requires without an id_token_hint", () => {
    expect(stripComments(read("src/lib/witus-sso.ts"))).toMatch(
      /client_id=\$\{encodeURIComponent\(clientId\)\}/,
    );
  });

  it("destroys the local session BEFORE handing off to the IdP", () => {
    const src = stripComments(read("src/components/SignOutButton.tsx"));
    const destroy = src.indexOf("await signOutAction()");
    const handoff = src.indexOf("window.location.assign");
    expect(destroy).toBeGreaterThan(-1);
    expect(handoff).toBeGreaterThan(-1);
    // If the IdP is unreachable the person must still be signed out here.
    expect(destroy).toBeLessThan(handoff);
  });

  it("uses a full navigation, not a router push, to leave this origin", () => {
    const src = stripComments(read("src/components/SignOutButton.tsx"));
    expect(src).toMatch(/window\.location\.assign\(/);
    // router.push survives only as the local-only fallback, after the early return.
    expect(src.indexOf("window.location.assign")).toBeLessThan(
      src.indexOf("router.push"),
    );
  });

  it("reads the origin at click time instead of hardcoding a host", () => {
    const src = stripComments(read("src/components/SignOutButton.tsx"));
    expect(src).toMatch(/window\.location\.origin/);
    expect(src).not.toMatch(/witus\.online/);
  });

  it("falls back to local-only sign-out when SSO is not configured", () => {
    const src = stripComments(read("src/components/SignOutButton.tsx"));
    expect(src).toMatch(/if \(endSessionUrl\) \{/);
    expect(src).toMatch(/router\.push\("\/"\)/);
    // And the label tells the truth about which one happened.
    expect(src).toMatch(/"Sign out of WitUS"/);
    expect(src).toMatch(/"Sign out"/);
  });

  it("resolves the endpoint on the server at every call site", () => {
    for (const rel of ["src/app/admin/page.tsx", "src/app/coach/page.tsx"]) {
      expect(stripComments(read(rel))).toMatch(/witusEndSessionEndpoint/);
    }
    expect(stripComments(read("src/components/SignOutButton.tsx"))).not.toMatch(
      /process\.env/,
    );
  });
});

describe('the admin-gated opt-out: this app never says "Continue as <name>"', () => {
  // BAM, 2026-09-01: "dont show them the 'continue as Jane'". Centenarian Coach
  // admits only ADMIN_EMAIL, and it cannot know who the browser is until the OIDC
  // flow has already run — so the only honest implementation is to not ask at all.
  // These pin BOTH halves: the app is opted out, and the mechanism still works for
  // the apps that keep it.

  it("skips the probe outright when the app opts out, however well configured it is", () => {
    for (const search of ["", "?sso=tried"]) {
      for (const signedIn of [false, true]) {
        expect(
          silentSsoDecision({
            endpoint: ENDPOINT,
            search,
            signedIn,
            showContinueAs: false,
          }),
        ).toEqual({ attempt: false, skip: "continue-as-disabled" });
      }
    }
  });

  it("still probes for an app that has not opted out (the shared path is intact)", () => {
    expect(
      silentSsoDecision({ endpoint: ENDPOINT, search: "", showContinueAs: true }),
    ).toEqual({ attempt: true });
    // Omitting the flag keeps today's behaviour for every other ecosystem app.
    expect(silentSsoDecision({ endpoint: ENDPOINT, search: "" })).toEqual({
      attempt: true,
    });
  });

  it("has this app opted out, and says why in the source", () => {
    const sso = read("src/lib/witus-sso.ts");
    expect(stripComments(sso)).toMatch(
      /export const WITUS_SHOW_CONTINUE_AS = false/,
    );
    // The comment is load-bearing: without it a later session "restores" the
    // personalized label as a missing feature.
    expect(sso).toMatch(/admin-gated|ADMIN-GATED/i);
    expect(sso).toMatch(/opt-out, not a deletion|OPT-OUT, NOT A DELETION/i);
  });

  it("wires the opt-out through the page to the button", () => {
    const page = stripComments(read("src/app/signin/page.tsx"));
    expect(page).toMatch(/showContinueAs=\{WITUS_SHOW_CONTINUE_AS\}/);
    const button = stripComments(read("src/app/signin/WitusSsoButton.tsx"));
    expect(button).toMatch(/showContinueAs,?\s*$/m);
    // The flag reaches the decision helper, which is what actually stops the fetch.
    expect(button).toMatch(/silentSsoDecision\(\{[\s\S]*?showContinueAs,[\s\S]*?\}\)/);
  });

  it("keeps the probe implementation and its label helper in place, not deleted", () => {
    // The mechanism is shared with the open apps. An opt-out that deletes the code
    // is not an opt-out.
    expect(continueAsLabel({ label: "Jane" })).toBe("Continue as Jane");
    expect(parseSilentSsoIdentity({ user: { name: "Jane" } })).toEqual({
      label: "Jane",
    });
    expect(stripComments(read("src/app/signin/WitusSsoButton.tsx"))).toMatch(
      /fetch\(endpoint/,
    );
  });
});
