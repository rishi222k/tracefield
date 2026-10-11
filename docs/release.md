# First release

`v0.1.0` is published at `8fd6a6dacd2510df17d9ea9e3c14ca123ad82616`. Its empty starter library and pinned helper remain unchanged. The following describes that release's sequence; later releases require the same exact-head review and fresh workflow verification.

The clean `main` baseline preserves the approved studio and contains no photographs. The production-skill PR adds the portable skill, pinned setup, launch identity checks, canonical ingestion, preservation of authored scenes and portable project export. These changes are not a published stable runtime until review and merge complete.

1. Validate `npm run check`, `npm run check:public`, policy tests, plugin validation and the browser workflow on the exact PR head. Capture the evidence outside this repository; no test images or media go into Git.
2. Obtain a trusted complete Tracefield Software Review for that exact head. A green `Publish exact-head review status` job can still publish a red `review-required` status; inspect the status itself. The optional Claude producer currently requires separately configured credentials.
3. Rishi merges the reviewed PR. The authoring agent must not merge or bypass protection. The private experiment's three PRs are historical work; they need not merge to build this clean continuation.
4. From a clean checkout of the merged `main`, repeat the skill helper and browser workflow with a fresh local lab and a temporary test image. A user-supplied photo can additionally check the quality of the agent's interpretation; no test image is committed or published. Use `--revision <merged-SHA>` for this pre-tag check. Record what was actually tested, including PNG, loop encoding/decoding and portable-project reopening.
5. Once the merged workflow passes, publish an annotated `v0.1.0` tag at that exact commit and a GitHub release. Never move a published release tag. Default skill setup then becomes available. A future release updates package/plugin versions and the helper's default tag together.
6. Verify an anonymous HTTPS clone of `v0.1.0`, install into a temporary agent configuration, and repeat setup and launch. Confirm CI and `review-required` on an ordinary PR before making those stable contexts required by branch protection.

No demo assets are a release prerequisite. Later demos must include explicit provenance/rights and an asset-policy update before entering public history.

## Gallery contribution

The six generated studies have scoped CC0 provenance in `public/demo-assets.json` and `DEMO_IMAGES_LICENSE.md`. The public-history check accepts only their exact approved bytes; all other studies and exports stay outside Git. CI fetches full history before running this check. Test a clean source checkout and production preview, including image switching and the actual Play control. Preserve PNG, encoded/decoded loop and project-reopen evidence outside the repository.

A source-gallery merge does not update installed `v0.1.0` labs. A new gallery runtime needs a separately reviewed version change, matching package/plugin/helper metadata, a new immutable tag and fresh default-helper acceptance. Never move `v0.1.0` to add the gallery.

Current limitations: fresh agent interpretations can vary; bit-identical media across browsers are not guaranteed; EXIF-rotated JPEGs need upright normalization; WebCodecs encoder availability varies. The skill does not claim support for arbitrary file formats or command-less hosted chat sessions.
