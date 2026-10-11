# First release

The clean `main` baseline preserves the approved studio and contains no photographs. The production-skill PR adds the portable skill, pinned setup, launch identity checks, canonical ingestion, preservation of authored scenes and portable project export. These changes are not a published stable runtime until review and merge complete.

1. Validate `npm run check`, `npm run check:public`, policy tests, plugin validation and the browser workflow on the exact PR head. Capture the evidence outside this repository; no test images or media go into Git.
2. Obtain a trusted complete Tracefield Software Review for that exact head. A green `Publish exact-head review status` job can still publish a red `review-required` status; inspect the status itself. The optional Claude producer currently requires separately configured credentials.
3. Rishi merges the reviewed PR. The authoring agent must not merge or bypass protection. The private experiment's three PRs are historical work; they need not merge to build this clean continuation.
4. From a clean checkout of the merged `main`, repeat the skill helper and browser workflow with a fresh local lab and a user-supplied photo. Use `--revision <merged-SHA>` for this pre-tag check. Record what was actually tested, including PNG, loop encoding/decoding and portable-project reopening.
5. Once the merged workflow passes, publish an annotated `v0.1.0` tag at that exact commit and a GitHub release. Never move a published release tag. Default skill setup then becomes available. A future release updates package/plugin versions and the helper's default tag together.
6. Verify an anonymous HTTPS clone of `v0.1.0`, install into a temporary agent configuration, and repeat setup and launch. Confirm CI and `review-required` on an ordinary PR before making those stable contexts required by branch protection.

No demo assets are a release prerequisite. Later demos must include explicit provenance/rights and an asset-policy update before entering public history.

Current limitations: fresh agent interpretations can vary; bit-identical media across browsers are not guaranteed; EXIF-rotated JPEGs need upright normalization; WebCodecs encoder availability varies. The skill does not claim support for arbitrary file formats or command-less hosted chat sessions.
