# ffprobe-wasm@0.3.1 evaluation

Isolated test app for evaluating client-side video preflight checks with [`ffprobe-wasm`](https://www.npmjs.com/package/ffprobe-wasm) before integrating into the production uploader.

## Quick start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173`).

Use the file input to choose a video, then click **Analyze video**. ffprobe-wasm is loaded lazily at that point (not on initial page load).

## Production build

```bash
npm run build
npm run preview
```

Or build + print bundle report in one step:

```bash
npm run build:analyze
```

Build output is written to `dist/`.

## Bundle size inspection

After a production build, run:

```bash
npm run analyze
```

This prints raw, gzip, and brotli sizes for every file in `dist/`.

### Latest build results (Vite 8, Jun 2026)

| File | Raw | Gzip | Brotli | Notes |
| --- | --- | --- | --- | --- |
| `assets/index-*.js` (main) | ~198 KiB | ~63 KiB | ~53 KiB | React app shell + preflight helpers |
| `assets/ffprobe-wasm-*.js` | ~8.19 MiB | ~2.89 MiB | ~2.03 MiB | Lazy-loaded chunk |
| `assets/index-*.css` | ~2.2 KiB | ~0.9 KiB | ~0.7 KiB | Test page styles |

Chunk hashes change between builds; re-run `npm run build:analyze` for current values.

### Is ffprobe-wasm lazy-loaded?

**Yes.** The main entry chunk does not include ffprobe-wasm. Vite emits a dedicated chunk (for example `assets/ffprobe-wasm-*.js`) that is fetched only when `import('ffprobe-wasm')` runs — triggered by **Analyze video** in this test app.

Implementation:

- `src/lib/ffprobe/load-ffprobe.ts` uses dynamic `import('ffprobe-wasm')`
- `vite.config.ts` assigns `manualChunks` for `node_modules/ffprobe-wasm`

### `.wasm` file size

**No standalone `.wasm` file is emitted in the Vite build.**

The npm package ships `ffprobe-wasm.wasm` (~2.12 MiB raw in `node_modules`), but the browser entry (`browser.mjs`) is a self-contained bundle (~4.1 MiB raw in node_modules). Vite rolls that into the lazy `ffprobe-wasm-*.js` chunk above. The WASM binary is embedded/inlined in that JS chunk rather than emitted as a separate asset.

## Test UI

Route/page: the entire app (`src/pages/ffprobe-test/FfprobeTestPage.tsx`).

Features:

- Video file input
- **Analyze video** button
- Console + on-screen timing:
  - import ffprobe-wasm
  - initialize WASM worker
  - analyze selected file
- Raw ffprobe JSON output
- Normalized metadata panel
- Preflight warnings/errors

## Preflight helper (reusable)

Logic lives outside the UI so it can move into production uploader code later:

- `src/lib/ffprobe/normalize-metadata.ts` — maps raw ffprobe output to normalized fields
- `src/lib/ffprobe/preflight-validation.ts` — validation rules
- `src/lib/ffprobe/index.ts` — public exports

```ts
import { evaluatePreflight } from './lib/ffprobe'

const result = evaluatePreflight(fileInfo, {
  maxDurationSeconds: 3600,
  minFps: 1,
  maxFps: 120,
  maxBitrateBps: 50_000_000,
})

// result.metadata
// result.warnings
// result.errors
```

### Validation rules (warnings)

| Code | Condition |
| --- | --- |
| `codec_av1` | Video codec is AV1 |
| `no_audio_stream` | No audio stream |
| `no_video_stream` | No video stream |
| `fps_missing` | FPS not determinable |
| `fps_invalid` | FPS ≤ 0 or non-finite |
| `fps_too_low` | FPS below configured minimum |
| `fps_too_high` | FPS above configured maximum |
| `duration_missing` | Duration missing |
| `duration_exceeds_max` | Duration above configured max |
| `dimensions_missing` | Width/height missing when video present |
| `bitrate_missing` | Bitrate missing |
| `bitrate_too_high` | Bitrate above configured max |
| `inconsistent_metadata` | Suspicious cross-field mismatches |
| `stream_count_mismatch` | `format.nb_streams` ≠ parsed stream count |
| `av_duration_mismatch` | Primary audio/video durations differ |

Configurable thresholds are exposed in the test UI (max duration, max bitrate).

## Metadata fields

### Generally available (when container is supported)

From `format`:

- `format_name`, `format_long_name`
- `duration`, `bit_rate`, `size`
- `nb_streams`, `start_time`
- `tags` (container metadata)

From each `stream`:

- `codec_type`, `codec_name`, `codec_long_name`
- `width`, `height` (video)
- `r_frame_rate`, `avg_frame_rate` (video)
- `sample_rate`, `channels`, `channel_layout` (audio)
- `duration`, `bit_rate`, `time_base`
- `disposition`, `tags`

Normalized fields produced by this test app:

- container format
- duration (seconds)
- video/audio codec
- width / height
- fps
- bitrate (bps)
- hasVideo / hasAudio
- video/audio stream counts
- missing + suspicious field lists

### Missing or unreliable

Based on package docs and typical ffprobe-wasm behavior:

- **Not all containers/codecs** supported (subset of FFmpeg libavformat/libavcodec)
- **FPS** can be `0/0` or absent on some files; fallback order is `avg_frame_rate` → `r_frame_rate`
- **Duration** may be estimated from bitrate/size when not stored in container
- **Bitrate** may be `0` or absent on some streams/containers
- **Chapters / private data** may be empty depending on format
- Many stream fields are **video-only or audio-only**; TypeScript types expose all keys but values may be empty/zero for the wrong stream type
- **Rotation / display matrix** not surfaced in normalized output (may exist only in tags on some files)
- **HDR/color metadata** present inconsistently (`color_primaries`, etc.)

Always treat preflight as advisory: validate against real uploader samples per target codec/container matrix.

## Browser compatibility

### SharedArrayBuffer requirement

ffprobe-wasm uses `SharedArrayBuffer` in the browser. The page must be cross-origin isolated:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

This test app sets those headers in `vite.config.ts` for `dev` and `preview`. **Production hosting must send the same headers** (or equivalent isolation) or initialization will fail.

### Safari / iOS

- Safari 15.2+ supports `SharedArrayBuffer` with cross-origin isolation.
- iOS Safari requires the same headers; without them, analysis fails.
- Mobile Safari may be slower to download/init the ~3 MiB gzip chunk on cellular networks.
- Test on real iOS devices before relying on preflight in mobile upload flows.

### Other notes

- Web Workers are used internally; no extra worker URL configuration is needed with ffprobe-wasm’s browser bundle.
- Large lazy chunk: first analysis incurs noticeable download + WASM compile cost (see timing panel).
- COEP `require-corp` may break third-party assets/scripts that lack proper CORS/CORP headers on the same page — isolate this flow or audit embeds.

## Project layout

```
src/
  lib/ffprobe/           # Reusable preflight logic (no UI)
  pages/ffprobe-test/    # Test UI
scripts/
  analyze-build-sizes.mjs
docs/
  ffprobe-wasm-evaluation.md
```

## Production uploader integration (future)

This repo intentionally does **not** modify production uploader behavior. Recommended next steps after evaluation:

1. Copy `src/lib/ffprobe/*` into uploader codebase
2. Keep dynamic `import('ffprobe-wasm')` behind user file selection
3. Ensure upload origin sends COOP/COEP (or run preflight in a dedicated isolated route/worker)
4. Gate upload on `evaluatePreflight()` warnings/errors according to product rules
