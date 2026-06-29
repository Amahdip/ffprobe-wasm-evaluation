# Dynamic Max-Bitrate PoC (client-side packet walk)

A standalone test bench inside this evaluation app to **measure desktop performance,
UI rendering, and the bitrate math** for a content-aware `maxrate`, before doing
anything in `akuma`.

> ⚠️ This is a **benchmark, not a shipping path.** The architecture review concluded
> the real home for this is akuma's server-side preprocess (the source file lands
> there anyway, and `videoanalyze/gop.go` already runs a richer `-show_frames`
> probe). This PoC exists purely to get real numbers on real desktop hardware.

## Where it lives

- Route: open the app and click the floating **“Bitrate PoC →”** button (bottom-right),
  or go to `#/bitrate-poc`.
- Files added:
  | Layer | File |
  |---|---|
  | C packet walk | `wasm-build/ffprobe-mini.c` → `walk_video_packets()` |
  | Build flags | `wasm-build/build.sh` (exports `_walk_video_packets`, `HEAPF64`) |
  | Worker `walk` msg | `public/engines/minimal-metadata/ffprobe.worker.js` |
  | Main-thread bridge | `src/lib/bitrate-poc/walk-packets.ts` |
  | Stats (the math) | `src/lib/bitrate-poc/analyze.ts` |
  | Synthetic generator | `src/lib/bitrate-poc/synthetic.ts` |
  | Page + benchmark UI | `src/components/BitratePocPage.tsx` |
  | Hash router + nav | `src/components/Root.tsx`, `src/main.tsx` |

## The pipeline

1. **File input** — desktop user selects a local video.
2. **Streaming demux (WORKERFS)** — the existing Web Worker mounts the `File` and
   reads byte-ranges lazily; no full-file copy into WASM memory.
3. **Packet walk (WASM)** — `walk_video_packets()` demuxes `v:0` **without decoding**
   and returns a packed `Float64Array` of `[pts_sec, size_bytes, keyflag]` triples
   (binary, not a giant JSON string). The worker copies it once and **transfers** the
   buffer to the main thread (zero-copy).
4. **Math (TS)** — `analyzePackets()` finds the **single ultimate 10s window**:
   - a **sliding window** (second-by-second) over per-second non-keyframe (P+B)
     byte sums picks the heaviest = peak motion density;
   - **CBR-trap defense:** the coefficient of variation (stddev/mean) of the
     tumbling-segment sizes is computed; if it's below `cbrThreshold` the source
     is flat/CBR (e.g. Premiere 10 Mbps), packet sizes carry no motion signal, so
     it falls back to the **video midpoint** (skips static opening credits);
   - `maxBitrate = chosenWindow_bitrate × headroomFactor` (default 1.3) — but this
     is **source-derived** (a preview). The real maxrate is decided server-side in
     akuma by re-encoding the chosen window; the client cannot encode.
5. **UI** — Chosen Time-Span + CBR badge (with the measured CV) + SVG histogram
   (the “bell curve”) + per-segment bitrate timeline (chosen window highlighted) +
   `performance.now()` counters + a Chart.js-ready dataset for the akuma dashboard.

   `Run synthetic (VBR)` and `Run synthetic (CBR)` let you watch the selection
   switch from sliding-peak to midpoint without a video.

## Running it

```bash
npm run dev      # then open the printed URL, click "Bitrate PoC →"
```

- **Run synthetic** — works immediately, no rebuild. Validates the math, the chart,
  and the perf harness on a deterministic 10-min synthetic timeline
  (calm → busy → **noise** → busy).
- **Select video & run WASM** — requires the WASM rebuilt with the new export
  (below). This is what produces the real demux-throughput numbers on 1–2 GB files.

## Rebuilding the WASM (required for real files)

The committed `ffprobe.wasm` predates `walk_video_packets`. Rebuild with Emscripten:

```bash
cd wasm-build
source emsdk/emsdk_env.sh      # or activate your own emsdk
./build.sh                     # downloads FFmpeg 7.1, compiles, writes to public/engines/minimal-metadata/
```

`build.sh` already exports the new symbols:
- `EXPORTED_FUNCTIONS += _walk_video_packets`
- `EXPORTED_RUNTIME_METHODS += HEAPF64`

No decoder is needed (we never decode), so the walk works for every demuxer enabled
in `build.sh`, regardless of codec.

## What to look for in the numbers

- **Demux throughput (MB/s)** on 1 GB vs 2 GB — this is the headline cost. The walk
  reads the **whole file** (unlike metadata, which only touches headers), so expect it
  to scale with file size and be disk/IO-bound, not CPU-bound.
- **Total execution time** — import + walk + math + render.
- **Math time** — sub-millisecond even for hours of packets (it's just summation).

## Known limitations (carried from the review — do not “fix” in the PoC)

- `keyflag` marks **IDR only** (the packet K-flag). Non-IDR scene-cut I-frames count
  as non-keyframes here, same as `-show_packets`.
- `size` reflects the **source** encoder's rate control, so the kbps is a relative /
  source-peak signal, not an absolute target for your encoder.
- The per-segment **average** is below the true instantaneous peak; `headroomFactor`
  is where that gap is (crudely) absorbed.
- **The noise trap is real and intentional:** on the VBR synthetic timeline the sliding
  peak lands in the noise stretch (highlighted in the timeline). A production version
  needs a grain discount before this sets a real ceiling — the PoC surfaces it rather
  than hiding it.
- **CBR sources are detected, not trusted:** a flat distribution (low CV) flips selection
  to the midpoint, because on a CBR export every window looks identical and the packet
  sizes cannot reveal motion. The real defense is the server-side re-encode in akuma.
