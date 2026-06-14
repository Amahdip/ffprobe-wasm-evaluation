# ffprobe-wasm evaluation — Netlify deployment

Production hosting uses **Netlify**. ffprobe-wasm requires **HTTPS** and **cross-origin isolation** (COOP/COEP). Netlify provides HTTPS automatically; headers are set in [`netlify.toml`](../netlify.toml).

## Prerequisites

- Netlify account (GitHub/GitLab/Bitbucket repo connected, or Netlify CLI)
- **ffmpeg** only if you regenerate fixtures locally (`npm run fixtures:generate`)

## Build settings

| Setting | Value |
|---------|--------|
| Build command | `npm run build:deploy` |
| Publish directory | `dist` |
| Node version | 20+ (set `NODE_VERSION=20` in Netlify env if needed) |

These match [`netlify.toml`](../netlify.toml) — Netlify reads them automatically when the file is in the repo root.

### What `build:deploy` does

1. `fixtures:ensure` — verifies committed core fixtures exist
2. `vite build` — app + fixtures → `dist/`

Core fixtures (~1.5 MiB, 27 clips) live in `public/fixtures/` and are **committed to git**. Netlify does not need ffmpeg.

Optional heavy fixtures (4K, 10-minute, real-world imports) are **not** committed — generate locally with `npm run fixtures:generate:optional` or `npm run samples:import-downloads`.

## Deploy via Git (recommended)

1. Push this repo to GitHub (or connect your existing remote).
2. In Netlify: **Add new site → Import an existing project**.
3. Select the repo — Netlify detects `netlify.toml`.
4. Deploy.

Each push to the production branch triggers a new deploy.

## Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
npm run build:deploy
netlify deploy --prod --dir=dist
```

For CI/CD linked to the repo, prefer Git-based deploys so `build:deploy` runs on Netlify’s builders (including fixture generation).

## Verify after deploy

```bash
npm run verify:deployment -- https://your-site.netlify.app
```

Checks: HTTP 200, COOP/COEP headers, fixture manifest, core fixture URLs, test matrix JSON, main JS bundle.

Manual:

1. Open your Netlify URL (HTTPS).
2. Confirm no “Sample videos unavailable” warning.
3. **Test matrix** → **Run all tests** → export CSV / Markdown.
4. **Analyze** → upload a video → **Compare engines**.

## Environment notes

- **HTTPS**: Netlify sites are always served over HTTPS — `SharedArrayBuffer` works (unlike plain HTTP on a LAN IP).
- **COOP/COEP**: Required for ffprobe-wasm; configured in `netlify.toml`.
- **Fixture size**: Core fixtures add ~5–15 MiB to the deploy. Optional/real-world samples increase size; enable only if needed.

## Optional fixtures on Netlify

Heavy optional fixtures are skipped by default. To include them in a one-off build:

```bash
GENERATE_OPTIONAL=1 npm run build:deploy
```

Or set a Netlify build env var and adjust the build command if you need them permanently (increases build time and deploy size).

## Rollback

In the Netlify dashboard: **Deploys** → select a previous successful deploy → **Publish deploy**.
