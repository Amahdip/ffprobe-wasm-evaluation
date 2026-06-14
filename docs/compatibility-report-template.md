# ffprobe-wasm compatibility report

> Copy this template for each evaluation cycle. Fill placeholders in `{curly braces}`.

## Report metadata

| Field | Value |
| --- | --- |
| Report ID | `{COMP-YYYY-MM-DD-001}` |
| Package version | ffprobe-wasm@0.3.1 |
| App commit / branch | `{git-sha}` |
| Tester | `{name}` |
| Test date | `{YYYY-MM-DD}` |
| Environment | `{dev / preview / staging}` |
| Browsers tested | `{Chrome, Firefox, Safari, iOS Safari, …}` |

## Executive summary

{2–3 sentences: overall reliability, biggest gaps, recommended action.}

**Recommendation:** `{USE / DO NOT USE / USE WITH FALLBACK}`

---

## 1. Test scope

### In scope

- Client-side preflight metadata extraction before upload
- Container formats: MP4, MOV, WebM, MKV, AVI, FLV, M4V
- Video codecs: H.264, HEVC, AV1, VP8, VP9
- Audio codecs: AAC, Opus, MP3, no audio
- Special cases: VFR, 24/30/60/120 fps, 4K, long duration, corrupted, wrong extension, A/V duration mismatch

### Out of scope

- `{e.g. server-side transcoding validation, thumbnail generation, DRM content}`

### Test assets

- Fixture generator: `npm run fixtures:generate`
- Matrix definition: `compatibility/test-matrix.json`
- Total test cases: **26**

---

## 2. Build / deployment impact

| Metric | Value |
| --- | --- |
| Main bundle (gzip) | `{e.g. 63 KiB}` |
| ffprobe-wasm lazy chunk (gzip) | `{e.g. 2.89 MiB}` |
| ffprobe-wasm lazy chunk (brotli) | `{e.g. 2.03 MiB}` |
| Standalone `.wasm` emitted | `{Yes / No — No for Vite build}` |
| Lazy loaded | `{Yes / No}` |
| SharedArrayBuffer required | Yes |
| COOP/COEP required | Yes |

---

## 3. Results overview

### Scorecard

| Category | Tests | Pass | Fail | Mismatch | Pass rate |
| --- | --- | --- | --- | --- | --- |
| Formats | 7 | | | | |
| Video codecs | 5 | | | | |
| Audio codecs | 4 | | | | |
| Special cases | 10 | | | | |
| **Total** | **26** | | | | |

### Browser summary

| Browser | Pass rate | Avg analyze time (ms) | Critical failures |
| --- | --- | --- | --- |
| Chrome | | | |
| Firefox | | | |
| Safari (macOS) | | | |
| Safari (iOS) | | | |

---

## 4. Detailed findings

### 4.1 Format support

| ID | Result | Container detected | Notes |
| --- | --- | --- | --- |
| TC-FMT-001 | | | |
| TC-FMT-002 | | | |
| TC-FMT-003 | | | |
| TC-FMT-004 | | | |
| TC-FMT-005 | | | |
| TC-FMT-006 | | | |
| TC-FMT-007 | | | |

**Format reliability assessment:** `{High / Medium / Low}`

### 4.2 Video codec detection

| ID | Result | Codec detected | FPS | WxH | Notes |
| --- | --- | --- | --- | --- | --- |
| TC-VC-001 | | | | | |
| TC-VC-002 | | | | | |
| TC-VC-003 | | | | | |
| TC-VC-004 | | | | | |
| TC-VC-005 | | | | | |

**Codec detection assessment:** `{High / Medium / Low}`

### 4.3 Audio codec detection

| ID | Result | Audio detected | hasAudio | Preflight warnings | Notes |
| --- | --- | --- | --- | --- | --- |
| TC-AC-001 | | | | | |
| TC-AC-002 | | | | | |
| TC-AC-003 | | | | | |
| TC-AC-004 | | | | | |

**Audio detection assessment:** `{High / Medium / Low}`

### 4.4 Special cases

| ID | Result | Key metadata | Warnings | Notes |
| --- | --- | --- | --- | --- |
| TC-SP-001 | | | | |
| TC-SP-002 | | | | |
| TC-SP-003 | | | | |
| TC-SP-004 | | | | |
| TC-SP-005 | | | | |
| TC-SP-006 | | | | |
| TC-SP-007 | | | | |
| TC-SP-008 | | | | |
| TC-SP-009 | | | | |
| TC-SP-010 | | | | |

**Edge-case handling assessment:** `{High / Medium / Low}`

---

## 5. Metadata field reliability

| Field | Reliable? | Notes |
| --- | --- | --- |
| Container format | | |
| Video codec | | |
| Audio codec | | |
| FPS | | |
| Bitrate | | |
| Width / height | | |
| Duration | | |
| hasAudio / hasVideo | | |
| Stream counts | | |

### Commonly missing or inconsistent fields

- `{field}` — `{observed behavior}`

---

## 6. Performance

| Scenario | First run (cold) | Warm run | Notes |
| --- | --- | --- | --- |
| Import ffprobe-wasm | | | |
| Initialize WASM | | | |
| Analyze 640×360 / 2 s | | | |
| Analyze 4K / 2 s | | | |
| Analyze 10 min / 640×360 | | | |

**Performance assessment:** `{Acceptable / Marginal / Unacceptable for upload UX}`

---

## 7. Preflight validation behavior

| Rule | Triggered correctly? | False positives | False negatives |
| --- | --- | --- | --- |
| AV1 warning | | | |
| No audio | | | |
| No video | | | |
| FPS missing/invalid/low/high | | | |
| Duration missing / exceeds max | | | |
| Dimensions missing | | | |
| Bitrate missing / too high | | | |
| Inconsistent metadata | | | |

---

## 8. Issues and risks

| Severity | Issue | Test case(s) | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Critical | | | | |
| High | | | | |
| Medium | | | | |
| Low | | | | |

---

## 9. Attachments

- CSV results: `{path/to/compatibility-results.csv}`
- Raw JSON export: `{optional}`
- Screenshots / console logs: `{optional}`

---

## 10. Final recommendation

### Strengths

- {e.g. Good H.264/AAC MP4 detection}
- {e.g. Lazy-load keeps main bundle small}
- {e.g. Useful preflight warnings for AV1 and missing audio}

### Weaknesses

- {e.g. Large first-load cost (~3 MiB gzip)}
- {e.g. FPS unreliable on VFR}
- {e.g. FLV/MKV partial support}

### Limitations

- {e.g. Subset of FFmpeg/libav — not full ffprobe}
- {e.g. Requires COOP/COEP — affects embeds and third-party assets}
- {e.g. No standalone WASM caching separate from JS chunk in Vite build}

### Production risks

- {e.g. iOS Safari isolation headers not met in production CDN}
- {e.g. False negatives allow bad uploads}
- {e.g. UI blocked during first WASM download on slow networks}

### Recommendation

**Decision:** `{USE / DO NOT USE / USE WITH FALLBACK}`

**Rationale:**

{Explain decision based on pass rates, browser coverage, and uploader requirements.}

**If USE WITH FALLBACK (recommended baseline):**

1. Run ffprobe-wasm preflight client-side for fast feedback
2. Fall back to server-side ffprobe when:
   - Client analyze throws
   - Required fields missing
   - User agent is unsupported or not cross-origin isolated
3. Never block upload solely on client warnings without server confirmation for critical paths

### Sign-off

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Engineering | | | |
| Product | | | |
