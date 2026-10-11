# Security

Tracefield is a local studio. The server binds to `127.0.0.1`; do not expose the development server to the Internet. Rendering and export run in the browser. The agent inspecting an image uses its own provider and privacy settings.

Report a suspected vulnerability through this repository's **Security → Report a vulnerability** channel. Private vulnerability reporting is enabled. If that channel is unavailable, open an issue requesting a private reporting route without posting private images, secrets or exploit details.

Supported releases: the current published release. Include the runtime commit, Node/browser versions and a minimal synthetic reproduction. Source images are not required for an initial report.

Repository controls verified on 2026-10-11: protected `main` with required credential-free CI, secret scan and trusted exact-head review; admin enforcement; no force pushes or main deletion; immutable published `v*` tags; GitHub native secret scanning and push protection; Dependabot vulnerability alerts and security updates. Weekly dependency/action PRs still need review and do not merge automatically. `CODEOWNERS`, contribution guidance and the PR template are tracked.

The optional remote model reviewer may skip if its credentials are unavailable. That does not satisfy or disable `review-required`; trusted complete evidence is still necessary. Security settings reduce risk and do not guarantee that software has no vulnerabilities.
