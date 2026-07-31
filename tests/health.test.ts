// tests/health.test.ts
// Contract tests for the public /api/health probe. The database is mocked, so
// these run offline as part of the default `pnpm test`.
//
// The load-bearing assertion is the negative one: a failing probe must never
// put the driver's error text (DSN, host, credentials) into the response body.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const execute = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({ execute }),
}));

const SECRET_ISH =
  "connect ECONNREFUSED postgres://coach:hunter2@db.example.neon.tech:5432/main";

beforeEach(() => {
  execute.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function route() {
  return import("@/app/api/health/route");
}

describe("GET /api/health", () => {
  it("returns 200 { ok: true } when the database answers", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    const res = await (await route()).GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("probes with a constant, never a user-scoped table", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    await (await route()).GET();

    const query = JSON.stringify(execute.mock.calls[0]?.[0] ?? "");
    expect(query.toLowerCase()).toContain("select 1");
    for (const table of [
      "coach_sessions",
      "coach_specialist_calls",
      "users",
      "waitlist",
      "count(",
    ]) {
      expect(query.toLowerCase()).not.toContain(table);
    }
  });

  it("returns 503 with a fixed token and no error detail when the probe fails", async () => {
    execute.mockRejectedValue(new Error(SECRET_ISH));
    const res = await (await route()).GET();
    const body = await res.text();

    expect(res.status).toBe(503);
    expect(JSON.parse(body)).toEqual({
      ok: false,
      error: "dependency_unavailable",
    });
    expect(body).not.toContain("ECONNREFUSED");
    expect(body).not.toContain("postgres://");
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("neon.tech");
  });

  it("logs a constant string, never the caught error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValue(new Error(SECRET_ISH));
    await (await route()).GET();

    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).toBe("[health] database probe failed");
  });

  it("gives up on a hung connection after 4 seconds", async () => {
    execute.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();
    try {
      const pending = (await route()).GET();
      await vi.advanceTimersByTimeAsync(4_000);
      const res = await pending;
      expect(res.status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is never cached", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    const res = await (await route()).GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("reports nothing user-scoped in the healthy body", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    const body = await (await (await route()).GET()).text();

    for (const leak of ["user", "session", "query", "finding", "count"]) {
      expect(body.toLowerCase()).not.toContain(leak);
    }
  });
});

describe("HEAD /api/health", () => {
  it("mirrors the status with an empty body", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    const up = await (await route()).HEAD();
    expect(up.status).toBe(200);
    expect(await up.text()).toBe("");

    execute.mockRejectedValue(new Error(SECRET_ISH));
    const down = await (await route()).HEAD();
    expect(down.status).toBe(503);
    expect(await down.text()).toBe("");
    expect(down.headers.get("cache-control")).toContain("no-store");
  });
});
