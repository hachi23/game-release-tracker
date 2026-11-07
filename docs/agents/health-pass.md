# Version health pass

Run this after every version's features are done and before its release PR (step 7.1 in each version plan). It keeps the codebase healthy as it grows: each step names the skill that does it and what to produce. Work on the release branch; each step that changes code is its own commit.

Fixed point for every step: the previous release tag (for example `v0.7.0` when releasing 0.8.0).

| # | Step | Skill | Produces |
|---|---|---|---|
| 1 | **Review the whole version.** Standards (does it follow AGENTS.md, CONTEXT.md and the ADRs?) and spec (does it do what each issue asked?). | `/code-review` since the last tag (Matt Pocock's `mattpocock-skills:code-review`), plus the built-in `/code-review high` for correctness bugs | A list of findings; fix each confirmed one in a commit named "Fix code-review findings in the X.Y.Z work" |
| 2 | **Security.** Anything new that reads files, takes input from the user or a file, talks to the network, or changes the local API guard. | `/security-review` | Findings fixed, or recorded as accepted risks in DOCUMENTATION.md |
| 3 | **Chase anything flaky or slow.** Every test that failed intermittently, every bug report or slow screen found while building the version. | `/diagnosing-bugs` | A reproduction test first, then the fix; nothing is fixed without a failing test |
| 4 | **Architecture.** Look for shallow modules, leaky interfaces and logic in the wrong layer that the version added (routes doing work, views doing data rules, duplicated workflows). | `mattpocock-skills:codebase-design` | Deepening changes as separate commits, or issues for larger ones; CODEBASE_MAP.md updated |
| 5 | **Simplify.** Dead code, needless abstractions, repeated code the version added. | `/simplify` | A clean-up commit ("Health pass: …") with no behavior change |
| 6 | **Domain language and decisions.** Every new term in the code is in CONTEXT.md and used consistently; every decision that cost something has an ADR; no code silently contradicts an ADR. | `mattpocock-skills:domain-modeling` | CONTEXT.md and `docs/adr/` updated |
| 7 | **Agent guide.** AGENTS.md still describes the important modules, rules and checks accurately. | `mattpocock-skills:writing-for-agents` | AGENTS.md updated |
| 8 | **Measure.** Test count, coverage, lint, package size and boot time against the previous release. | `npm test`, `npm run coverage`, `npm run lint`, `npm run smoke` | Numbers recorded in the version's CHANGELOG notes for reviewers and in the README |

Then run the full checks (AGENTS.md "Required Checks", including the packaged smoke test) and open the release PR.

## When to use the other skills during a version

- `/grilling`: on any spec marked **(grill)** in the version plan, before code.
- `mattpocock-skills:prototype`: when a UI or state model is unclear; throw the prototype away afterwards.
- `mattpocock-skills:research`: before depending on an outside API or format (IGDB, iCalendar, OAuth providers).
- `mattpocock-skills:tdd`: for every feature and bug fix.
- `mattpocock-skills:resolving-merge-conflicts`: when parallel checkpoint branches meet.
