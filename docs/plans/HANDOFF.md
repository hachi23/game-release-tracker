# Handoff: where we are (2026-11-07)

Read this first when picking the work back up, then `docs/plans/0.8.0.md` and `docs/agents/health-pass.md`.

## Done

- **0.7.0 is released.** PR #5 (branch `ccr-7e56d7db-48cxqo`) merged into `main` as `d5e5fb5`. The Release workflow published [v0.7.0](https://github.com/hachi23/game-release-tracker/releases/tag/v0.7.0) with the Windows installer, Windows zip, `.deb` and AppImage, each smoke-tested in CI.
- Checks run before merging: 575 tests in 81 files, typecheck, build and the packaged smoke test, all passing. README and How it works now say 575 tests.
- **0.8.0 plan** written: `docs/plans/0.8.0.md` (7 checkpoints with "done when" criteria, order, risks).
- **Health pass** written: `docs/agents/health-pass.md`, the Matt Pocock skills plus the built-in review, security and simplify steps, run after every version and before its release PR. AGENTS.md links to both.
- Branch `ccr-f5ff34d4-xtgdv9` = `main` + the plan commit. **No PR open for it yet.**

## Not done yet / small leftovers

- The GitHub repo **description** (About box) still says "538 tests". It has to be edited by hand on GitHub (Settings or the About gear).
- The plan has not been turned into GitHub issues or a `0.8.0` milestone yet.

## Decisions still open (answer before planning 0.9.0)

1. **Server access to data:** should the sync server be able to read users' data (simpler, allows a web view later), or should it be end-to-end encrypted (keeps the "nothing to breach" promise)?
2. **Backend:** Supabase (fast and pragmatic) or a custom Fastify sync service (more backend skill to show)?
3. **Code signing for 1.0:** pay for a Windows certificate every year, or record unsigned builds as a decision in an ADR?
4. **Companion app:** a web or mobile companion before 1.0, after it, or never?
5. **Backlog shape (0.8.0 checkpoint 5):** a separate list (recommended) or a status on Completed Games? Settle it with `/grilling`.

## Next steps, in order

1. Answer the open decisions above, then write `docs/plans/0.9.0.md` and `docs/plans/1.0.0.md`, plus ADR 7 ("Sync is optional, and this computer stays the source of truth").
2. Optionally merge the plan commit into `main` (a small docs PR from `ccr-f5ff34d4-xtgdv9`).
3. Create a `0.8.0` milestone and one spec issue per checkpoint (labels from `docs/agents/triage-labels.md`).
4. Start **checkpoint 1: quality gates** (ESLint, coverage floor, size and boot-time budgets, axe checks) on a fresh branch from `main`.

## Prompt to resume

> Read `docs/plans/HANDOFF.md`, then `docs/plans/0.8.0.md`. Here are my answers to the open decisions: … Write the 0.9.0 and 1.0 plans and ADR 7, then set up the 0.8.0 milestone and issues.
