# Tracefield review contract

This directory is the repository-owned policy for independent software reviews
of Tracefield. It renders local photographs and saved image interpretations; its principal risks are leaking images, confusing decorative overlays with analysis, and losing reproducible scene state. Its checklist is written for
those risks; it is not a copy of another repository's checklist.

## Loop contract

- Review the exact current PR head and every stable checklist row.
- Only a concrete `BLOCKING` finding prevents `SHIP`; useful suggestions are
  `NON_BLOCKING` and do not create a fixer round.
- Fix the complete blocker set in one push and reconcile every prior blocker.
- `SHIP` on the current head is an absolute stop.
- After three substantive reviewed revisions without convergence, stop and
  escalate the underlying design or process problem to Rishi.
- Never merge, close, approve, request changes, or bypass branch protection.

`BLOCKING` means merging would create a material security, privacy, data-loss,
data-integrity, correctness or contract failure. A real risk that no checklist
row covers is still `BLOCKING — off-checklist`. Nits, taste and anything the
linters already enforce are never blocking.

## What Tracefield must protect

- **Local privacy.** Library images and exports are served locally; imported projects cannot fetch arbitrary remote URLs or execute content.
- **Saved decisions.** Presentation changes never reinterpret or mutate saved anchors, rationales or candidate edges.
- **Reproducible projects.** Project bundles retain the image, scene, settings, renderer/effect versions and paused frame; incompatible versions fail explicitly.
- **Honest interpretation.** Geometric feature proposals and fictional labels are never presented as semantic detection or measured science.
- **Bounded input.** Validate image dimensions, project size, coordinates, edge endpoints and presentation values before rendering.
- **Predictable image changes.** Concurrent imports cannot replace an active project out of order; processed image caches cannot reuse another image.
- **Export integrity.** Exported stills and recordings use the scene and presentation captured at export start.
- **Preserved artifacts.** Preserve saved scenes and renderer compatibility; describe changed effects and their limits.
- **Executable evidence.** Required checks run without credentials, and skipped checks are reported as skipped.
- **Human merge.** Agents never merge, approve, request changes or bypass branch protection.

- **Automatic image styling.** Image styles use fixed pixel operations only; no model calls, tokens, authored masks or per-image agent styling decisions.

## Evidence contract

A formal review starts with the following contiguous block:

```text
## Tracefield Software Review
REVIEW_SCHEMA: tracefield-software-review-v1
PROFILE_ID: tracefield-software
HEAD_SHA: <full commit SHA>
REVIEWER: <GitHub login>
VERDICT: SHIP | FIX_FIRST | REWORK
BLOCKERS: <integer>
CHECKLIST_COVERAGE: <covered>/<required>
COVERAGE_COMPLETE: YES | NO
```

It then contains `### Checklist coverage`, `### Blocking findings`, and
`### Prior-blocker reconciliation`. Every checklist row appears exactly once.
The gate validates structure, exact-head identity, and reviewer authorization;
it does not care which model, editor, or human produced the analysis. Evidence
may come from Claude, Codex, Cursor, a collaborator, or Rishi directly, provided
the submitted GitHub review is authored by an explicitly trusted login or an
owner/member/collaborator. `REVIEWER` records the GitHub identity that attests
to the evidence, not the tool.

## Checks

| Check | What it proves | Required on `main` |
| --- | --- | --- |
| `check` | JavaScript syntax, scene validation, pure effect/proposal/replay tests and review-profile validation | Yes |
| `secrets` | No credential in the PR's history | Yes |
| `review-required` | A trusted, complete review exists for the exact head | Yes |
| `Remote Independent Review` | Claude produced a review (one possible producer) | No — producer health only |

The Claude reviewer runs automatically on ready pull requests into `main` and
can be dispatched by hand for any PR. It never becomes a required check, so its
quota or credentials can never block a merge. `review-required` is published as
a commit status for the exact head after every push and every review.

## Maintenance

Stable checklist IDs are an interface. Change one only as an intentional
schema migration. The profile is governed from current `main`, so a PR cannot
weaken the policy used to review itself.

Run:

```sh
node --test .github/scripts/validate-review-profile.test.mjs
node .github/scripts/validate-review-profile.mjs \
  .github/review/tracefield-software-review-v1.json \
  --profile-id tracefield-software
```

## Release status

The governing policy is on `main`. The optional remote review producer needs an OAuth secret and GitHub app access; without it, it produces no review. A trusted complete exact-head review is still required. `SHIP` stops fixer work; Rishi merges. CI and secret scanning do not replace review evidence. Branch protection must be verified separately before claiming it is installed.
