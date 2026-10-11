---
name: animate
description: Turn a supplied photograph into a subject-bound constellation overlay in Tracefield, with visible-detail labels, an animated trace and a local studio for blends, markers, PNG, video and portable project export. Use when an image is supplied for a HUD or FUI node-link treatment, constellation study or Tracefield workflow.
---

# Tracefield: photograph → editable constellation study

Inspect the supplied image, declare visible roles and save the interpretation once. The lab uses fixed pixel treatments, geometric links and the approved v3 Trace animation at 2×. Do not generate replacement images, paint masks, redesign the studio or rewrite the renderer for an individual photo.

Needs git, Node 24+, npm and a browser. Initial setup downloads the runtime and locked dependencies. Local rendering makes no model calls; your image inspection follows the host agent's own provider/privacy settings.

## Set up the pinned runtime

Run the helper bundled beside this skill:

```sh
node "<skill-directory>/scripts/setup.mjs"
```

It prints the lab path and exact Git commit. Default: `~/tracefield-lab`, or `$TRACEFIELD_LAB`. It fetches release `v0.1.0`, installs dependencies when needed, and preserves existing studies. A missing release fails explicitly. Use `--lab /absolute/path` for an isolated lab. A maintainer can pass `--repository <URL-or-local-path> --revision <exact-SHA>` to test an unpublished candidate; report that as a candidate, never as the published release.

Do not reset, update or delete an existing lab to make setup pass. An incompatible lab needs a new directory. All following commands run in the returned lab path.

## Add or reuse the photo

```sh
npm run add-image -- "/absolute/path/photo.png" --title "Short title"
```

Accept PNG/JPEG, at most 20 MB and 32 megapixels. The helper normalizes to metadata-free opaque PNG, downscales dimensions above 4096 px to a 2400 px long side and records source hashes. A JPEG requiring EXIF rotation must first be exported as an upright PNG with a photo editor. Do not reinterpret orientation from raw coordinates.

The command prints the study ID. **Reused** means its scene already exists for these bytes: keep the authored decisions and proceed to validation/opening. A different image with the same ID fails; use a new `--id`. Use `--replace` only when the user explicitly asks to replace a saved study and has preserved its project.

## Author the interpretation

For a new draft, view `public/library/<id>/image.png` itself. Choose the focal subject; keep anchors on that subject and a few just around its edge, avoiding unrelated background texture. Inspect the actual pixels again after edits.

Edit `public/library/<id>/scene.json`:

- Write 4–7 `rules.roles` before placing points: lowercase role names and concrete visible criteria, such as `eye` (visible pupil), `fin-tip` (outer fin extremity), `petal-tip` (outer petal extremity) or `rim` (visible boundary of an object). Include `halo` only for deliberate points close to the subject. Choose roles appropriate to this photo; never invent anatomy or object identity the image cannot establish.
- Place roughly 12–24 observation points, fewer for simple subjects. Coordinates are normalized to image width/height. Each point needs a unique ID, `<role>.<nn>` label, `kind: "observation"`, and a short visible-detail rationale. Halo points use `kind: "composition"`. Remove irrelevant draft points and stale `feature` metadata from points you relocate.
- Set a short title/subtitle and up to three `focus` IDs. Keep the image fields and source hashes. Set `analysis.type: "agent-authored"`, `analysis.version: "tracefield-interpretation-v1"` and `analysis.proposalVersion: "feature-proposal-v3"`. This distinguishes your interpretation from pixel measurements.
- `rules.link` describes the **decorative** subject-bound neighbour rule: empty diametral circles, a narrow image-saliency envelope and shortest bridges between disconnected subject parts. It is an aesthetic web, not measured science or a semantic relationship model. Keep the unused `structure` and `pattern` networks with empty edges and meanings explaining that they are unused.

```sh
npm run net -- <id>
npm run validate
```

The web rebuild preserves your points and labels. Review the rendered net: saliency is a heuristic and can misread clutter. If a link reaches unrelated background, revise the offending anchors and rebuild; do not claim object detection. Preserve the approved Trace timing and pixel effects.

## Launch and check

```sh
npm run lab -- --scene <id>
```

Open the returned URL using the host's browser tools. The launcher verifies checkout identity before reusing a server and picks a free loopback port from 4318–4418. Do not assume any response on port 4318 is this lab.

Inspect the settled frame (scrub to the middle) and play a complete cycle. Confirm labels point to visible details, the web stays close to the focal subject, Blend and Markers work, and the Export menu offers Image, Loop and Project. Keep concise notes about the roles and any ambiguity. If browser access is unavailable, report validation as run and visual verification as unperformed.

The user edits presentation in the studio. **Image** downloads a PNG. **Loop** renders and previews MP4/AVC or WebM depending on browser encoders. **Project** downloads the image, scene, settings, renderer/effect IDs and paused frame; **Open project** restores them without interpreting again.

## Repeatability and sharing

New agent interpretations can differ. Saved decisions are the reproducibility boundary: retain the scene, source hashes, project, runtime commit and renderer/effect versions. The same canonical pixels give the same draft; the same scene gives the same logical web and timeline. Browser rasterization and encoding can differ, so do not promise bit-identical media across systems.

Local studies are ignored by Git. Never publish an image, project or export as part of sharing code without the user's explicit sharing instruction and documented image rights. Share a portable project directly when authorized; don't commit private photos to the public repository.
