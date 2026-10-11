# Decide once, present many ways

A Tracefield scene is a saved visual interpretation, not a scientific model. The agent views the input, chooses the focal subject and declares visible point roles before placing anchors. Labels use `<role>.<nn>`; every node has normalized coordinates, a rationale and observation/composition kind. Decorative halo anchors stay close to the subject. The pixel draft is only a starting proposal.

`npm run add-image -- <file>` writes a canonical opaque PNG and draft into the ignored local library. New drafts record `analysis.type: local-feature-proposal`, `analysis.version: feature-proposal-v3`, input/source SHA-256 and ingestion version. An identical input reuses the existing interpretation. A colliding ID fails unless explicit replacement was requested.

After authoring, keep the source hashes and set `analysis.type: agent-authored`, `analysis.version: tracefield-interpretation-v1` and `analysis.proposalVersion: feature-proposal-v3`. Roles, positions and focus are the agent's decisions. Remove stale measured metadata when moving a draft anchor. Keep all three network keys for project compatibility; unused structure/pattern networks have empty edge arrays.

`npm run net -- <id>` applies a fixed decorative neighbour rule to the saved anchors. A Gabriel graph links pairs with empty diametral circles; the image-saliency envelope bounds most links to the subject and a narrow surrounding band, with shortest bridges between separate parts. This envelope is a pixel heuristic, not object segmentation. Review cluttered images visually; revise irrelevant anchors instead of inventing semantic detection claims. Saved links record endpoint-specific geometric reasons. Link ordering keeps the approved top-to-bottom Trace cascade.

`npm run validate` checks source hashes, actual decoded dimensions, node/edge integrity and declared role labels. The scene format retains `version: 1`; portable projects use `version: 2`, `rendererVersion: node-network-renderer-v3` and `effectVersion: negative-dark-field-v2`. Older v2/v4 renderer IDs route to preserved renderers. Unavailable legacy sample-only variations fail explicitly in this empty-library distribution; full projects with embedded images are portable.

Project export embeds the image, scene, presentation settings and paused frame. Reopening does not reinterpret the image. Share the project and runtime commit when repeatability matters. Fresh agent decisions are not deterministic; saved decisions and the fixed code are. Browser antialiasing, font rasterization and codecs can change exact media bytes across systems.

Pixel treatments are automatic equations. No generated replacements, authored masks, model styling or per-image treatment branches. The agent's reasoning selects roles and anchors only.
