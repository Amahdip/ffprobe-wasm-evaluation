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
    unlink?: (path: string) => void
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
  ccall: (name: string, returnType: string, argTypes: string[], args: unknown[]) => string
}

export type CreateMinimalFfprobe = (moduleArg?: {
  locateFile?: (path: string, prefix?: string) => string
}) => Promise<MinimalWasmModule>
