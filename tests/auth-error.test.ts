// tests/auth-error.test.ts
// Where a failed sign-in goes.
//
// The expensive failure this pins is a REGRESSION OF THE EMAIL FLOW. `pages.error`
// is a single URL for every Auth.js failure, and in @auth/core 0.41.2 both
// AccessDenied (the admin gate refusing a non-admin) and Verification (an expired
// magic link) are plain AuthErrors whose `kind` is "error" — they land on the same
// page. If /signin routed the whole page to the waitlist, an admin whose link
// expired would be told they have no access. So the code is read and branched on,
// and that branching is pinned here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WAITLIST_PATH,
  authErrorAction,
  errorCodeFromSearchParams,
} from "@/lib/auth-error";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("AccessDenied goes to the waitlist and asks", () => {
  it("redirects, rather than rendering a dead end", () => {
    expect(authErrorAction("AccessDenied")).toEqual({
      kind: "redirect",
      to: WAITLIST_PATH,
    });
  });

  it("lands on a page that offers to join, wired to the existing waitlist API", () => {
    const page = stripComments(read("src/app/waitlist/page.tsx"));
    expect(page).toMatch(/WaitlistJoinForm/);
    const form = stripComments(read("src/app/waitlist/WaitlistJoinForm.tsx"));
    // The mechanism is the one that already exists: POST /api/waitlist inserts
    // into the `waitlist` table and mirrors to the WitUS Inbox. No second
    // waitlist was invented, and nothing pretends to record without an API call.
    expect(form).toMatch(/fetch\("\/api\/waitlist"/);
    expect(form).toMatch(/method:\s*"POST"/);
    // "You're on the list" is only reachable after the API said ok.
    expect(form).toMatch(/if \(!res\.ok\)[\s\S]*?setStatus\("error"\)/);
  });

  it("keeps /waitlist public — a refused visitor has no session by definition", () => {
    const middleware = stripComments(read("middleware.ts"));
    expect(middleware).not.toMatch(/waitlist/);
  });
});

describe("the email flow does not regress into a waitlist pitch", () => {
  it("tells an expired magic link apart from a refused account", () => {
    const action = authErrorAction("Verification");
    expect(action?.kind).toBe("notice");
    if (action?.kind !== "notice") throw new Error("unreachable");
    expect(action.title).toMatch(/expired/i);
    expect(action.body).toMatch(/fresh one/i);
    // The word that must never appear on this branch.
    expect(`${action.title} ${action.body}`).not.toMatch(/waitlist/i);
  });

  it("never redirects anything but AccessDenied", () => {
    const codes = [
      "Verification",
      "Configuration",
      "OAuthCallbackError",
      "OAuthSignin",
      "OAuthCallback",
      "OAuthAccountNotLinked",
      "AccountNotLinked",
      "CredentialsSignin",
      "MissingCSRF",
      "WebAuthnVerificationError",
      "SomethingAuthjsAddsLater",
    ];
    for (const code of codes) {
      expect(authErrorAction(code)?.kind).toBe("notice");
    }
  });

  it("gives an unknown code a notice rather than silence", () => {
    // A sign-in page that looks untouched after a failed sign-in is the wall this
    // change removes.
    const action = authErrorAction("TotallyNewCode");
    expect(action).toEqual({
      kind: "notice",
      title: "Sign-in did not complete",
      body: "Something went wrong on the way back. Try again, or use your email below.",
    });
  });

  it("does nothing at all when there is no error on the URL", () => {
    for (const code of [null, undefined, "", "   "]) {
      expect(authErrorAction(code)).toBeNull();
    }
  });
});

describe("reading the code off the URL", () => {
  it("takes the first value when Next hands over a repeated param", () => {
    expect(errorCodeFromSearchParams({ error: ["AccessDenied", "Verification"] })).toBe(
      "AccessDenied",
    );
  });

  it("treats absent, empty, and non-string as no error", () => {
    expect(errorCodeFromSearchParams(undefined)).toBeNull();
    expect(errorCodeFromSearchParams({})).toBeNull();
    expect(errorCodeFromSearchParams({ error: "" })).toBeNull();
    expect(errorCodeFromSearchParams({ error: [] })).toBeNull();
  });
});

describe("the config actually routes failures here", () => {
  it("points pages.error at /signin", () => {
    const config = stripComments(read("src/auth.config.ts"));
    expect(config).toMatch(/pages:\s*\{\s*signIn:\s*"\/signin",\s*error:\s*"\/signin"\s*\}/);
  });

  it("makes /signin act on the code instead of ignoring it", () => {
    const page = stripComments(read("src/app/signin/page.tsx"));
    expect(page).toMatch(/authErrorAction/);
    expect(page).toMatch(/errorCodeFromSearchParams/);
    expect(page).toMatch(/redirect\(action\.to\)/);
  });
});
