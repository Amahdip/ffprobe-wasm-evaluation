import type { FileInfo } from 'ffprobe-wasm'
import type { DimensionDiagnostics, NormalizedMetadata, UploaderPolicy } from '../lib/ffprobe/types'
import {
  containerAllowed,
  is10BitPixelFormat,
  isHdrVideo,
  isInterlacedFieldOrder,
  normalizeCodec,
  parseStreamNumber,
  uploadSizeDisplayLabel,
  getAspectRatioLabel,
} from '../lib/ffprobe/validation/helpers'

export interface RuleContext {
  fileInfo: FileInfo
  metadata: NormalizedMetadata
  policy: UploaderPolicy
  dimensionDiagnostics: DimensionDiagnostics
  analyzeError: string | null
}

export interface ValidationRule {
  id: string
  group: 'container' | 'audio' | 'video' | 'resolution' | 'fps' | 'duration' | 'bitrate'
  severity: 'info' | 'warning' | 'error'
  /** Returns an error/warning message if the rule is violated, otherwise null */
  condition: (ctx: RuleContext) => string | null | undefined
}

export const validationRules: ValidationRule[] = [
  // Container Rules
  {
    id: 'analyze_failed',
    group: 'container',
    severity: 'error',
    condition: (ctx) => ctx.analyzeError ? `ffprobe-wasm could not analyze this file: ${ctx.analyzeError}. Treat as best-effort only; do not block upload solely for this.` : null
  },
  {
    id: 'file_corrupted_or_unreadable',
    group: 'container',
    severity: 'error',
    condition: (ctx) => ctx.analyzeError ? 'File appears corrupted or unreadable by client-side ffprobe-wasm.' : null
  },
  {
    id: 'unsupported_container',
    group: 'container',
    severity: 'warning',
    condition: (ctx) => {
      if (ctx.analyzeError) return null
      return ctx.metadata.containerFormat && !containerAllowed(ctx.metadata.containerFormat, ctx.policy.allowedContainers)
        ? `Container "${ctx.metadata.containerFormat}" is outside allowed list (${ctx.policy.allowedContainers.join(', ')}).` : null
    }
  },
  {
    id: 'extension_container_mismatch',
    group: 'container',
    severity: 'warning',
    condition: (ctx) => {
      if (ctx.analyzeError) return null
      return ctx.metadata.extensionContainerMatch === false
        ? `File extension ".${ctx.metadata.fileExtension}" does not match detected container "${ctx.metadata.containerFormat}".` : null
    }
  },
  {
    id: 'wrong_extension_valid_video',
    group: 'container',
    severity: 'info',
    condition: (ctx) => {
      if (ctx.analyzeError) return null
      return ctx.metadata.extensionContainerMatch === false && (ctx.metadata.hasVideo || ctx.metadata.hasAudio)
        ? 'Extension mismatch, but valid video/audio streams were detected.' : null
    }
  },
  {
    id: 'mime_container_mismatch',
    group: 'container',
    severity: 'warning',
    condition: (ctx) => {
      if (ctx.analyzeError) return null
      return ctx.metadata.mimeContainerMatch === false
        ? `Browser MIME type "${ctx.metadata.mimeType}" does not match detected container "${ctx.metadata.containerFormat}".` : null
    }
  },
  {
    id: 'media_encrypted_or_protected',
    group: 'container',
    severity: 'error',
    condition: (ctx) => {
      if (ctx.analyzeError) return null
      const formatTags = ctx.fileInfo.format?.tags ?? {}
      const encryptionHint = formatTags.encryption ?? formatTags.ENCRYPTION ?? formatTags.protected ?? formatTags.PROTECTED
      return encryptionHint ? 'Encrypted or protected media metadata detected.' : null
    }
  },
  {
    id: 'fragmented_mp4',
    group: 'container',
    severity: 'warning',
    condition: (ctx) => {
      if (ctx.analyzeError) return null
      const formatTags = ctx.fileInfo.format?.tags ?? {}
      const fragmentedHint = formatTags.major_brand === 'iso5' || formatTags.compatible_brands?.includes('iso5') || formatTags.movflags?.includes('frag')
      return (fragmentedHint && ctx.metadata.containerFormat?.includes('mp4'))
        ? 'Fragmented MP4 or non-faststart layout may be present (moov atom placement not fully verified client-side).' : null
    }
  },
  {
    id: 'low_probe_score',
    group: 'container',
    severity: 'warning',
    condition: (ctx) => {
      if (ctx.analyzeError) return null
      const probeScore = Number.parseFloat(String(ctx.fileInfo.format?.probe_score ?? ''))
      return (Number.isFinite(probeScore) && probeScore < 50)
        ? `Low container probe score (${probeScore}). File structure may be unusual or partially readable.` : null
    }
  },

  // Audio Rules
  {
    id: 'no_audio_stream',
    group: 'audio',
    severity: 'error',
    condition: (ctx) => !ctx.metadata.hasAudio ? 'No audio stream detected.' : null
  },
  {
    id: 'multiple_audio_tracks',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => ctx.metadata.hasAudio && ctx.metadata.audioStreamCount > 1
      ? `Multiple audio tracks detected (${ctx.metadata.audioStreamCount}).` : null
  },
  {
    id: 'audio_codec_unsupported',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasAudio) return null
      const audioCodec = normalizeCodec(ctx.metadata.audioCodec)
      return !ctx.policy.allowedAudioCodecs.some((codec) => audioCodec.includes(codec))
        ? `Audio codec "${ctx.metadata.audioCodec}" is outside the allowed list (${ctx.policy.allowedAudioCodecs.join(', ')}).` : null
    }
  },
  {
    id: 'audio_codec_review',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasAudio) return null
      const audioCodec = normalizeCodec(ctx.metadata.audioCodec)
      return ctx.policy.warnAudioCodecs.some((codec) => audioCodec.includes(codec))
        ? `Audio codec "${ctx.metadata.audioCodec}" is flagged for extra review.` : null
    }
  },
  {
    id: 'audio_bitrate_too_low',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasAudio) return null
      const primaryAudio = ctx.fileInfo.streams.find((s) => s.index === ctx.metadata.primaryAudioStreamIndex)
      const audioBitrate = ctx.metadata.audioBitrateBps ?? parseStreamNumber(primaryAudio?.bit_rate)
      return (audioBitrate !== null && audioBitrate < ctx.policy.minAudioBitrateBps)
        ? `Audio bitrate (${Math.round(audioBitrate / 1000)} kbps) is below minimum (${Math.round(ctx.policy.minAudioBitrateBps / 1000)} kbps).` : null
    }
  },
  {
    id: 'audio_bitrate_too_high',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasAudio) return null
      const primaryAudio = ctx.fileInfo.streams.find((s) => s.index === ctx.metadata.primaryAudioStreamIndex)
      const audioBitrate = ctx.metadata.audioBitrateBps ?? parseStreamNumber(primaryAudio?.bit_rate)
      return (audioBitrate !== null && audioBitrate > ctx.policy.maxAudioBitrateBps)
        ? `Audio bitrate (${Math.round(audioBitrate / 1000)} kbps) exceeds maximum (${Math.round(ctx.policy.maxAudioBitrateBps / 1000)} kbps).` : null
    }
  },
  {
    id: 'audio_sample_rate_unusual',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasAudio) return null
      const sampleRate = ctx.metadata.audioSampleRate
      return (sampleRate !== null && !ctx.policy.standardAudioSampleRates.includes(sampleRate))
        ? `Audio sample rate ${sampleRate} Hz is unusual (expected ${ctx.policy.standardAudioSampleRates.join(' or ')} Hz).` : null
    }
  },
  {
    id: 'audio_channels_zero',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => ctx.metadata.hasAudio && ctx.metadata.audioChannels === 0 ? 'Audio channel count is 0.' : null
  },
  {
    id: 'audio_channels_mono',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => ctx.metadata.hasAudio && ctx.metadata.audioChannels === 1 && ctx.policy.warnMonoAudio ? 'Mono audio detected (1 channel).' : null
  },
  {
    id: 'audio_channels_surround',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => ctx.metadata.hasAudio && ctx.metadata.audioChannels !== null && ctx.metadata.audioChannels >= 6 && ctx.policy.warnSurroundAudio
      ? `Unusual multichannel audio detected (${ctx.metadata.audioChannels} channels).` : null
  },
  {
    id: 'av_duration_mismatch',
    group: 'audio',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || !ctx.metadata.hasAudio) return null
      return (ctx.metadata.videoStreamDurationSeconds !== null && ctx.metadata.audioStreamDurationSeconds !== null &&
        Math.abs(ctx.metadata.videoStreamDurationSeconds - ctx.metadata.audioStreamDurationSeconds) > ctx.policy.maxAudioVideoDurationDeltaSeconds)
        ? `Primary video duration (${ctx.metadata.videoStreamDurationSeconds.toFixed(3)}s) differs from primary audio duration (${ctx.metadata.audioStreamDurationSeconds.toFixed(3)}s) by more than ${ctx.policy.maxAudioVideoDurationDeltaSeconds}s.` : null
    }
  },

  // Video Rules
  {
    id: 'no_video_stream',
    group: 'video',
    severity: 'error',
    condition: (ctx) => !ctx.metadata.hasVideo ? 'No video stream detected.' : null
  },
  {
    id: 'multiple_video_streams',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => ctx.metadata.hasVideo && ctx.metadata.videoStreamCount > 1
      ? `Multiple video streams detected (${ctx.metadata.videoStreamCount}).` : null
  },
  {
    id: 'video_codec_unsupported',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      const videoCodec = normalizeCodec(ctx.metadata.videoCodec)
      return !ctx.policy.allowedVideoCodecs.some((codec) => videoCodec.includes(codec))
        ? `Video codec "${ctx.metadata.videoCodec}" is outside the allowed list (${ctx.policy.allowedVideoCodecs.join(', ')}).` : null
    }
  },
  {
    id: 'codec_av1',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      const videoCodec = normalizeCodec(ctx.metadata.videoCodec)
      return videoCodec.includes('av1') ? 'AV1 detected. Downstream compatibility may vary.' : null
    }
  },
  {
    id: 'codec_hevc',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      const videoCodec = normalizeCodec(ctx.metadata.videoCodec)
      return (videoCodec.includes('hevc') || videoCodec.includes('h265')) ? 'HEVC/H.265 detected. Playback/transcode support varies.' : null
    }
  },
  {
    id: 'codec_vp8_vp9',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      const videoCodec = normalizeCodec(ctx.metadata.videoCodec)
      return (ctx.policy.warnVp8Vp9 && (videoCodec.includes('vp8') || videoCodec.includes('vp9')))
        ? `${ctx.metadata.videoCodec?.toUpperCase()} detected. Policy prefers other codecs for upload.` : null
    }
  },
  {
    id: 'video_codec_review',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      const videoCodec = normalizeCodec(ctx.metadata.videoCodec)
      return ctx.policy.warnVideoCodecs.some((codec) => videoCodec.includes(codec))
        ? `Video codec "${ctx.metadata.videoCodec}" is flagged for extra review.` : null
    }
  },
  {
    id: 'pixel_format_unusual',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      const pixelFormat = ctx.metadata.pixelFormat?.toLowerCase() ?? ''
      return (pixelFormat && !ctx.policy.standardPixelFormats.some((fmt) => pixelFormat === fmt.toLowerCase()))
        ? `Pixel format "${ctx.metadata.pixelFormat}" is not a standard upload format (expected ${ctx.policy.standardPixelFormats.join(', ')}).` : null
    }
  },
  {
    id: 'video_10bit',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      return is10BitPixelFormat(ctx.metadata.pixelFormat)
        ? `10-bit video detected (pixel format: ${ctx.metadata.pixelFormat}). Transcode compatibility may vary.` : null
    }
  },
  {
    id: 'video_hdr_metadata',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      return isHdrVideo(ctx.metadata.colorPrimaries, ctx.metadata.colorTransfer)
        ? `HDR metadata detected (primaries: ${ctx.metadata.colorPrimaries ?? 'n/a'}, transfer: ${ctx.metadata.colorTransfer ?? 'n/a'}).` : null
    }
  },
  {
    id: 'video_interlaced',
    group: 'video',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      const primaryVideo = ctx.fileInfo.streams.find((stream) => stream.index === ctx.metadata.primaryVideoStreamIndex) as any
      const fieldOrder = ctx.metadata.fieldOrder ?? primaryVideo?.field_order ?? primaryVideo?.tags?.field_order ?? null
      return isInterlacedFieldOrder(fieldOrder) ? `Interlaced video detected (field_order: ${fieldOrder}).` : null
    }
  },

  // Resolution Rules
  {
    id: 'dimensions_unreliable',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      return (ctx.metadata.width === null || ctx.metadata.height === null) && ctx.dimensionDiagnostics.conclusion === 'ffprobe_wasm_limitation'
        ? 'Width/height are unavailable from ffprobe-wasm. Keep backend/Akuma resolution validation authoritative.' : null
    }
  },
  {
    id: 'dimensions_missing',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      return (ctx.metadata.width === null || ctx.metadata.height === null) && ctx.dimensionDiagnostics.conclusion !== 'ffprobe_wasm_limitation'
        ? 'Width/height could not be determined.' : null
    }
  },
  {
    id: 'dimensions_codec_fallback',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.width === null || ctx.metadata.height === null) return null
      return ctx.dimensionDiagnostics.conclusion === 'codec_fallback'
        ? 'Native width/height were unavailable. Resolution was recovered from codec_width/codec_height.' : null
    }
  },
  {
    id: 'resolution_too_small',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.width === null || ctx.metadata.height === null) return null
      return (ctx.metadata.width < ctx.policy.minWidth || ctx.metadata.height < ctx.policy.minHeight)
        ? `Resolution ${ctx.metadata.width}×${ctx.metadata.height} is below minimum ${ctx.policy.minWidth}×${ctx.policy.minHeight}.` : null
    }
  },
  {
    id: 'resolution_too_large',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.width === null || ctx.metadata.height === null) return null
      return (ctx.metadata.width > ctx.policy.maxWidth || ctx.metadata.height > ctx.policy.maxHeight)
        ? `Resolution ${ctx.metadata.width}×${ctx.metadata.height} exceeds maximum ${ctx.policy.maxWidth}×${ctx.policy.maxHeight}.` : null
    }
  },
  {
    id: 'vertical_video',
    group: 'resolution',
    severity: 'info',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.width === null || ctx.metadata.height === null) return null
      return ctx.metadata.isVertical ? `Vertical video detected (${ctx.metadata.width}×${ctx.metadata.height}).` : null
    }
  },
  {
    id: 'aspect_ratio_non_standard',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.width === null || ctx.metadata.height === null) return null
      const aspectLabel = getAspectRatioLabel(ctx.metadata.width, ctx.metadata.height, ctx.policy.standardAspectRatioTolerance)
      return !aspectLabel ? `Non-standard aspect ratio detected (${(ctx.metadata.width / ctx.metadata.height).toFixed(3)}:1).` : null
    }
  },
  {
    id: 'dimensions_not_divisible_by_2',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.width === null || ctx.metadata.height === null) return null
      return (ctx.metadata.width % 2 !== 0 || ctx.metadata.height % 2 !== 0)
        ? `Dimensions ${ctx.metadata.width}×${ctx.metadata.height} are not divisible by 2 (encoding compatibility risk).` : null
    }
  },
  {
    id: 'dimensions_not_divisible_by_16',
    group: 'resolution',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.width === null || ctx.metadata.height === null) return null
      return (ctx.metadata.width % 16 !== 0 || ctx.metadata.height % 16 !== 0)
        ? `Dimensions ${ctx.metadata.width}×${ctx.metadata.height} are not divisible by 16 (may affect encoder efficiency).` : null
    }
  },

  // FPS Rules
  {
    id: 'fps_missing',
    group: 'fps',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      return ctx.metadata.fps === null ? 'FPS could not be determined (missing or 0/0).' : null
    }
  },
  {
    id: 'fps_invalid',
    group: 'fps',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.fps === null) return null
      return (!Number.isFinite(ctx.metadata.fps) || ctx.metadata.fps <= 0) ? `FPS looks invalid (${ctx.metadata.fps}).` : null
    }
  },
  {
    id: 'fps_too_low',
    group: 'fps',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.fps === null || (!Number.isFinite(ctx.metadata.fps) || ctx.metadata.fps <= 0)) return null
      return ctx.metadata.fps < ctx.policy.minFps ? `FPS (${ctx.metadata.fps.toFixed(3)}) is below minimum (${ctx.policy.minFps}).` : null
    }
  },
  {
    id: 'fps_too_high',
    group: 'fps',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo || ctx.metadata.fps === null || (!Number.isFinite(ctx.metadata.fps) || ctx.metadata.fps <= 0)) return null
      return ctx.metadata.fps > ctx.policy.maxFps ? `FPS (${ctx.metadata.fps.toFixed(3)}) exceeds maximum (${ctx.policy.maxFps}).` : null
    }
  },
  {
    id: 'vfr_suspected',
    group: 'fps',
    severity: 'warning',
    condition: (ctx) => {
      if (!ctx.metadata.hasVideo) return null
      return ctx.metadata.vfrSuspected ? `Variable frame rate suspected (avg=${ctx.metadata.avgFps?.toFixed(3) ?? 'n/a'}, r=${ctx.metadata.rawFps?.toFixed(3) ?? 'n/a'}).` : null
    }
  },

  // Duration Rules
  {
    id: 'duration_missing',
    group: 'duration',
    severity: 'warning',
    condition: (ctx) => ctx.metadata.durationSeconds === null ? 'Duration is missing.' : null
  },
  {
    id: 'duration_too_short',
    group: 'duration',
    severity: 'error',
    condition: (ctx) => {
      if (ctx.metadata.durationSeconds === null) return null
      return ctx.metadata.durationSeconds < ctx.policy.minDurationSeconds
        ? `Duration (${ctx.metadata.durationSeconds.toFixed(3)}s) is below minimum (${ctx.policy.minDurationSeconds}s).` : null
    }
  },
  {
    id: 'duration_exceeds_max',
    group: 'duration',
    severity: 'error',
    condition: (ctx) => {
      if (ctx.metadata.durationSeconds === null) return null
      return ctx.metadata.durationSeconds > ctx.policy.maxDurationSeconds
        ? `Duration (${ctx.metadata.durationSeconds.toFixed(1)}s) exceeds configured maximum (${ctx.policy.maxDurationSeconds}s).` : null
    }
  },
  {
    id: 'container_stream_duration_mismatch',
    group: 'duration',
    severity: 'warning',
    condition: (ctx) => {
      return (ctx.metadata.formatDurationSeconds !== null && ctx.metadata.videoStreamDurationSeconds !== null &&
        Math.abs(ctx.metadata.formatDurationSeconds - ctx.metadata.videoStreamDurationSeconds) > ctx.policy.maxContainerStreamDurationDeltaSeconds)
        ? `Container duration (${ctx.metadata.formatDurationSeconds.toFixed(3)}s) differs from primary video stream duration (${ctx.metadata.videoStreamDurationSeconds.toFixed(3)}s).` : null
    }
  },

  // Bitrate / Size Rules
  {
    id: 'file_too_large',
    group: 'bitrate',
    severity: 'error',
    condition: (ctx) => {
      return (ctx.metadata.fileSizeBytes !== null && ctx.metadata.fileSizeBytes > ctx.policy.maxFileSizeBytes)
        ? `File size (${Math.round(ctx.metadata.fileSizeBytes / 1_000_000)} MB) exceeds configured maximum (${Math.round(ctx.policy.maxFileSizeBytes / 1_000_000)} MB).` : null
    }
  },
  {
    id: 'upload_size_category',
    group: 'bitrate',
    severity: 'info',
    condition: (ctx) => {
      return ctx.metadata.fileSizeBytes !== null ? `Estimated upload size category: ${uploadSizeDisplayLabel(ctx.metadata.uploadSizeCategory)}.` : null
    }
  },
  {
    id: 'bitrate_missing',
    group: 'bitrate',
    severity: 'warning',
    condition: (ctx) => ctx.metadata.bitrateBps === null ? 'Bitrate is missing.' : null
  },
  {
    id: 'bitrate_too_high',
    group: 'bitrate',
    severity: 'warning',
    condition: (ctx) => {
      if (ctx.metadata.bitrateBps === null) return null
      return ctx.metadata.bitrateBps > ctx.policy.maxBitrateBps
        ? `Bitrate (${Math.round(ctx.metadata.bitrateBps / 1_000_000)} Mbps) exceeds configured maximum (${Math.round(ctx.policy.maxBitrateBps / 1_000_000)} Mbps).` : null
    }
  },
  {
    id: 'bitrate_suspiciously_low',
    group: 'bitrate',
    severity: 'warning',
    condition: (ctx) => {
      if (ctx.metadata.bitrateBps === null || !ctx.metadata.width || !ctx.metadata.height || !ctx.metadata.hasVideo) return null
      const megapixels = (ctx.metadata.width * ctx.metadata.height) / 1_000_000
      const bpsPerMegapixel = ctx.metadata.bitrateBps / megapixels
      return bpsPerMegapixel < ctx.policy.minBitrateBpsPerMegapixel
        ? `Bitrate (${Math.round(ctx.metadata.bitrateBps / 1000)} kbps) looks low for ${ctx.metadata.width}×${ctx.metadata.height} (~${Math.round(bpsPerMegapixel / 1000)} kbps/Mpix).` : null
    }
  }
]
