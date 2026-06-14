# ffprobe-wasm compatibility test matrix

Package under test: **ffprobe-wasm@0.3.1**

Machine-readable source: [`compatibility/test-matrix.json`](../compatibility/test-matrix.json)

## How to use this matrix

1. Generate fixtures: `npm run fixtures:generate`
2. Start dev server: `npm run dev`
3. Open **Compatibility suite**: `http://localhost:5173/#/compatibility`
4. Run all tests and download CSV
5. Copy results into [`compatibility-report-template.md`](./compatibility-report-template.md)
6. Update [`compatibility-recommendation.md`](./compatibility-recommendation.md) with findings

## Recording fields (per test case)

| Field | Description |
| --- | --- |
| Analyze success/failure | Did `FFprobeWorker.getFileInfo()` resolve without throwing? |
| Container format | Detected `format.format_name` |
| Codec detection | Primary video/audio `codec_name` |
| FPS detection | Parsed from `avg_frame_rate` / `r_frame_rate` |
| Bitrate detection | `format.bit_rate` (bps) |
| Width/height | Primary video stream dimensions |
| Duration detection | `format.duration` (seconds) |
| Audio stream detection | Any `codec_type === "audio"` stream |
| Processing time | End-to-end analyze time in ms (includes WASM if first run) |
| Browser compatibility | Chrome / Firefox / Safari / iOS + notes |

---

## 1. Container formats

Baseline: H.264 + AAC, 640×360, 30 fps, 2 s.

| ID | Container | Fixture | Expected container | Expected video | Expected audio | Browser notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FMT-001 | MP4 | `format/mp4-h264-aac-30fps.mp4` | contains `mp4` | h264 | aac | Baseline case |
| TC-FMT-002 | MOV | `format/mov-h264-aac-30fps.mov` | contains `mov` | h264 | aac | Mobile uploads |
| TC-FMT-003 | WebM | `format/webm-vp9-opus-30fps.webm` | contains `webm` | vp9 | opus | Verify WebM support |
| TC-FMT-004 | MKV | `format/mkv-h264-aac-30fps.mkv` | contains `matroska` | h264 | aac | Matroska may be partial |
| TC-FMT-005 | AVI | `format/avi-h264-aac-30fps.avi` | contains `avi` | h264 | aac | Legacy container |
| TC-FMT-006 | FLV | `format/flv-h264-aac-30fps.flv` | contains `flv` | h264 | aac | May be unsupported |
| TC-FMT-007 | M4V | `format/m4v-h264-aac-30fps.m4v` | contains `mp4` | h264 | aac | Extension vs format |

### Results (fill after test run)

| ID | Success | Container | Video codec | Audio codec | FPS | Bitrate | WxH | Duration | Audio? | Time (ms) | Browser | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC-FMT-001 | | | | | | | | | | | | |
| TC-FMT-002 | | | | | | | | | | | | |
| TC-FMT-003 | | | | | | | | | | | | |
| TC-FMT-004 | | | | | | | | | | | | |
| TC-FMT-005 | | | | | | | | | | | | |
| TC-FMT-006 | | | | | | | | | | | | |
| TC-FMT-007 | | | | | | | | | | | | |

---

## 2. Video codecs

| ID | Codec | Container | Fixture | Expected video codec | Browser notes |
| --- | --- | --- | --- | --- | --- |
| TC-VC-001 | H.264 | MP4 | `video-codec/h264-aac-30fps.mp4` | h264 | Primary production codec |
| TC-VC-002 | H.265/HEVC | MP4 | `video-codec/hevc-aac-30fps.mp4` | hevc | Policy + playback differ |
| TC-VC-003 | AV1 | MP4 | `video-codec/av1-aac-30fps.mp4` | av1 | Should trigger AV1 warning |
| TC-VC-004 | VP8 | WebM | `video-codec/vp8-opus-30fps.webm` | vp8 | Older WebM |
| TC-VC-005 | VP9 | WebM | `video-codec/vp9-opus-30fps.webm` | vp9 | Modern WebM |

### Results

| ID | Success | Detected codec | FPS | WxH | Time (ms) | Browser | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-VC-001 | | | | | | | |
| TC-VC-002 | | | | | | | |
| TC-VC-003 | | | | | | | |
| TC-VC-004 | | | | | | | |
| TC-VC-005 | | | | | | | |

---

## 3. Audio codecs

| ID | Audio | Container | Fixture | Expected audio | Expected hasAudio |
| --- | --- | --- | --- | --- | --- |
| TC-AC-001 | AAC | MP4 | `audio-codec/h264-aac-30fps.mp4` | aac | true |
| TC-AC-002 | Opus | WebM | `audio-codec/vp9-opus-30fps.webm` | opus | true |
| TC-AC-003 | MP3 | MP4 | `audio-codec/h264-mp3-30fps.mp4` | mp3 | true |
| TC-AC-004 | None | MP4 | `audio-codec/h264-no-audio-30fps.mp4` | — | false |

### Results

| ID | Success | Detected audio | hasAudio | Preflight warnings | Time (ms) | Browser | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-AC-001 | | | | | | | |
| TC-AC-002 | | | | | | | |
| TC-AC-003 | | | | | | | |
| TC-AC-004 | | | | | | | |

---

## 4. Special cases

| ID | Case | Fixture | Key expectations | Browser notes |
| --- | --- | --- | --- | --- |
| TC-SP-001 | Variable frame rate | `special/vfr-h264-aac.mp4` | FPS may be missing/unreliable | Compare avg vs r frame rate |
| TC-SP-002 | 24 fps | `special/h264-aac-24fps.mp4` | FPS ≈ 24 | |
| TC-SP-003 | 30 fps | `special/h264-aac-30fps.mp4` | FPS ≈ 30 | |
| TC-SP-004 | 60 fps | `special/h264-aac-60fps.mp4` | FPS ≈ 60 | |
| TC-SP-005 | 120 fps | `special/h264-aac-120fps.mp4` | FPS ≈ 120; may warn at max | |
| TC-SP-006 | 4K | `special/h264-aac-4k-30fps.mp4` | 3840×2160 | Memory/time risk |
| TC-SP-007 | Long duration | `special/h264-aac-long-30fps.mp4` | duration ≈ 600 s | May warn on max duration |
| TC-SP-008 | Corrupted | `special/corrupted-truncated.mp4` | analyze should fail | Graceful error required |
| TC-SP-009 | Wrong extension | `special/h264-aac-wrong-ext.mp3` | still detects MP4/H.264 | Extension irrelevant |
| TC-SP-010 | A/V duration mismatch | `special/av-duration-mismatch.mp4` | mismatch warnings | 4 s video, 2 s audio |

### Results

| ID | Success | FPS | Duration | WxH | Warnings | Time (ms) | Browser | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC-SP-001 | | | | | | | | |
| TC-SP-002 | | | | | | | | |
| TC-SP-003 | | | | | | | | |
| TC-SP-004 | | | | | | | | |
| TC-SP-005 | | | | | | | | |
| TC-SP-006 | | | | | | | | |
| TC-SP-007 | | | | | | | | |
| TC-SP-008 | | | | | | | | |
| TC-SP-009 | | | | | | | | |
| TC-SP-010 | | | | | | | | |

---

## 5. Browser compatibility matrix

Run the full suite on each target browser and record pass/fail counts.

| Browser | Version | OS | COOP/COEP | Tests run | Pass | Fail | Mismatch | Avg time (ms) | Blockers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome | | desktop | required | | | | | | |
| Firefox | | desktop | required | | | | | | |
| Safari | | macOS | required | | | | | | |
| Safari | | iOS | required | | | | | | |
| Edge | | desktop | required | | | | | | |

### Known browser requirements

- **SharedArrayBuffer** requires cross-origin isolation (`COOP: same-origin`, `COEP: require-corp`)
- **iOS Safari** must be tested on device; simulator may differ
- First run downloads ~3 MiB gzip lazy chunk per origin

---

## 6. Summary scorecard (fill after all runs)

| Category | Tests | Pass | Fail | Mismatch | Reliability |
| --- | --- | --- | --- | --- | --- |
| Formats | 7 | | | | |
| Video codecs | 5 | | | | |
| Audio codecs | 4 | | | | |
| Special cases | 10 | | | | |
| **Total** | **26** | | | | |

Reliability guidance:

- **High** — ≥95% pass with correct metadata
- **Medium** — 80–94% or frequent missing fields
- **Low** — <80% or critical format failures

See [`compatibility-recommendation.md`](./compatibility-recommendation.md) for final production guidance.
