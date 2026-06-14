#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/public/fixtures"
GENERATE_OPTIONAL="${GENERATE_OPTIONAL:-0}"

mkdir -p \
  "${OUT_DIR}/format" \
  "${OUT_DIR}/video-codec" \
  "${OUT_DIR}/audio-codec" \
  "${OUT_DIR}/special"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to generate fixtures." >&2
  exit 1
fi

echo "Generating core compatibility fixtures in ${OUT_DIR}"

make_base_video() {
  local output="$1"
  local fps="$2"
  local width="$3"
  local height="$4"
  local duration="$5"
  local vcodec="$6"
  local acodec="$7"
  local format="$8"

  local -a video_args=()
  local -a audio_args=()

  case "${vcodec}" in
    h264) video_args=(-c:v libx264 -pix_fmt yuv420p) ;;
    hevc) video_args=(-c:v libx265 -tag:v hvc1 -pix_fmt yuv420p) ;;
    av1) video_args=(-c:v libsvtav1 -pix_fmt yuv420p) ;;
    vp8) video_args=(-c:v libvpx) ;;
    vp9) video_args=(-c:v libvpx-vp9 -b:v 1M) ;;
    *) echo "Unsupported video codec: ${vcodec}" >&2; return 1 ;;
  esac

  case "${acodec}" in
    aac) audio_args=(-c:a aac -b:a 128k) ;;
    opus) audio_args=(-c:a libopus -b:a 96k) ;;
    mp3) audio_args=(-c:a libmp3lame -b:a 128k) ;;
    none) audio_args=(-an) ;;
    *) echo "Unsupported audio codec: ${acodec}" >&2; return 1 ;;
  esac

  local -a ffmpeg_inputs=(
    -f lavfi -i "testsrc=duration=${duration}:size=${width}x${height}:rate=${fps}"
  )
  local -a ffmpeg_output=()

  if [[ "${acodec}" != "none" ]]; then
    ffmpeg_inputs+=(-f lavfi -i "sine=frequency=440:duration=${duration}")
    ffmpeg_output=(-shortest)
  fi

  if ((${#ffmpeg_output[@]} > 0)); then
    ffmpeg -y -hide_banner -loglevel error \
      "${ffmpeg_inputs[@]}" \
      "${video_args[@]}" \
      "${audio_args[@]}" \
      "${ffmpeg_output[@]}" \
      -f "${format}" \
      "${output}"
  else
    ffmpeg -y -hide_banner -loglevel error \
      "${ffmpeg_inputs[@]}" \
      "${video_args[@]}" \
      "${audio_args[@]}" \
      -f "${format}" \
      "${output}"
  fi
}

make_vfr() {
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "testsrc=duration=3:size=640x360:rate=30" \
    -f lavfi -i "sine=frequency=440:duration=3" \
    -c:v libx264 -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -vsync vfr -shortest \
    "${OUT_DIR}/special/vfr-h264-aac.mp4"
}

make_av_mismatch() {
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "testsrc=duration=4:size=640x360:rate=30" \
    -f lavfi -i "sine=frequency=440:duration=2" \
    -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k \
    -t 4 \
    "${OUT_DIR}/special/av-duration-mismatch.mp4"
}

make_audio_only() {
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "sine=frequency=440:duration=3" \
    -c:a aac -b:a 128k \
    "${OUT_DIR}/special/audio-only-aac.m4a"
}

make_multiple_audio() {
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "testsrc=duration=2:size=640x360:rate=30" \
    -f lavfi -i "sine=frequency=440:duration=2" \
    -f lavfi -i "sine=frequency=660:duration=2" \
    -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 96k \
    -map 0:v:0 -map 1:a:0 -map 2:a:0 \
    -shortest \
    "${OUT_DIR}/special/multiple-audio-tracks.mp4"
}

make_corrupted() {
  make_base_video "${OUT_DIR}/special/.tmp-valid.mp4" 30 640 360 2 h264 aac mp4
  head -c 4096 "${OUT_DIR}/special/.tmp-valid.mp4" > "${OUT_DIR}/special/corrupted-truncated.mp4"
  rm -f "${OUT_DIR}/special/.tmp-valid.mp4"
}

make_wrong_extension() {
  make_base_video "${OUT_DIR}/special/.tmp-valid.mp4" 30 640 360 2 h264 aac mp4
  cp "${OUT_DIR}/special/.tmp-valid.mp4" "${OUT_DIR}/special/h264-aac-wrong-ext.mp3"
  rm -f "${OUT_DIR}/special/.tmp-valid.mp4"
}

make_optional_heavy() {
  echo "Generating optional heavy fixtures (4K, 10-minute)…"
  make_base_video "${OUT_DIR}/special/h264-aac-4k-30fps.mp4" 30 3840 2160 2 h264 aac mp4
  make_base_video "${OUT_DIR}/special/h264-aac-long-30fps.mp4" 30 640 360 600 h264 aac mp4
}

# Formats
make_base_video "${OUT_DIR}/format/mp4-h264-aac-30fps.mp4" 30 640 360 2 h264 aac mp4
make_base_video "${OUT_DIR}/format/mov-h264-aac-30fps.mov" 30 640 360 2 h264 aac mov
make_base_video "${OUT_DIR}/format/webm-vp9-opus-30fps.webm" 30 640 360 2 vp9 opus webm
make_base_video "${OUT_DIR}/format/mkv-h264-aac-30fps.mkv" 30 640 360 2 h264 aac matroska
make_base_video "${OUT_DIR}/format/avi-h264-aac-30fps.avi" 30 640 360 2 h264 aac avi
make_base_video "${OUT_DIR}/format/flv-h264-aac-30fps.flv" 30 640 360 2 h264 aac flv
make_base_video "${OUT_DIR}/format/m4v-h264-aac-30fps.m4v" 30 640 360 2 h264 aac mp4

# Video codecs
cp "${OUT_DIR}/format/mp4-h264-aac-30fps.mp4" "${OUT_DIR}/video-codec/h264-aac-30fps.mp4"
make_base_video "${OUT_DIR}/video-codec/hevc-aac-30fps.mp4" 30 640 360 2 hevc aac mp4
make_base_video "${OUT_DIR}/video-codec/av1-aac-30fps.mp4" 30 640 360 2 av1 aac mp4
make_base_video "${OUT_DIR}/video-codec/vp8-opus-30fps.webm" 30 640 360 2 vp8 opus webm
make_base_video "${OUT_DIR}/video-codec/vp9-opus-30fps.webm" 30 640 360 2 vp9 opus webm

# Audio codecs
cp "${OUT_DIR}/format/mp4-h264-aac-30fps.mp4" "${OUT_DIR}/audio-codec/h264-aac-30fps.mp4"
cp "${OUT_DIR}/format/webm-vp9-opus-30fps.webm" "${OUT_DIR}/audio-codec/vp9-opus-30fps.webm"
make_base_video "${OUT_DIR}/audio-codec/h264-mp3-30fps.mp4" 30 640 360 2 h264 mp3 mp4
make_base_video "${OUT_DIR}/audio-codec/h264-no-audio-30fps.mp4" 30 640 360 2 h264 none mp4

# Special cases (core — short synthetic clips)
make_vfr
make_base_video "${OUT_DIR}/special/h264-aac-24fps.mp4" 24 640 360 2 h264 aac mp4
make_base_video "${OUT_DIR}/special/h264-aac-30fps.mp4" 30 640 360 2 h264 aac mp4
make_base_video "${OUT_DIR}/special/h264-aac-60fps.mp4" 60 640 360 2 h264 aac mp4
make_base_video "${OUT_DIR}/special/h264-aac-120fps.mp4" 120 640 360 2 h264 aac mp4
make_corrupted
make_wrong_extension
make_av_mismatch
make_audio_only
cp "${OUT_DIR}/audio-codec/h264-no-audio-30fps.mp4" "${OUT_DIR}/special/video-only-h264.mp4"
make_multiple_audio

if [[ "${GENERATE_OPTIONAL}" == "1" ]]; then
  make_optional_heavy
else
  echo "Skipping optional heavy fixtures (4K, 10-minute). Set GENERATE_OPTIONAL=1 to include."
fi

node "${ROOT_DIR}/scripts/compatibility/write-fixture-manifest.mjs"
cp "${ROOT_DIR}/compatibility/test-matrix.json" "${ROOT_DIR}/public/compatibility/test-matrix.json"

echo "Done. Generated $(find "${OUT_DIR}" -type f ! -name manifest.json | wc -l | tr -d ' ') fixture files."
