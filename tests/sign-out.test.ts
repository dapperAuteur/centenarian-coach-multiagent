// tests/sign-out.test.ts
// "Sign out" vs "Sign out of WitUS everywhere" (BAM, 2026-10-29, witus task 128
// option (b)). The click ORDER is tested on the pure steps in
// src/lib/sign-out-flow.ts; the buttons are rendered to HTML (this repo has no
// DOM test environment, so no clicks) to pin names, presence, and the
// aria-describedby link to the help text.

import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { signOutEverywhere, signOutHere } from "@/lib/sign-out-flow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/actions/auth", () => ({ signOutAction: async () => {} }));

const { default: SignOutButton, SignOutEverywhereButton } = await import(
  "@/components/SignOutButton"
);

const ENDSESSION =
  "https://accounts.witus.online/api/idp/oauth2/endsession?client_id=witus-coach";
const ORIGIN = "https://centenarian-coach-multiagent.witus.online";
const HELP =
  "Also signs you out of WitUS. Other WitUS apps you are signed in to stay signed in until you sign out of them.";

function buttonText(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
}

describe('"Sign out" (signOutHere)', () => {
  it("ends the local session, then goes local, never to the IdP", async () => {
    const events: string[] = [];
    await signOutHere({
      endLocalSession: async () => {
        events.push("local");
      },
      goLocal: () => events.push("go-local"),
    });
    expect(events).toEqual(["local", "go-local"]);
  });

  it("still goes local when the local sign-out fails", async () => {
    const events: string[] = [];
    await signOutHere({
      endLocalSession: async () => {
        events.push("local");
        throw new Error("network");
      },
      goLocal: () => events.push("go-local"),
    });
    expect(events).toEqual(["local", "go-local"]);
  });
});

describe('"Sign out of WitUS everywhere" (signOutEverywhere)', () => {
  it("ends the local session BEFORE navigating to the IdP", async () => {
    const events: string[] = [];
    let release: () => void = () => {};
    const run = signOutEverywhere({
      endLocalSession: () =>
        new Promise<void>((resolve) => {
          events.push("local-start");
          release = () => {
            events.push("local-done");
            resolve();
          };
        }),
      endSessionUrl: ENDSESSION,
      origin: ORIGIN,
      assign: (url) => events.push(`assign:${url}`),
    });
    await Promise.resolve();
    expect(events).toEqual(["local-start"]);
    release();
    await run;
    expect(events[1]).toBe("local-done");
    expect(events[2]).toMatch(/^assign:/);
  });

  it("navigates to endsession with client_id and post_logout_redirect_uri = origin + '/'", async () => {
    let to = "";
    await signOutEverywhere({
      endLocalSession: async () => {},
      endSessionUrl: ENDSESSION,
      origin: ORIGIN,
      assign: (url) => {
        to = url;
      },
    });
    expect(to).toBe(
      `${ENDSESSION}&post_logout_redirect_uri=${encodeURIComponent(`${ORIGIN}/`)}`,
    );
    const url = new URL(to);
    expect(url.pathname).toBe("/api/idp/oauth2/endsession");
    expect(url.searchParams.get("client_id")).toBe("witus-coach");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(`${ORIGIN}/`);
  });

  it("still hands off when the local sign-out errors (awaited, error swallowed)", async () => {
    const events: string[] = [];
    await signOutEverywhere({
      endLocalSession: async () => {
        events.push("local");
        throw new Error("network");
      },
      endSessionUrl: ENDSESSION,
      origin: ORIGIN,
      assign: () => events.push("assign"),
    });
    expect(events).toEqual(["local", "assign"]);
  });
});

describe("the rendered controls", () => {
  it('"Sign out" is named exactly that and carries no end-session URL', () => {
    const html = renderToStaticMarkup(createElement(SignOutButton));
    expect(buttonText(html)).toEqual(["Sign out"]);
    expect(html).not.toContain("endsession");
    expect(html).not.toContain("WitUS");
  });

  it("the everywhere control is absent when no end-session URL was resolved", () => {
    expect(
      renderToStaticMarkup(createElement(SignOutEverywhereButton, { endSessionUrl: null })),
    ).toBe("");
  });

  it("appears beside Sign out when configured, with help linked by aria-describedby", () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(SignOutButton),
        createElement(SignOutEverywhereButton, { endSessionUrl: ENDSESSION }),
      ),
    );
    expect(buttonText(html)).toEqual(["Sign out", "Sign out of WitUS everywhere"]);
    const describedBy = html.match(
      /<button\b[^>]*aria-describedby="([^"]+)"[^>]*>Sign out of WitUS everywhere<\/button>/,
    )?.[1];
    expect(describedBy).toBeTruthy();
    const escaped = (describedBy as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const help = html.match(new RegExp(`<span\\b[^>]*id="${escaped}"[^>]*>([^<]*)</span>`))?.[1];
    expect(help).toBe(HELP);
  });
});
