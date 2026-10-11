# Decide once, present many ways

Start by inspecting the actual input image. Choose whether the goal is explanation, pattern discovery or a decorative composition. Ask a follow-up only when that intent materially changes the chosen connections.

**Write the rule set first.** Before placing any point, look at the image and declare `rules`: a list of roles, each with a short `role` name (lowercase, e.g. `wing-apex`, `eyespot`, `fin-edge`) and the `rule` that qualifies a point for it, plus one `link` rule saying which points connect and why. Every node label is then `<role>.<nn>`, every point must satisfy its role's rule, and every edge must satisfy the link rule, with a reason specific to that pair. Prefer link rules that keep the net on the subject or just around its edge. The automatic proposal follows the same shape with generic roles (`focus`, `tip`, `mark`, `contour`, `halo`); an agent scene should replace them with roles specific to what is in the picture.

A semantic scene needs normalized anchor coordinates, a visible detail label, an observation/composition kind, and a rationale for every node. Each network has a title, meaning, and candidate edges with endpoint IDs and reasons. Declare geometric/compositional relationships as such. Never infer hidden anatomy, measured dimensions or biological processes from appearance alone.

Use `public/scenes/orange.json` and `purple.json` as working examples. All scenes include `version: 1`, an ID/title/subtitle, image source/dimensions, nodes, all three network keys (`constellation`, `structure`, `pattern`) and optional focus anchor IDs. Coordinates are in [0,1]; label offsets use the 560 px canonical width. IDs are unique. Images must be the bundled assets or embedded PNGs. Validate with `validateScene` from `public/scene.js`.

**Adding an image:** run `npm run add-image -- <file> --title "Title"`. It copies the image into `public/library/<id>/` and writes `scene.json` as a deterministic draft. Edit that `scene.json` in place: write the rule set, rename and adjust points, write links and reasons, then run `npm run check`. The lab lists the entry automatically.

The draft proposal explicitly records `analysis.type: local-feature-proposal` and `analysis.version: feature-proposal-v3`. It represents measured focus points, silhouette tips, marks, contours and a halo just outside the subject, never object identity.

Nodes may carry an optional `score` and edges an optional `weight`, both in [0, 1]. They order presentation only: the strongest links survive a lower visible-link share, and the most important anchors label and grow first. Give real per-link reasons; a network where every link shares one boilerplate reason does not explain its connections. Prefer connection rules that stay crossing-free (neighbours, backbones, chains) unless crossings are the point. An agent-authored scene should replace those explanations with its own grounded observations and relationship rules; it must not quietly retain a proposal's semantic disclaimer while presenting it as agent reasoning.

To open an authored scene, wrap it as a project with `version: 2`, `rendererVersion: node-network-renderer-v3`, `effectVersion: negative-dark-field-v2`, presentation settings from `defaults` in `scene.js`, and a `time` inside the loop. Embed the input as a white-composited PNG and record its dimensions. Open project in the lab, inspect anchor placement and relationship meaning, then save the reviewed project. This explicit artifact is the handoff between interpretation and customization.

For repeatable output, preserve that project and renderer revision rather than asking an agent to reinterpret the same image each time. Editing dials, motion, marker styles, labels or presets changes presentation. Revising anchors, edge rules or meanings is a new decision artifact and should be reviewed separately.

Image styles are exclusively automatic browser pixel transforms. Do not create masks, call an image model or use agent reasoning to style the image. The same fixed code handles every upload. The agent authors nodes and relationships only.
