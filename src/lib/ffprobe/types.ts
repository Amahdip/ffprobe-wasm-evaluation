export interface FileInfo {
  format: {
    format_name?: string
    format_long_name?: string
    duration?: string | number
    size?: string | number
    bit_rate?: string | number
    probe_score?: number
    tags?: Record<string, string>
    [key: string]: any
  }
  streams: Array<{
    index?: number
    codec_name?: string
    codec_long_name?: string
    profile?: string
    codec_type?: string
    codec_time_base?: string
    codec_tag_string?: string
    codec_tag?: string
    width?: number
    height?: number
    coded_width?: number
    coded_height?: number
    has_b_frames?: number
    sample_aspect_ratio?: string
    display_aspect_ratio?: string
    pix_fmt?: string
    level?: number
    color_range?: string
    color_space?: string
    color_transfer?: string
    color_primaries?: string
    chroma_location?: string
    field_order?: string
    timecode?: string
    refs?: number
    r_frame_rate?: string
    avg_frame_rate?: string
    time_base?: string
    start_pts?: number
    start_time?: string | number
    duration_ts?: number
    duration?: string | number
    bit_rate?: string | number
    max_bit_rate?: string | number
    bits_per_raw_sample?: string | number
    nb_frames?: string | number
    sample_rate?: string | number
    channels?: number
    channel_layout?: string
    bits_per_sample?: number
    [key: string]: any
  }>
  [key: string]: any
}

export type ResolutionCategory = 'SD' | 'HD' | 'FHD' | 'QHD' | '4K+' | 'unknown'

export type UploadSizeCategory = 'tiny' | 'small' | 'medium' | 'large' | 'very_large'

export type ValidationDecision = 'PASS' | 'WARNING' | 'SOFT FAIL' | 'BLOCKED'

export interface StreamDimensions {
  width: number | null
  height: number | null
  rawWidth: number | null
  rawHeight: number | null
  rawCodecWidth: number | null
  rawCodecHeight: number | null
}

export interface NormalizedMetadata {
  containerFormat: string | null
  durationSeconds: number | null
  formatDurationSeconds: number | null
  videoStreamDurationSeconds: number | null
  audioStreamDurationSeconds: number | null
  videoCodec: string | null
  audioCodec: string | null
  videoProfile: string | null
  videoLevel: number | null
  width: number | null
  height: number | null
  isVertical: boolean
  aspectRatio: number | null
  sampleAspectRatio: string | null
  displayAspectRatio: string | null
  standardAspectRatio: boolean
  fps: number | null
  avgFps: number | null
  rawFps: number | null
  bitrateBps: number | null
  audioBitrateBps: number | null
  audioSampleRate: number | null
  audioChannels: number | null
  hasVideo: boolean
  hasAudio: boolean
  videoStreamCount: number
  audioStreamCount: number
  fileName: string | null
  fileExtension: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  uploadSizeCategory: UploadSizeCategory
  resolutionCategory: ResolutionCategory
  pixelFormat: string | null
  fieldOrder: string | null
  rotation: number | null
  colorRange: string | null
  colorPrimaries: string | null
  colorTransfer: string | null
  colorSpace: string | null
  isHdr: boolean
  is10Bit: boolean
  isInterlaced: boolean
  vfrSuspected: boolean
  extensionContainerMatch: boolean | null
  mimeContainerMatch: boolean | null
  primaryVideoStreamIndex: number | null
  primaryAudioStreamIndex: number | null
  videoStreamDimensions: StreamDimensions
  audioStreamDimensions: StreamDimensions
  missingFields: string[]
  suspiciousFields: string[]
}

export interface DimensionDiagnostics {
  normalizerUsesPrimaryVideoStream: boolean
  primaryVideoStreamIndex: number | null
  normalizedWidth: number | null
  normalizedHeight: number | null
  rawVideoWidth: number | null
  rawVideoHeight: number | null
  rawVideoCodecWidth: number | null
  rawVideoCodecHeight: number | null
  rawAudioWidth: number | null
  rawAudioHeight: number | null
  dimensionSource: 'native' | 'codec_fallback' | 'unavailable'
  conclusion: 'ok' | 'codec_fallback' | 'normalizer_bug' | 'ffprobe_wasm_limitation' | 'no_video_stream'
  explanation: string
}

export interface ValidationIssue {
  code: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

export interface UploaderPolicy {
  maxDurationSeconds: number
  minDurationSeconds: number
  maxBitrateBps: number
  maxFps: number
  minFps: number
  allowedContainers: string[]
  allowedVideoCodecs: string[]
  allowedAudioCodecs: string[]
  warnVideoCodecs: string[]
  warnAudioCodecs: string[]
  maxAudioVideoDurationDeltaSeconds: number
  blockAudioVideoDurationDeltaSeconds?: number
  maxContainerStreamDurationDeltaSeconds: number
  maxFileSizeBytes: number
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
  minAudioBitrateBps: number
  maxAudioBitrateBps: number
  standardAudioSampleRates: number[]
  warnMonoAudio: boolean
  warnSurroundAudio: boolean
  warnVp8Vp9: boolean
  vfrRelativeThreshold: number
  minBitrateBpsPerMegapixel: number
  standardPixelFormats: string[]
  standardAspectRatioTolerance: number
  warnUploadSizeCategories: UploadSizeCategory[]
  blockViolationCodes: string[]
  enableResolutionValidation: boolean
}

export interface ValidationCheckGroup {
  id: string
  label: string
  issues: ValidationIssue[]
}

export interface ValidationDiagnostics {
  dimensions: DimensionDiagnostics
  analyzeError: string | null
  reliableFields: string[]
  unreliableFields: string[]
  fallbackFields: string[]
  metadataSources: Record<string, string>
}

export interface ValidationResult {
  metadata: NormalizedMetadata
  diagnostics: ValidationDiagnostics
  warnings: ValidationIssue[]
  errors: ValidationIssue[]
  checkGroups: ValidationCheckGroup[]
  decision: ValidationDecision
}

export interface FfprobeTimings {
  importMs: number
  initMs: number
  analyzeMs: number
  totalMs: number
}

export interface FileContext {
  fileName?: string
  mimeType?: string
  fileSizeBytes?: number
}

import { preflightPolicy } from '../../config/preflightPolicy'

export const DEFAULT_UPLOADER_POLICY: UploaderPolicy = preflightPolicy

/** @deprecated use DEFAULT_UPLOADER_POLICY */
export const DEFAULT_PREFLIGHT_CONFIG = DEFAULT_UPLOADER_POLICY

export type PreflightConfig = UploaderPolicy
export type PreflightIssue = ValidationIssue
export type PreflightResult = ValidationResult
