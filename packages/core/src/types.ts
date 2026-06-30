export interface MinimalStreamTag {
  [key: string]: string
}

export interface MinimalStream {
  index: number
  id: number
  codec_type: string
  codec_name: string | null
  codec_id: number
  codec_tag_string: string | null
  profile: string | null
  level: number
  width?: number
  height?: number
  codec_width?: number
  codec_height?: number
  sample_aspect_ratio?: string | null
  display_aspect_ratio?: string | null
  pix_fmt?: string | null
  avg_frame_rate?: string
  r_frame_rate?: string
  fps?: number | null
  rotation?: number | null
  color_range?: string | null
  color_primaries?: string | null
  color_transfer?: string | null
  color_space?: string | null
  is_hdr?: boolean
  channels?: number
  sample_rate?: number
  sample_fmt?: string | null
  bit_rate?: number
  duration?: number | null
  tags?: MinimalStreamTag
}

export interface MinimalProbeResult {
  ok: boolean
  error?: string | null
  error_detail?: string | null
  stream_info_ok?: boolean
  format_name?: string | null
  format_long_name?: string | null
  duration?: number | null
  bit_rate?: number | null
  nb_streams?: number
  has_video?: boolean
  has_audio?: boolean
  video_stream_count?: number
  audio_stream_count?: number
  streams?: MinimalStream[]
  tags?: MinimalStreamTag
}

/** Emscripten WORKERFS mount options (subset we use). */
export interface WorkerFsMountOptions {
  blobs?: Array<{ name: string; data: Blob }>
  files?: File[]
}

export interface MinimalWasmModule {
  FS: {
    writeFile?: (path: string, data: Uint8Array) => void
    unlink: (path: string) => void
    readFile: (path: string, opts?: { encoding?: 'binary' }) => Uint8Array
    mkdir: (path: string) => void
    rmdir: (path: string) => void
    mount: (type: unknown, opts: WorkerFsMountOptions, mountpoint: string) => void
    unmount: (mountpoint: string) => void
  }
  /** WORKERFS filesystem backend (present when built with -lworkerfs.js). */
  WORKERFS: unknown
  FS_createDataFile?: (
    parent: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn: boolean,
  ) => void
  FS_unlink?: (path: string) => void
  // Generic so callers pick the return type: ccall<string> for the JSON probe,
  // ccall<number> for walk_video_packets (returns a heap pointer).
  ccall: <T = string>(name: string, returnType: string, argTypes: string[], args: unknown[]) => T
  /** Float64 view of the wasm heap — re-read after each call (memory can grow). */
  HEAPF64: Float64Array
  /** Frees a malloc'd pointer returned across the wasm boundary. */
  _free?: (ptr: number) => void
}

/**
 * Client-supplied analysis hint for akuma's encoder (mirrors domains.VideoAnalyze).
 * When akuma receives this with a window AND keyframe list, it skips its
 * whole-file CheckGOP frame walk.
 */
export interface VideoAnalyzeHint {
  start: number
  end: number
  /** Keyframe (IDR) presentation timestamps in seconds — the GOP boundaries. */
  gop_timestamp: number[]
}

export type MaxrateWindowSource = 'sliding-peak' | 'midpoint-cbr' | 'whole-video'

/** Result of analyzeMaxrate: the akuma hint plus diagnostics for display/logging. */
export interface MaxrateAnalysis {
  /** The field to send to akuma (JSON key "videoanalyze"). */
  videoanalyze: VideoAnalyzeHint
  durationSec: number
  packetCount: number
  keyframeCount: number
  isSourceCBR: boolean
  /** Coefficient of variation of tumbling-segment sizes (the CBR metric). */
  cv: number
  windowSource: MaxrateWindowSource
  /** Source-derived bitrate of the chosen window (kbps), before headroom. */
  peakBitrateKbps: number
  /** peakBitrateKbps * headroomFactor — a preview ceiling, not the shipped value. */
  maxrateKbps: number
  /** Wall-clock timings for the benchmark/preflight UI. */
  timings: { importMs: number; walkMs: number; mathMs: number; totalMs: number }
}

export interface MaxrateOptions {
  /** Peak-window length in seconds (default 60). */
  windowSeconds?: number
  /** Safety multiplier applied to the window bitrate (default 1.3). */
  headroomFactor?: number
  /** CBR detection threshold on the coefficient of variation (default 0.05). */
  cbrThreshold?: number
}

/** One keyframe-aligned MPEG-TS chunk produced by segmentVideo(). */
export interface VideoSegment {
  index: number
  /** Start time in the source (seconds). */
  startSec: number
  /** Segment duration (seconds). */
  durationSec: number
  /** The .ts segment bytes (stream-copied H.264/HEVC, Annex-B). */
  data: Uint8Array
}

export interface SegmentResult {
  segments: VideoSegment[]
  count: number
  timings: { importMs: number; segmentMs: number; totalMs: number }
}

export type CreateMinimalFfprobe = (moduleArg?: {
  locateFile?: (path: string, prefix?: string) => string
}) => Promise<MinimalWasmModule>
