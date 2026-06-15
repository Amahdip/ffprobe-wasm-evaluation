# ffprobe-test

Evaluation app for **ffprobe-wasm@0.3.1** and future media-analysis engines (Aparat uploader preflight).

## Quick start

```bash
npm install
npm run dev            # core fixtures are already in public/fixtures/
```

Optional: `npm run fixtures:generate` only if you changed the test matrix and need to recreate clips (requires ffmpeg).

````

Open the URL printed by Vite (default `http://localhost:5173`).

## Production build & Netlify deploy

Production includes **committed core test videos** in `public/fixtures/` (~1.5 MiB, 27 clips). They are copied into `dist/fixtures/` by Vite — no ffmpeg needed on Netlify.

```bash
npm run build:deploy   # verify fixtures + production build
````

To **regenerate** core fixtures after matrix changes (requires ffmpeg):

```bash
npm run fixtures:generate
git add public/fixtures/
git commit -m "Update core test fixtures"
```

Deploy to **Netlify** — see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Settings are in [`netlify.toml`](./netlify.toml) (build command, publish dir, COOP/COEP headers).

Verify after deploy:

```bash
npm run verify:deployment -- https://your-site.netlify.app
```

Optional bundle analysis: `npm run build:analyze`.

### Fixture tiers

| Tier               | Command                              | Contents                                                            |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------- |
| **Core** (default) | `npm run fixtures:generate`          | Short synthetic clips (~2s, 640×360) — format, codec, special cases |
| **Optional heavy** | `npm run fixtures:generate:optional` | 4K + 10-minute samples (large)                                      |
| **Real-world**     | `npm run samples:import-downloads`   | DELT GROWTH, Big Buck Bunny from ~/Downloads                        |

Optional fixtures are marked `"optional": true` in the test matrix and skipped unless you enable **Include optional fixtures** in the UI.

## How to run the sample matrix

1. Generate fixtures: `npm run fixtures:generate`
2. Start dev server: `npm run dev`
3. Open **Test matrix** tab — confirm “Fixtures ready” (warning if missing)
4. **Run all tests** → export CSV / Markdown

Fixture URLs resolve to `/fixtures/format/mp4-h264-aac-30fps.mp4` in dev and production.

## How to analyze a single upload

1. Open **Analyze** tab (works even when fixtures are missing)
2. Choose a video → **Compare engines** or **Analyze video**
3. Review comparison table, benchmarks, preflight checks
4. Export JSON / CSV / Markdown

## Bundle sizes

Run `npm run build:analyze` after production build. Expected:

- Main bundle: ~80 KiB gzip (engines not in main chunk)
- ffprobe-wasm lazy chunk: ~2.9 MiB gzip
- minimal-metadata-ffprobe lazy chunk: ~510 KB gzip
- Core fixtures: ~5–15 MiB (depends on codecs generated)

## Architecture

```
src/lib/engines/          # MediaAnalysisEngine registry + adapters
src/lib/comparison/       # side-by-side diff, reliability, benchmarks
src/lib/fixtures/         # fixture URLs + availability checks
src/lib/ffprobe/          # normalization, validation
public/fixtures/          # core sample videos (committed); optional/heavy gitignored
compatibility/            # test-matrix.json
netlify.toml              # Netlify build + COOP/COEP headers
docs/DEPLOYMENT.md        # Netlify deploy checklist
```

## Recommendation (summary)

**Use ffprobe-wasm with fallback** as a lazy-loaded, best-effort pre-upload warning layer. Compare against the Taghi Engine package when available. Backend/Akuma remains authoritative.

## Requirements

- Node.js 18+
- ffmpeg (fixture generation only)
- COOP/COEP headers (configured in `vite.config.ts` and `netlify.toml`)
