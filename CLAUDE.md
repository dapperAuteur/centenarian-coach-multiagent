@AGENTS.md

---

## Branch hygiene — BAM merges, between sessions by default

**Half 1.** End-of-branch contract: branch → commit → push → stop. Claude does not run `git checkout main && git merge`. Never `--force` to shared branches. After push, hand back the branch name + summary and stop.

**Half 2.** BAM merges committed-and-pushed branches via the GitHub UI before the next session starts, unless explicitly told otherwise. At session start the local checkout is typically fresh-from-main. **Mid-session, after a push, BAM may merge in a separate window and the local checkout silently fast-forwards to `main`.** Re-check `git branch --show-current` before EVERY commit, not just at branch creation, or you risk landing follow-up commits directly on `main` and bypassing the merge gate.

**Half 3.** Keep branches small (one concern per branch). When a session produces multiple branches, Claude consolidates them into one `bundle/<slug>-YYYY-MM-DD` branch before handoff: merge the small branches in lowest-conflict-risk order using `git merge --no-ff` (preserves per-concern history — non-negotiable, no squash), resolve any 3-way conflicts during bundling, run a final `tsc + lint + build` against the bundle, push, and file ONE user-task at `./plans/user-tasks/NN-merge-bundle-<slug>.md` for BAM to merge bundle → main. The small branches stay on the remote for drill-down history; **BAM does one merge, not N.**

A checked-in `.githooks/pre-commit` guard refuses commits made directly on `main`/`master`. Activate it once per clone: `git config core.hooksPath .githooks`.

Full rule with rationale: `gemini/witus/CLAUDE.md` §"Branch-hygiene rule".

---

## Plans convention

All implementation plans live in `./plans/` as markdown named `NN-description-of-plan.md` — two-digit numeric prefix, kebab-case slug, next available number, don't skip. Sub-queues: `./plans/user-tasks/NN-slug.md` (operator tasks), `./plans/bugs/`, `./plans/future/`. (`plans/` is typically gitignored — local working notes.) Full rule: `gemini/witus/CLAUDE.md` §"Plans convention".
