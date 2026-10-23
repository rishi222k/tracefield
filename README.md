# Tracefield

**A photograph becomes an editable constellation study.** Give an agent an image; it chooses visible details, names points and opens a local studio. Adjust the blend, markers and timing, then download a PNG, video loop or portable project.

The style is a **subject-bound constellation overlay**: a decorative node-link web anchored to the focal subject. Its targeting brackets, callouts and tracing motion belong to the visual language of HUDs and fictional interface design (FUI), as seen in [Jorge Almeida's interface work](https://jorgeonline.me/Iron-Man-2). Tracefield is the project's name, rather than a claim that this is a recognized historical style.

> Stable runtime setup fetches the published, immutable `v0.1.0` Git tag. The source gallery below is a later contribution; using the stable skill does not silently change an existing lab or add demo images.

## Use the skill

Requires **git, Node 24+, npm and a browser**, plus an agent that can view images and execute local commands. No image model, API key or global renderer package is required. Initial setup needs network access.

### Claude Code

```text
/plugin install tracefield --marketplace rishi222k/tracefield
/tracefield:animate /absolute/path/to/photo.jpg A short title
```

Alternatively, add the marketplace first and then install the plugin:

```text
/plugin marketplace add rishi222k/tracefield
/plugin install tracefield@tracefield
```

These commands follow the [Claude Code plugin installation docs](https://code.claude.com/docs/en/discover-plugins). The plugin packages the same instructions and helper as the portable skill.

### Codex and other skill-compatible agents

```sh
npx skills add rishi222k/tracefield --skill tracefield
```

The [Skills CLI](https://github.com/vercel-labs/skills) lets you select a supported agent and installation scope. Or copy the complete `skills/tracefield/` folder into your agent's skill directory; retain `scripts/setup.mjs` alongside `SKILL.md`.

Then invoke `$tracefield` in Codex, or ask your agent to use Tracefield with the photo. This is a local coding-agent workflow; a chat environment without file access, image inspection and command execution cannot launch the lab.

The skill sets up the pinned runtime in `~/tracefield-lab` (override with `TRACEFIELD_LAB`), adds or reuses the image, authors the saved scene, validates it and opens the correct local studio. Existing studies are preserved when reused. An incompatible installation needs a fresh lab directory; setup never resets it.

## What you edit

The approved studio has a neutral dark workspace, collapsible image rail, **Original / Network** comparison and a compact inspector:

- **Blend:** Original, Mono, X-ray, Dark X-ray and Blueprint, with intensity controls.
- **Markers:** seven styles, size, accent share, label density and label opacity. Density sets how many labels show; opacity fades label text and callouts without changing which labels are chosen.
- **Timeline:** play, restart, scrub, loop length and speed; the v3 Trace loop defaults to 2×.
- **Import Project:** a separate button beside Export; restores a saved project even when the library is empty.
- **Export:** Image, Loop and Project JSON.

There is no photo upload inside the studio. The agent adds images and authors the rule set; browser controls change presentation without changing those decisions. The current source gallery includes six contributed generated examples. Your own photos still enter through the skill. Published runtime `v0.1.0` retains its original empty library; it is immutable and is not silently updated by a newer source checkout.

## Gallery examples

The gallery includes **Marble Study, Tree Frog, Painted Lady, Swallowtail, Honeybee and Black Horse**. Each has 20–23 authored visible-detail anchors and a saved decorative web. The generator was reported by the contributor as GPT 6; the files are generated illustrations, not wildlife records or documentary photographs.

| Example | Supplied resolution | Anchors |
| --- | --- | --- |
| Marble Study | 940 × 1673 | 22 |
| Tree Frog | 1086 × 1448 | 20 |
| Painted Lady | 1126 × 1397 | 21 |
| Swallowtail | 1086 × 1448 | 22 |
| Honeybee | 1026 × 1533 | 22 |
| Black Horse | 1024 × 1536 | 23 |

The supplied files are below 4K; exports preserve their canonical resolution. No upscaling is claimed. [Demo provenance](public/demo-assets.json) and [CC0 dedication](DEMO_IMAGES_LICENSE.md) cover only these six studies. Other local library files remain ignored and private by default.

Clone the current source and run `npm ci` followed by `npm run lab -- --scene honeybee` to browse them. The skill's pinned `v0.1.0` runtime can ingest supplied copies using its normal workflow, as exercised in the six-image acceptance test. A future gallery runtime needs its own reviewed release tag.

## Repeatability

| Stage | Contract |
| --- | --- |
| Ingestion | The same input bytes produce the same canonical PNG and draft using locked pure-JS decoders. Source hashes are recorded. |
| Interpretation | The agent chooses visible roles and anchors. A fresh interpretation can differ; asking the same prompt again is not deterministic. |
| Saved scene | Roles, points, reasons, focus and geometric connections are retained. Re-adding identical bytes reuses them. |
| Presentation | The saved project and renderer/effect IDs produce the same logical network, settings and timeline. |
| Media | Browser rasterization, fonts and encoding can change exact output bytes across systems. |

**Export → Project JSON** embeds the image, scene, settings, version IDs and paused frame. **Import Project** restores them without asking the agent to interpret again. In the pinned `v0.1.0` studio these controls are named Project and Open project within Export. Preserve the project and exact runtime commit for repeatable work. Unknown renderer/effect versions fail explicitly; preserved v2/v4 renderers handle older full projects. Sample-only legacy variations require the original private lab.

New project JSON uses format v3 to retain label opacity. This source studio imports older v1/v2 projects with unchanged label selection and full opacity. The published `v0.1.0` runtime rejects format v3; import it in this newer studio instead.

The web uses a fixed subject-bound Gabriel-neighbour rule and short bridges between subject parts. Saliency is a pixel heuristic, not semantic segmentation. The agent reviews the settled frame and a complete loop, refining irrelevant anchors when clutter distracts the draft. Labels explain visible features; links are decorative rather than scientific relationships. See [the decision contract](docs/decision-contract.md).

## Local commands

```sh
git clone https://github.com/rishi222k/tracefield.git
cd tracefield
npm ci
npm run add-image -- /absolute/path/photo.png --title "Study"
# Let the agent view the canonical image, then author its scene/rules.
npm run net -- photo
npm run validate
npm run lab -- --scene photo
```

`add-image` accepts PNG/JPEG up to **20 MB / 32 megapixels**. It strips metadata, composites transparency against white and normalizes to PNG. Dimensions above 4096 px downscale to a 2400 px long side. JPEGs with non-upright EXIF orientation need to be exported as upright PNGs first. Preserve your original photo separately. Same-name collisions require a new `--id`; explicit `--replace` replaces a saved study.

`npm run lab` verifies the checkout's server identity and selects a free loopback port in 4318–4418; it never reuses an unrelated app. `npm start -- --port 4319` runs a foreground development server. `npm run build` creates a static local build; `npm run preview -- --port 4319` serves it. Building includes your local library, so a build containing personal studies needs the same sharing permission as those studies.

Images, projects and exports stay in the local renderer. The agent's image inspection follows its host provider's privacy settings. Personal library files are ignored by Git; only the six documented demo studies are tracked. No analytics or remote rendering is included.

## Export formats

**Image** is a PNG at canonical source resolution. **Loop** defaults to the original image dimensions and aspect ratio, with 720/1080 px maximum-dimension options for smaller files and 24/30/60 fps. It renders one complete cycle from time zero and previews before download. It uses MP4/AVC when compatible with the selected dimensions, or WebM/VP9/VP8 otherwise, and supports cancellation. Native odd dimensions are retained exactly; a browser without a compatible encoder gets an explicit error and can use a smaller preset. Fractional timing rounds up by less than one frame; no duplicate endpoint is appended.

X-ray is a photographic-negative effect. Dark X-ray combines local luminance detail with a continuous surface-tone layer; Blueprint uses fixed image-edge operations. They are pixel treatments, with no medical interpretation, segmentation masks or per-image model styling. The approved pixel equations are preserved in `public/image-effects.js`.

## Development and release

```sh
npm run check
npm run check:public
node --test .github/scripts/validate-review-profile.test.mjs
node .github/scripts/validate-review-profile.mjs .github/review/tracefield-software-review-v1.json --profile-id tracefield-software
```

Checks cover pixel treatments, geometric proposals, saved-scene integrity, input bounds, collision preservation, project replay, timeline/export planning, skill packaging, TypeScript and the production build. CI also scans secrets and requires trusted exact-head review evidence; a skipped remote reviewer is not a completed review. See [the review contract](.github/review/README.md) and [release steps](docs/release.md).

The source is a clean continuation of the private Node Network Animation experiment. Its old Git history, photos, reference screenshots and rendered checkpoints have not been copied. The private experiment retains those artifacts.

## License

Original code, skill instructions and helpers are **MIT licensed**. The six contributed gallery images and saved demo studies are **CC0-1.0**; see [their dedication](DEMO_IMAGES_LICENSE.md). Bundled third-party source and fonts retain their licenses: [third-party notices](THIRD_PARTY_NOTICES.md), [font notices](public/fonts/) and [asset provenance](references.md). Your images and exports retain their own rights; the code license does not grant rights to them. Future public demo assets need source, creator and redistribution-license details.

See [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md).
