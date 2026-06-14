#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/public/fixtures/real-world"
DOWNLOADS="${HOME}/Downloads"

mkdir -p "${OUT_DIR}"

declare -a FILES=(
  "Big_Buck_Bunny_360_10s_1MB.mp4|bbb-360-av1.mp4|AV1 MP4 360p"
  "Big_Buck_Bunny_720_10s_2MB.mp4|bbb-720-av1.mp4|AV1 MP4 720p"
  "Big_Buck_Bunny_1080_10s_5MB.mp4|bbb-1080-av1.mp4|AV1 MP4 1080p"
  "Big_Buck_Bunny_360_10s_1MB (1).mp4|bbb-360-h264.mp4|H.264 MP4 360p"
  "Big_Buck_Bunny_720_10s_2MB (1).mp4|bbb-720-h264.mp4|H.264 MP4 720p"
  "Big_Buck_Bunny_1080_10s_5MB (1).mp4|bbb-1080-h264.mp4|H.264 MP4 1080p"
  "Big_Buck_Bunny_360_10s_1MB.webm|bbb-360-vp9.webm|VP9 WebM 360p"
  "Big_Buck_Bunny_720_10s_2MB.webm|bbb-720-vp9.webm|VP9 WebM 720p"
  "Big_Buck_Bunny_1080_10s_5MB.webm|bbb-1080-vp9.webm|VP9 WebM 1080p"
  "Big_Buck_Bunny_720_10s_2MB.mkv|bbb-720-h264-wrong-ext.mkv|H.264 mislabeled MKV 720p"
  "DELT GROWTH.mp4|delt-growth-vertical.mp4|Vertical H.264 720×1280 real-world"
)

echo "Importing Big Buck Bunny samples from ${DOWNLOADS}"
echo "Destination: ${OUT_DIR}"
echo

for entry in "${FILES[@]}"; do
  IFS='|' read -r source_name dest_name label <<< "${entry}"
  source_path="${DOWNLOADS}/${source_name}"

  if [[ ! -f "${source_path}" ]]; then
    echo "SKIP  ${source_name} (not found)"
    continue
  fi

  cp "${source_path}" "${OUT_DIR}/${dest_name}"
  echo "OK    ${dest_name}  ←  ${source_name}  (${label})"
done

node "${ROOT_DIR}/scripts/compatibility/write-fixture-manifest.mjs"

echo
echo "Imported $(find "${OUT_DIR}" -type f | wc -l | tr -d ' ') files."
