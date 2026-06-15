import type { FileContext, NormalizedMetadata } from '../types'
import type { MinimalProbeResult, MinimalStream } from './types'

function primaryStream(streams: MinimalStream[] | undefined, type: string): MinimalStream | undefined {
  return streams?.find((s) => s.codec_type === type)
}

function unknownToNull(value: string | null | undefined): string | null {
  if (!value || value === 'unknown') return null
  return value
}

export function normalizeMinimalProbe(
  probe: MinimalProbeResult,
  context: FileContext = {},
): NormalizedMetadata {
  const streams = probe.streams ?? []
  const video = primaryStream(streams, 'video')
  const audio = primaryStream(streams, 'audio')

  const width = video?.width ?? null
  const height = video?.height ?? null
  const rawCodecWidth = video?.codec_width ?? video?.width ?? null
  const rawCodecHeight = video?.codec_height ?? video?.height ?? null

  const missingFields: string[] = []
  if (!probe.ok) missingFields.push('probe_failed')
  if (!probe.format_name) missingFields.push('format')
  if (probe.duration == null) missingFields.push('duration')
  if (probe.bit_rate == null) missingFields.push('bitrate')
  if (probe.has_video && !video?.codec_name) missingFields.push('video.codec_name')
  if (probe.has_audio && !audio?.codec_name) missingFields.push('audio.codec_name')
  if (probe.has_video && (width == null || height == null)) missingFields.push('width/height')
  if (probe.has_video && video?.fps == null) missingFields.push('fps')

  const colorPrimaries = unknownToNull(video?.color_primaries)
  const colorTransfer = unknownToNull(video?.color_transfer)
  const colorSpace = unknownToNull(video?.color_space)

  return {
    containerFormat: probe.format_name ?? null,
    durationSeconds: probe.duration ?? null,
    formatDurationSeconds: probe.duration ?? null,
    videoStreamDurationSeconds: video?.duration ?? null,
    audioStreamDurationSeconds: audio?.duration ?? null,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    videoProfile: video?.profile ?? null,
    videoLevel: video?.level != null && video.level >= 0 ? video.level : null,
    width,
    height,
    isVertical: Boolean(width && height && height > width),
    aspectRatio: width && height ? width / height : null,
    sampleAspectRatio: video?.sample_aspect_ratio ?? null,
    displayAspectRatio: video?.display_aspect_ratio ?? null,
    standardAspectRatio: false,
    fps: video?.fps ?? null,
    avgFps: video?.fps ?? null,
    rawFps: null,
    bitrateBps: probe.bit_rate ?? null,
    audioBitrateBps: audio?.bit_rate ?? null,
    audioSampleRate: audio?.sample_rate ?? null,
    audioChannels: audio?.channels ?? null,
    hasVideo: Boolean(probe.has_video),
    hasAudio: Boolean(probe.has_audio),
    videoStreamCount: probe.video_stream_count ?? 0,
    audioStreamCount: probe.audio_stream_count ?? 0,
    fileName: context.fileName ?? null,
    fileExtension: context.fileName?.split('.').pop()?.toLowerCase() ?? null,
    mimeType: context.mimeType ?? null,
    fileSizeBytes: context.fileSizeBytes ?? null,
    uploadSizeCategory: 'medium',
    resolutionCategory: 'unknown',
    pixelFormat: video?.pix_fmt ?? null,
    fieldOrder: null,
    rotation: video?.rotation ?? (video?.tags?.rotate ? Number(video.tags.rotate) : null),
    colorRange: unknownToNull(video?.color_range),
    colorPrimaries,
    colorTransfer,
    colorSpace,
    isHdr: Boolean(video?.is_hdr),
    is10Bit: Boolean(video?.pix_fmt?.includes('10')),
    isInterlaced: false,
    vfrSuspected: false,
    extensionContainerMatch: null,
    mimeContainerMatch: null,
    primaryVideoStreamIndex: video?.index ?? null,
    primaryAudioStreamIndex: audio?.index ?? null,
    videoStreamDimensions: {
      width,
      height,
      rawWidth: width,
      rawHeight: height,
      rawCodecWidth,
      rawCodecHeight,
    },
    audioStreamDimensions: {
      width: null,
      height: null,
      rawWidth: null,
      rawHeight: null,
      rawCodecWidth: null,
      rawCodecHeight: null,
    },
    missingFields,
    suspiciousFields: probe.ok ? [] : [probe.error_detail ?? probe.error ?? 'probe_failed'],
  }
}
