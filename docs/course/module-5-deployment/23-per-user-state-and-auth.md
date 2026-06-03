# Module 5 · Lesson 23 · Per-user state and auth on the live coach

> **Tag:** `course/lesson-23` · **Module 5: Deployment + multi-tenant** · ~5 min

A deployed coach faces real users, which raises two questions the local demo could
ignore: who is allowed to use it, and how do you keep one user's data separate from
another's. This lesson is honest about what the repo ships today and what
multi-tenancy would add, because the gap is itself instructive.

## What ships today: single-tenant, admin-gated

The state is single-tenant by design. [`src/state.ts`](../../../src/state.ts) says
so in a comment: "Demo mode is single-tenant: no userId." Each query gets a
`sessionId`, and completed runs are persisted to `coach_sessions` and
`coach_specialist_calls` ([`src/db/schema.ts`](../../../src/db/schema.ts)), but
there is no per-user partition because the live demo is gated to one operator.

Access control is an admin gate, not open sign-up. Auth.js (NextAuth) backs a
magic-link flow, and only `ADMIN_EMAIL` is allowed to sign in; everyone else who
tries lands on a `waitlist` (Auth.js, 2025). That is the right amount of auth for a
gated portfolio demo: the public can see it exists, one person can run it.

## What multi-tenancy adds

To serve many users, you thread identity through the same structures you already
have:

1. **A `userId` on the state.** Add it to `CoachState` and stamp it on each
   `coach_sessions` row, so history and analytics partition by user.
2. **Per-user data scoping.** Reads of sessions and any per-user knowledge filter
   by `userId`. This is the principle of least privilege again (Saltzer &
   Schroeder, 1975), now at the tenant boundary: a user's queries can reach only
   that user's data. If you let users bring their own corpus, the namespace pattern
   from Module 2 extends naturally to per-user namespaces (for example,
   `nutrition_kb:<userId>`).
3. **Real authorization.** The single-`ADMIN_EMAIL` check becomes per-user sessions
   with the same Auth.js machinery already wired; the tables (`user`, `account`,
   `session`) are standard adapter tables and already exist.

The point of naming this gap rather than hiding it: the architecture is *ready* for
multi-tenancy (sessionId, session persistence, an auth layer, namespaced
retrieval), and the work to get there is additive, not a rewrite. That makes
"per-user state" a natural Module 6 extension rather than a missing feature.

### Build on the coach

Open `src/state.ts` and `src/db/schema.ts` and sketch the diff for adding `userId`:
which type gains a field, which table gains a column, and which query gains a
`WHERE userId = ...`. You do not have to implement it. Seeing how small the diff is
the lesson: good isolation at the specialist level (Module 2) and a real auth layer
make tenancy an extension, not a redesign.

## References

Auth.js. (2025). *Auth.js documentation: Email (magic link) provider*. https://authjs.dev

Saltzer, J. H., & Schroeder, M. D. (1975). The protection of information in computer systems. *Proceedings of the IEEE, 63*(9), 1278–1308. https://doi.org/10.1109/PROC.1975.9939

---

Previous: [Lesson 22 · Deploying and wiring env + database](./22-deploying-env-and-database.md) · Next: **[Lesson 24 · Cost and latency dashboards](./24-cost-and-latency-dashboards.md)** · [Course index](../README.md)
