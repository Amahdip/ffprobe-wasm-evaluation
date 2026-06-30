#!/usr/bin/env bash
#
# build.sh — Build minimal ffprobe WASM binary
#
# Usage:
#   cd wasm-build
#   ./build.sh
#
# Prerequisites:
#   - Emscripten SDK (emsdk) activated in PATH
#   - Internet access (to download FFmpeg source)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
FFMPEG_VERSION="7.1"
FFMPEG_DIR="$BUILD_DIR/ffmpeg-${FFMPEG_VERSION}"
FFMPEG_PREFIX="$BUILD_DIR/ffmpeg-wasm-install"
OUTPUT_DIR="$SCRIPT_DIR/../public/engines/minimal-metadata"

# Ensure emsdk is in PATH
if ! command -v emcc &>/dev/null; then
    echo "❌ emcc not found. Activate emsdk first:"
    echo "   source emsdk/emsdk_env.sh"
    exit 1
fi

echo "=== emcc version ==="
emcc --version | head -1

mkdir -p "$BUILD_DIR"

# ── Step 1: Download FFmpeg source ───────────────────────────────
FFMPEG_TARBALL="$BUILD_DIR/ffmpeg-${FFMPEG_VERSION}.tar.xz"
if [ ! -d "$FFMPEG_DIR" ]; then
    if [ ! -f "$FFMPEG_TARBALL" ]; then
        echo "=== Downloading FFmpeg ${FFMPEG_VERSION} ==="
        curl -L -o "$FFMPEG_TARBALL" \
            "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz"
    fi
    echo "=== Extracting FFmpeg ==="
    tar xf "$FFMPEG_TARBALL" -C "$BUILD_DIR"
fi

# ── Step 2: Configure FFmpeg for WASM (minimal) ─────────────────
if [ ! -f "$FFMPEG_PREFIX/lib/libavformat.a" ]; then
    echo "=== Configuring FFmpeg for WASM ==="
    cd "$FFMPEG_DIR"

    # Use emconfigure to wrap ./configure
    emconfigure ./configure \
        --prefix="$FFMPEG_PREFIX" \
        --cc=emcc \
        --cxx=em++ \
        --ar=emar \
        --ranlib=emranlib \
        --enable-cross-compile \
        --target-os=none \
        --arch=x86 \
        --cpu=generic \
        --disable-runtime-cpudetect \
        --disable-x86asm \
        --disable-inline-asm \
        --disable-programs \
        --disable-doc \
        --disable-debug \
        --disable-stripping \
        --disable-network \
        --disable-pthreads \
        --disable-w32threads \
        --disable-os2threads \
        --disable-everything \
        --enable-avformat \
        --enable-avcodec \
        --enable-avutil \
        --enable-protocol=file \
        --enable-demuxer=mov,matroska,webm_dash_manifest,avi,flv,mp3,wav,aac,ogg,concat,mpegts,mpegps,mpegvideo,asf,yuv4mpegpipe,mv,hevc,h264,mjpeg,image2,m4v \
        --enable-parser=h264,hevc,aac,mpegaudio,vp8,vp9,av1,mpeg4video,mjpeg,mpegvideo,vc1 \
        --enable-decoder=h264 \
        --enable-small \
        --disable-autodetect \
        --disable-hwaccels \
        --disable-devices \
        --disable-filters \
        --disable-encoders \
        --enable-muxer=mpegts \
        --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb \
        --extra-cflags="-Oz" \
        --extra-ldflags="-Oz"

    echo "=== Building FFmpeg ==="
    emmake make -j$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
    emmake make install

    cd "$SCRIPT_DIR"
fi

echo "=== FFmpeg WASM libraries built ==="
ls -la "$FFMPEG_PREFIX/lib/"*.a

# ── Step 3: Compile our ffprobe-mini.c ───────────────────────────
echo "=== Building ffprobe-mini.wasm ==="
mkdir -p "$OUTPUT_DIR"

emcc "$SCRIPT_DIR/ffprobe-mini.c" \
    -I"$FFMPEG_PREFIX/include" \
    -L"$FFMPEG_PREFIX/lib" \
    -lavformat -lavcodec -lavutil \
    -lm \
    -lworkerfs.js \
    -o "$OUTPUT_DIR/ffprobe.js" \
    -Oz \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createFFprobe" \
    -s 'EXPORTED_FUNCTIONS=["_get_file_info_json","_walk_video_packets","_segment_video","_free","_malloc"]' \
    -s 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap","FS","WORKERFS","HEAPF64"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s FORCE_FILESYSTEM=1 \
    -s TOTAL_MEMORY=33554432 \
    -s STACK_SIZE=1048576 \
    -s NO_EXIT_RUNTIME=1

echo "=== Gzipping output artifacts ==="
gzip -k -f "$OUTPUT_DIR/ffprobe.js"
gzip -k -f "$OUTPUT_DIR/ffprobe.wasm"

# ── Step 4: Compile single-file base64 version for NPM Package ────
CORE_OUTPUT_DIR="$SCRIPT_DIR/../packages/core/src"
echo "=== Building single-file ffprobe.js for NPM Package ==="
mkdir -p "$CORE_OUTPUT_DIR"

emcc "$SCRIPT_DIR/ffprobe-mini.c" \
    -I"$FFMPEG_PREFIX/include" \
    -L"$FFMPEG_PREFIX/lib" \
    -lavformat -lavcodec -lavutil \
    -lm \
    -lworkerfs.js \
    -o "$CORE_OUTPUT_DIR/ffprobe.js" \
    -Oz \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createFFprobe" \
    -s 'EXPORTED_FUNCTIONS=["_get_file_info_json","_walk_video_packets","_segment_video","_free","_malloc"]' \
    -s 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap","FS","WORKERFS","HEAPF64"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s FORCE_FILESYSTEM=1 \
    -s TOTAL_MEMORY=33554432 \
    -s STACK_SIZE=1048576 \
    -s NO_EXIT_RUNTIME=1 \
    -s SINGLE_FILE=1 \
    -s EXPORT_ES6=1

echo ""
echo "=== Build complete ==="
echo "Output:"
ls -lh "$OUTPUT_DIR/ffprobe.js" "$OUTPUT_DIR/ffprobe.wasm"
ls -lh "$OUTPUT_DIR/ffprobe.js.gz" "$OUTPUT_DIR/ffprobe.wasm.gz"
ls -lh "$CORE_OUTPUT_DIR/ffprobe.js"
echo ""
echo "WASM size (uncompressed): $(wc -c < "$OUTPUT_DIR/ffprobe.wasm" | tr -d ' ') bytes"
echo "WASM size (gzip):         $(wc -c < "$OUTPUT_DIR/ffprobe.wasm.gz" | tr -d ' ') bytes"
echo "Single file size:         $(wc -c < "$CORE_OUTPUT_DIR/ffprobe.js" | tr -d ' ') bytes"
echo "Done! ✅"
