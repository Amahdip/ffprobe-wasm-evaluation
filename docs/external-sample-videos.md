# External sample videos for ffprobe-wasm testing

Verified download sources and expected codec/container metadata. Links were checked with HTTP HEAD requests on 2026-06-14.

Primary catalog: [test-videos.co.uk](https://test-videos.co.uk/) (Big Buck Bunny, Sintel, Jellyfish — royalty-free Blender Foundation content).

---

## AV1 samples (MP4)

| Label | Direct download | Container | Video | Audio | Resolution | Duration | Size (approx) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BBB 720p 2MB | https://test-videos.co.uk/vids/bigbuckbunny/mp4/av1/720/Big_Buck_Bunny_720_10s_2MB.mp4 | MP4 (`mov,mp4`) | **av1** | none | 1280×720 | 10 s | 2.0 MB |
| BBB 1080p 5MB | https://test-videos.co.uk/vids/bigbuckbunny/mp4/av1/1080/Big_Buck_Bunny_1080_10s_5MB.mp4 | MP4 | **av1** | none | 1920×1080 | 10 s | 5.0 MB |
| BBB 360p 1MB | https://test-videos.co.uk/vids/bigbuckbunny/mp4/av1/360/Big_Buck_Bunny_360_10s_1MB.mp4 | MP4 | **av1** | none | 640×360 | 10 s | 1.0 MB |
| Sintel 720p 2MB | https://test-videos.co.uk/vids/sintel/mp4/av1/720/Sintel_720_10s_2MB.mp4 | MP4 | **av1** | none | 1280×720 | 10 s | 2.0 MB |
| Bipbop AV1 (AOM) | https://raw.githubusercontent.com/SPBTV/video_av1_samples/master/spbtv_sample_bipbop_av1_960x540_25fps.mp4 | MP4 | **av1** | AAC | 960×540 | ~30 s | 240 KB |
| Chromium bear-av1 | https://raw.githubusercontent.com/chromium/chromium/master/media/test/data/bear-av1.mp4 | MP4 (fragmented) | **av1** | none | 320×240 | short | 24 KB |

**Index pages (all sizes):**

- https://test-videos.co.uk/bigbuckbunny/mp4-av1
- https://test-videos.co.uk/sintel/mp4-av1

**URL pattern:** `https://test-videos.co.uk/vids/{title}/mp4/av1/{height}/{Filename}.mp4`

**Preflight note:** AV1 should trigger `codec_av1` warning in our suite. Most BBB AV1 clips are **video-only** (no audio stream).

---

## VP9 samples (WebM)

| Label | Direct download | Container | Video | Audio | Resolution | Duration | Size (approx) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BBB 720p 2MB | https://test-videos.co.uk/vids/bigbuckbunny/webm/vp9/720/Big_Buck_Bunny_720_10s_2MB.webm | WebM (`matroska,webm`) | **vp9** | none | 1280×720 | 10 s | 2.0 MB |
| BBB 1080p 5MB | https://test-videos.co.uk/vids/bigbuckbunny/webm/vp9/1080/Big_Buck_Bunny_1080_10s_5MB.webm | WebM | **vp9** | none | 1920×1080 | 10 s | 5.0 MB |
| BBB 360p 1MB | https://test-videos.co.uk/vids/bigbuckbunny/webm/vp9/360/Big_Buck_Bunny_360_10s_1MB.webm | WebM | **vp9** | none | 640×360 | 10 s | 1.0 MB |
| Chromium bear-vp9 | https://raw.githubusercontent.com/chromium/chromium/master/media/test/data/bear-vp9-bt709.webm | WebM | **vp9** | none | 320×240 | short | 165 KB |
| Tears of Steel 1080p | https://media.xiph.org/mango/tears_of_steel_1080p.webm | WebM | **vp9** | **opus** | 1920×1080 | ~12 min | 545 MB |

**Index pages:**

- https://test-videos.co.uk/bigbuckbunny/webm-vp9
- https://test-videos.co.uk/bigbuckbunny/webm-vp8
- https://test-videos.co.uk/bigbuckbunny/webm-av1

**URL pattern:** `https://test-videos.co.uk/vids/{title}/webm/vp9/{height}/{Filename}.webm`

**Preflight note:** BBB VP9 WebM clips are **video-only**. Use Tears of Steel or generate fixtures locally for VP9+Opus with audio.

---

## HEVC / H.265 samples (MP4)

| Label | Direct download | Container | Video | Audio | Resolution | Duration | Size (approx) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BBB 720p 2MB | https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/720/Big_Buck_Bunny_720_10s_2MB.mp4 | MP4 | **hevc** | none | 1280×720 | 10 s | 2.0 MB |
| BBB 1080p 5MB | https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/1080/Big_Buck_Bunny_1080_10s_5MB.mp4 | MP4 | **hevc** | none | 1920×1080 | 10 s | 5.0 MB |
| BBB 360p 1MB | https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/360/Big_Buck_Bunny_360_10s_1MB.mp4 | MP4 | **hevc** | none | 640×360 | 10 s | 1.0 MB |
| Jellyfish 720p 2MB | https://test-videos.co.uk/vids/jellyfish/mp4/h265/720/Jellyfish_720_10s_2MB.mp4 | MP4 | **hevc** | none | 1280×720 | 10 s | 2.0 MB |

**Index pages:**

- https://test-videos.co.uk/bigbuckbunny/mp4-h265
- https://test-videos.co.uk/jellyfish/mp4-h265

**URL pattern:** `https://test-videos.co.uk/vids/{title}/mp4/h265/{height}/{Filename}.mp4`

**Preflight note:** HEVC detection is the goal; browser **playback** support is separate from ffprobe-wasm metadata extraction.

---

## Related baseline samples (same site)

| Codec | Index | Example direct link |
| --- | --- | --- |
| H.264 MP4 | https://test-videos.co.uk/bigbuckbunny/mp4-h264 | https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4 |
| VP8 WebM | https://test-videos.co.uk/bigbuckbunny/webm-vp8 | https://test-videos.co.uk/vids/bigbuckbunny/webm/vp8/720/Big_Buck_Bunny_720_10s_2MB.webm |
| MKV H.264 | https://test-videos.co.uk/bigbuckbunny/mkv | https://test-videos.co.uk/vids/bigbuckbunny/mkv/720/Big_Buck_Bunny_720_10s_2MB.mkv |

---

## Your Downloads folder (already useful)

Probed with system `ffprobe` on 2026-06-14. **Do not assume codec from file extension alone** — your set mixes codecs under similar names.

| File | Actual video codec | Container (ffprobe) | Audio | Resolution | Duration |
| --- | --- | --- | --- | --- | --- |
| `Big_Buck_Bunny_*_*.mp4` (no `(1)`) | **av1** | MP4 | none | 360p / 720p / 1080p | 10 s |
| `Big_Buck_Bunny_*_*.mp4` with `(1)` | **h264** | MP4 | none | 360p / 720p / 1080p | 10 s |
| `Big_Buck_Bunny_*_*.webm` | **vp9** | WebM | none | 360p / 720p / 1080p | 10 s |
| `Big_Buck_Bunny_*_*.mkv` | **h264** | MP4-like (`mov,mp4`)* | none | 360p / 720p / 1080p | 10 s |

\*Your `.mkv` files probe as MP4 container internally — treat as **wrong-extension / mislabeled container** test cases.

### Recommended mapping to compatibility suite

| Your file | Suite use |
| --- | --- |
| `Big_Buck_Bunny_720_10s_2MB.mp4` | Real-world **AV1** (TC-VC-003 supplement) |
| `Big_Buck_Bunny_720_10s_2MB (1).mp4` | Real-world **H.264** baseline |
| `Big_Buck_Bunny_720_10s_2MB.webm` | Real-world **VP9** |
| `Big_Buck_Bunny_1080_10s_5MB.mkv` | **Wrong extension** / container mismatch (TC-SP-009 supplement) |
| All `(1).mp4` vs non-`(1).mp4` | Side-by-side codec comparison at same resolution |

### Import into test suite

```bash
npm run samples:import-downloads
```

Copies non-duplicate files into `public/fixtures/real-world/` for the browser compatibility runner.

---

## Quick download commands

```bash
# AV1
curl -L -o av1-720.mp4 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/av1/720/Big_Buck_Bunny_720_10s_2MB.mp4'

# VP9 WebM
curl -L -o vp9-720.webm 'https://test-videos.co.uk/vids/bigbuckbunny/webm/vp9/720/Big_Buck_Bunny_720_10s_2MB.webm'

# HEVC
curl -L -o hevc-720.mp4 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h265/720/Big_Buck_Bunny_720_10s_2MB.mp4'

# Small Chromium fixtures (fast CI)
curl -L -o bear-av1.mp4 'https://raw.githubusercontent.com/chromium/chromium/master/media/test/data/bear-av1.mp4'
curl -L -o bear-vp9.webm 'https://raw.githubusercontent.com/chromium/chromium/master/media/test/data/bear-vp9-bt709.webm'
```

---

## Licensing

- **test-videos.co.uk** — Big Buck Bunny / Sintel / Jellyfish (Blender Foundation, Creative Commons)
- **Chromium test data** — BSD-style (Chromium project)
- **SPBTV AV1 samples** — see [SPBTV/video_av1_samples](https://github.com/SPBTV/video_av1_samples)
- **Tears of Steel** — [mango.xiph.org](https://media.xiph.org/mango/) (CC BY)
