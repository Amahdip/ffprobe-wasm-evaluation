# ffprobe-wasm production recommendation

Package: **ffprobe-wasm@0.3.1**  
Evaluation type: uploader preflight validation (client-side)  
Status: **Preliminary** — update after completing the full compatibility suite in target browsers

Related docs:

- [Compatibility test matrix](./compatibility-test-matrix.md)
- [Report template](./compatibility-report-template.md)
- [CSV results template](./compatibility-results-template.csv)
- [Bundle evaluation](./ffprobe-wasm-evaluation.md)

---

## Recommendation

**Use ffprobe-wasm before upload.**

### Pros
- Codec detection works
- AV1 detection works
- HEVC detection works
- FPS works
- Duration works
- Bitrate works
- Audio detection works
- Container detection works
- Extension mismatch detection works

### Cons
- ~2.9 MiB gzip lazy chunk
- AVI/FLV unsupported
- Corrupted files fail
- Dimensions require codec_width/codec_height fallback
- Some metadata fields (rotation/HDR) not yet verified

### Decision
Recommended as a pre-upload warning layer. **Not** recommended as authoritative validation. Backend ffprobe/Akuma remains the source of truth.

---

## Strengths

1. **Runs entirely in the browser** — no round-trip needed for basic metadata checks at file selection time.
2. **Lazy-loadable** — main app bundle stays ~200 KiB raw; ffprobe-wasm ships in a separate ~2.9 MiB gzip chunk loaded on demand.
3. **ffprobe-like JSON** — output shape is close enough to map into existing preflight rules (`format`, `streams`, codec names, duration, bit_rate).
4. **Good fit for common upload profiles** — MP4/MOV + H.264 + AAC is the expected happy path for most consumer uploads.
5. **Reusable preflight logic** — normalization and validation already isolated in `src/lib/ffprobe/` for porting to production uploader code.
6. **No worker/WASM path configuration** — browser bundle is self-contained; avoids same-origin worker issues when lazy-loaded.

---

## Weaknesses

1. **Large first-load cost** — ~8.2 MiB raw / ~2.9 MiB gzip lazy chunk; noticeable on slow or mobile networks.
2. **Not full ffprobe** — bundled libav supports a **subset** of containers/codecs; some formats will fail or return incomplete metadata.
3. **Metadata gaps on edge cases** — FPS (`0/0`), bitrate (`0`), and duration may be missing or estimated on VBR/long/corrupt files.
4. **Package age** — last published 2022; no guarantee of modern codec/container coverage (AV1, HEVC, etc.).
5. **Single-threaded UX impact** — first analyze waits for download + WASM init; needs deliberate loading UI.
6. **No separate `.wasm` cache key in Vite build** — entire payload is one JS chunk; cache granularity is coarse.

---

## Limitations

| Area | Limitation |
| --- | --- |
| **Containers** | Not all of MP4/MOV/WebM/MKV/AVI/FLV/M4V guaranteed; FLV and MKV are higher risk |
| **Codecs** | AV1/HEVC/VP8/VP9 depend on bundled libav; detection ≠ playback support |
| **FPS** | VFR and some containers yield missing or misleading `avg_frame_rate` / `r_frame_rate` |
| **Bitrate** | Often absent or `0` on VBR or short clips |
| **Duration** | May be estimated from size/bitrate when not stored |
| **Rotation / HDR** | Display matrix and HDR metadata inconsistent; not in normalized preflight output |
| **Corrupt files** | Behavior varies — must fail gracefully without hanging the uploader |
| **Security** | Requires `SharedArrayBuffer` → **COOP/COEP** on every page that runs preflight |
| **iOS** | Works only with cross-origin isolation; must validate on real devices |
| **Third-party assets** | `COEP: require-corp` can break embeds/scripts lacking CORP/CORS |

---

## Production risks

| Risk | Severity | Description |
| --- | --- | --- |
| Headers not deployed | **Critical** | Without COOP/COEP, ffprobe-wasm fails entirely in production |
| False confidence | **High** | Passing client preflight does not guarantee server transcode success |
| Mobile first-load | **High** | ~3 MiB download before first analyze on cellular |
| Format blind spots | **High** | Unsupported container returns error or partial data — uploader must not crash |
| AV1/HEVC policy | **Medium** | Detection may work while downstream pipeline rejects codec |
| VFR FPS rules | **Medium** | False `fps_missing` or wrong FPS can block valid uploads |
| Memory on 4K/long files | **Medium** | Whole file read into browser for analysis — large uploads stress client |
| Stale dependency | **Medium** | No active maintenance signal; security/feature updates unclear |

---

## Decision matrix

| Criterion | Threshold | Current assessment |
| --- | --- | --- |
| Main bundle impact | ffprobe not in main chunk | **Pass** (lazy chunk confirmed) |
| Common format support (MP4/H.264/AAC) | Must analyze successfully | **Likely pass** — verify in suite |
| Browser coverage | Chrome + Safari + iOS | **Needs test** — isolation headers required |
| Edge-case metadata | Acceptable miss rate with fallback | **Conditional** — VFR/bitrate/duration unreliable |
| Upload UX latency | First analyze < acceptable SLA | **Marginal** — depends on network |
| Standalone gate without server | Required for "USE" | **Fail** — subset + missing fields |

---

## Recommended integration pattern

```
User selects file
       │
       ▼
Lazy-load ffprobe-wasm (if not loaded)
       │
       ▼
Client analyze + preflight warnings
       │
       ├── success + complete metadata ──► show warnings, allow continue
       │
       ├── success + missing fields ─────► show warnings + "will verify on server"
       │
       └── failure / timeout ────────────► skip client check, server validates
       │
       ▼
Upload proceeds (subject to server-side authoritative ffprobe)
```

### Client preflight should

- Block only on **hard client errors** you explicitly define (optional)
- Warn on AV1, missing audio, missing video, duration/FPS/bitrate issues
- Surface loading state for WASM download/init

### Server must still

- Re-validate all acceptance criteria
- Handle formats ffprobe-wasm cannot parse
- Be the source of truth for transcoding pipeline compatibility

---

## When to choose each option

| Option | Choose when |
| --- | --- |
| **USE** | All target formats/codecs pass suite; COOP/COEP deployed everywhere; acceptable first-load UX; server also validates but client is primary |
| **DO NOT USE** | Cannot deploy isolation headers; majority formats fail; mobile UX unacceptable; zero server fallback available |
| **USE WITH FALLBACK** ✓ | Want fast feedback for common cases; can deploy COOP/COEP; server ffprobe remains authoritative (**recommended**) |

---

## Next steps before production

1. Run full suite: `npm run fixtures:generate && npm run dev` → `#/compatibility`
2. Execute all **26 tests** on Chrome, Firefox, Safari macOS, Safari iOS
3. Fill CSV template and compatibility report
4. Test with **real user upload samples** (not only synthetic ffmpeg fixtures)
5. Confirm production CDN/origin sends COOP/COEP on upload routes
6. Define SLA for first-analyze latency and loading UI copy
7. Port `src/lib/ffprobe/*` into uploader with server fallback hook

---

## Preliminary test results

> Updated after Chrome matrix run (amir, 2026-06-14).

| Metric | Value |
| --- | --- |
| Tests executed | **26 / 29** (3 new cases added since — re-run recommended) |
| Analyze success | **24 / 26** (92%) |
| Hard failures | AVI, FLV (`table index is out of bounds`) |
| Expected failure | Corrupted/truncated file |
| Dimension conclusion | **`ffprobe_wasm_limitation`** on all successful video samples |
| Width/height in output | **0×0** despite correct codec/FPS/duration |

### Field reliability (Chrome run)

| Field | Reliable? |
| --- | --- |
| Container format | Yes |
| Video/audio codec | Yes |
| hasVideo / hasAudio | Yes |
| Duration | Mostly yes |
| FPS | Mostly yes (VFR case inconclusive) |
| Bitrate | Mostly yes |
| Width / height | **No** — raw stream fields also 0 |
| AVI / FLV | **No** — WASM error |

**Change recommendation to USE or DO NOT USE only after Safari/iOS matrix re-run.**
