# Contributing

Use Node 24+ and `npm ci`. Keep changes focused and open a PR against `main`.

Run `npm run check` before pushing; it covers rendering invariants, replay, input handling, skill packaging, TypeScript and the production build. CI also validates the independent-review policy and scans secrets. Run `npm run check:public` before publishing a fork or release: this initial repository intentionally contains no photographs or exported studies.

Keep interpretation in scene JSON and presentation in the renderer. Preserve the v3 Trace loop, 2× default speed and automatic pixel effects. A new interpretation is an explicit decision change; changing a dial must not rewrite one.

Photos, videos and project bundles in a local library are private by default and ignored by Git. Before contributing a future demo, supply creator, source URL, license and modification details and arrange an explicit asset-policy change. Do not upload private source images to an issue or PR.

Reviews follow [.github/review/README.md](.github/review/README.md). A complete trusted review for the exact commit must reach SHIP; the maintainer merges. Checks and a skipped review producer are separate from a completed independent review.
