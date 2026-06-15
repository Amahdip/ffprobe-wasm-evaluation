# ffprobe-test

Browser evaluation app for **ffprobe-wasm@0.3.1** and a custom **minimal-metadata** WASM engine. Compares engines side-by-side for upload preflight (format, codec, duration, resolution, validation policy).

## Requirements

- **Node.js 18+**
- **ffmpeg** — only for regenerating test fixtures (`npm run fixtures:generate`)
- **Emscripten (emsdk)** — only for rebuilding the minimal-metadata WASM from source (`wasm-build/build.sh`)
- **COOP/COEP headers** — required for the full ffprobe-wasm engine; configured in [`vite.config.ts`](vite.config.ts) and [`netlify.toml`](netlify.toml)

## Quick start

```bash
npm install
npm run dev
```

Core test videos are already committed under `public/fixtures/`. Open the URL Vite prints (default `http://localhost:5173`).

Optional: run `npm run fixtures:generate` only after you change the test matrix and need to recreate clips (requires ffmpeg).

## Production build & Netlify deploy

Production ships **28 committed core test videos** in `public/fixtures/` (~1.5 MiB). Vite copies them to `dist/fixtures/` — no ffmpeg on Netlify.

```bash
npm run build:deploy
```

To **regenerate** core fixtures after matrix changes (requires ffmpeg):

```bash
npm run fixtures:generate
git add public/fixtures/
git commit -m "Update core test fixtures"
```

Deploy to **Netlify** — see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Settings live in [`netlify.toml`](netlify.toml).

Verify after deploy:

```bash
npm run verify:deployment -- https://your-site.netlify.app
```

Optional bundle analysis:

```bash
npm run build:analyze
```

### Fixture tiers

| Tier | Command | Contents |
| --- | --- | --- |
| **Core** (default) | `npm run fixtures:generate` | Short synthetic clips (~2s, 640×360) — format, codec, special cases |
| **Optional heavy** | `npm run fixtures:generate:optional` | 4K + 10-minute samples (large, gitignored) |
| **Real-world** | `npm run samples:import-downloads` | DELT GROWTH, Big Buck Bunny from `~/Downloads` |

Optional fixtures are marked `"optional": true` in the test matrix and skipped unless **Include optional fixtures** is enabled in the UI.

## How to run the sample matrix

1. `npm run dev` (fixtures are pre-committed; generation step optional)
2. Open the **Test matrix** tab — confirm “Fixtures ready”
3. **Run all tests** → export CSV / Markdown

Fixture URLs resolve to paths like `/fixtures/format/mp4-h264-aac-30fps.mp4` in dev and production.

## How to analyze a single upload

1. Open the **Analyze** tab (works without fixtures)
2. Choose a video → **Compare engines** or **Analyze video**
3. Review comparison table, benchmarks, and preflight checks
4. Export JSON / CSV / Markdown

## Bundle sizes

Run `npm run build:analyze` after a production build. Typical results:

- Main app shell: ~63–80 KiB gzip (engine code is lazy-loaded)
- ffprobe-wasm lazy chunk: ~2.9 MiB gzip
- minimal-metadata engine: ~480–510 KiB gzip (standalone `.wasm` + loader)
- Core fixtures: ~1.5 MiB committed (optional/heavy fixtures add more locally)

## Rebuild minimal-metadata WASM (optional)

```bash
cd wasm-build
source emsdk/emsdk_env.sh   # or activate your own emsdk
./build.sh
```

Output is written to `public/engines/minimal-metadata/`. The repo commits prebuilt artifacts so normal `npm run dev` / `npm run build` does not require emsdk.

## Architecture

```
src/lib/engines/          # MediaAnalysisEngine registry + adapters
src/lib/comparison/       # side-by-side diff, reliability, benchmarks
src/lib/fixtures/         # fixture URLs + availability checks
src/lib/ffprobe/          # normalization, validation, policy
public/fixtures/          # core sample videos (committed)
public/engines/           # minimal-metadata WASM artifacts
compatibility/            # test-matrix.json
wasm-build/               # ffprobe-mini.c source + Emscripten build script
netlify.toml              # Netlify build + COOP/COEP headers
docs/                     # deployment and compatibility notes
```

## Recommendation (summary)

Use **minimal-metadata** or **ffprobe-wasm with fallback** as a lazy-loaded, best-effort pre-upload warning layer. Browser engines are not authoritative — server-side validation remains the source of truth.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| ffprobe-wasm fails to load | Page must be served with COOP/COEP (Vite dev server and Netlify set these). Needs `crossOriginIsolated` and SharedArrayBuffer. |
| “Fixtures missing” on Test matrix | Run `npm run fixtures:ensure` or `npm run fixtures:generate`, then commit `public/fixtures/`. |
| `emcc not found` when building WASM | Activate Emscripten: `source wasm-build/emsdk/emsdk_env.sh` |
| Build fails on Netlify | Check `npm run fixtures:ensure` in `prebuild`; core fixtures must be in git. |
| Empty or broken `package.json` | Restore from git: `git checkout HEAD -- package.json` |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | ESLint |
| `npm run fixtures:generate` | Regenerate core fixtures (ffmpeg) |
| `npm run fixtures:ensure` | Fail build if core fixtures missing |
| `npm run verify:deployment` | Smoke-test a deployed URL |
