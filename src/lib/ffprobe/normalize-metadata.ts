import type { FileInfo } from 'ffprobe-wasm'
import {
  getAudioStreams,
  getPrimaryAudioStream,
  getPrimaryVideoStream,
  getVideoStreams,
  readStreamDimension,
} from './stream-utils'
import {
  is10BitPixelFormat,
  isHdrVideo,
  isInterlacedFieldOrder,
  isStandardAspectRatio,
  isVfrSuspected,
} from './validation/helpers'
import type {
  FileContext,
  NormalizedMetadata,
  ResolutionCategory,
  StreamDimensions,
  UploadSizeCategory,
} from './types'

type ExtendedStream = FileInfo['streams'][number] & {
  field_order?: string
  color_transfer?: string
}

function parseRational(value: string | undefined): number | null {
  if (!value || value === '0/0' || value === 'N/A') {
    return null
  }

  const [numerator, denominator] = value.split('/').map(Number)

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null
  }

  return numerator / denominator
}

function parseNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '' || value === 'N/A') {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)

  return Number.isFinite(parsed) ? parsed : null
}

function getStreamDimensions(stream: FileInfo['streams'][number] | undefined): StreamDimensions {
  if (!stream) {
    return {
      width: null,
      height: null,
      rawWidth: null,
      rawHeight: null,
      rawCodecWidth: null,
      rawCodecHeight: null,
    }
  }

  const rawWidth = typeof stream.width === 'number' ? stream.width : null
  const rawHeight = typeof stream.height === 'number' ? stream.height : null
  const rawCodecWidth = typeof stream.codec_width === 'number' ? stream.codec_width : null
  const rawCodecHeight = typeof stream.codec_height === 'number' ? stream.codec_height : null

  return {
    width: readStreamDimension(stream, 'width'),
    height: readStreamDimension(stream, 'height'),
    rawWidth,
    rawHeight,
    rawCodecWidth,
    rawCodecHeight,
  }
}

function getFileExtension(fileName: string | null): string | null {
  if (!fileName) {
    return null
  }

  const parts = fileName.split('.')
  if (parts.length < 2) {
    return null
  }

  return parts.at(-1)?.toLowerCase() ?? null
}

function inferContainersFromExtension(extension: string | null): string[] {
  if (!extension) {
    return []
  }

  const map: Record<string, string[]> = {
    mp4: ['mp4', 'mov'],
    m4v: ['mp4', 'mov'],
    mov: ['mov', 'mp4'],
    webm: ['webm', 'matroska'],
    mkv: ['matroska', 'webm'],
    avi: ['avi'],
    flv: ['flv'],
    mp3: ['mp4', 'mov', 'mp3'],
    wav: ['wav'],
    m4a: ['mp4', 'm4a'],
  }

  return map[extension] ?? []
}

function inferContainersFromMime(mimeType: string | null): string[] {
  if (!mimeType) {
    return []
  }

  const normalized = mimeType.toLowerCase()

  if (normalized.includes('mp4')) return ['mp4', 'mov']
  if (normalized.includes('webm')) return ['webm', 'matroska']
  if (normalized.includes('matroska') || normalized.includes('mkv')) return ['matroska', 'webm']
  if (normalized.includes('quicktime')) return ['mov', 'mp4']
  if (normalized.includes('x-msvideo')) return ['avi']
  if (normalized.includes('x-flv')) return ['flv']

  return []
}

function containerMatches(detected: string | null, candidates: string[]): boolean | null {
  if (!detected || candidates.length === 0) {
    return null
  }

  const parts = detected.toLowerCase().split(',')
  return candidates.some((candidate) => parts.some((part) => part.includes(candidate)))
}

function getResolutionCategory(width: number | null, height: number | null): ResolutionCategory {
  if (!width || !height) {
    return 'unknown'
  }

  const maxEdge = Math.max(width, height)

  if (maxEdge >= 3840) return '4K+'
  if (maxEdge >= 2560) return 'QHD'
  if (maxEdge >= 1920) return 'FHD'
  if (maxEdge >= 1280) return 'HD'
  if (maxEdge > 0) return 'SD'

  return 'unknown'
}

function getUploadSizeCategory(bytes: number | null): UploadSizeCategory {
  if (bytes === null) {
    return 'medium'
  }

  if (bytes < 1_000_000) return 'tiny'
  if (bytes < 10_000_000) return 'small'
  if (bytes < 100_000_000) return 'medium'
  if (bytes < 500_000_000) return 'large'

  return 'very_large'
}

function parseRotation(stream: FileInfo['streams'][number] | undefined): number | null {
  if (!stream?.tags) {
    return null
  }

  const rotate = stream.tags.rotate ?? stream.tags.Rotate

  if (!rotate) {
    return null
  }

  const parsed = Number.parseInt(rotate, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeMetadata(
  fileInfo: FileInfo,
  context: FileContext = {},
): NormalizedMetadata {
  const videoStreams = getVideoStreams(fileInfo.streams)
  const audioStreams = getAudioStreams(fileInfo.streams)
  const primaryVideo = getPrimaryVideoStream(fileInfo.streams) as ExtendedStream | undefined
  const primaryAudio = getPrimaryAudioStream(fileInfo.streams)

  const avgFps = parseRational(primaryVideo?.avg_frame_rate)
  const rawFps = parseRational(primaryVideo?.r_frame_rate)
  const fps = avgFps && avgFps > 0 ? avgFps : rawFps && rawFps > 0 ? rawFps : null

  const width = readStreamDimension(primaryVideo, 'width')
  const height = readStreamDimension(primaryVideo, 'height')

  const formatDurationSeconds = parseNumber(fileInfo.format?.duration)
  const videoStreamDurationSeconds = parseNumber(primaryVideo?.duration)
  const audioStreamDurationSeconds = parseNumber(primaryAudio?.duration)

  const durationSeconds =
    formatDurationSeconds ?? videoStreamDurationSeconds ?? audioStreamDurationSeconds

  const bitrateBps =
    parseNumber(fileInfo.format?.bit_rate) ??
    parseNumber(primaryVideo?.bit_rate) ??
    parseNumber(primaryAudio?.bit_rate)

  const audioBitrateBps = parseNumber(primaryAudio?.bit_rate)
  const audioSampleRate = parseNumber(primaryAudio?.sample_rate)
  const audioChannels =
    typeof primaryAudio?.channels === 'number' ? primaryAudio.channels : null

  const colorPrimaries = primaryVideo?.color_primaries ?? null
  const colorTransfer =
    primaryVideo?.color_transfer ??
    primaryVideo?.tags?.color_transfer ??
    null
  const pixelFormat = primaryVideo?.pix_fmt ?? null
  const fieldOrder =
    primaryVideo?.field_order ??
    primaryVideo?.tags?.field_order ??
    null

  const aspectRatio = width && height ? width / height : null

  const fileName = context.fileName ?? fileInfo.format?.filename ?? null
  const fileExtension = getFileExtension(fileName)
  const mimeType = context.mimeType ?? null
  const fileSizeBytes =
    context.fileSizeBytes ?? parseNumber(fileInfo.format?.size) ?? null

  const containerFormat = fileInfo.format?.format_name ?? null
  const extensionContainerMatch = containerMatches(
    containerFormat,
    inferContainersFromExtension(fileExtension),
  )
  const mimeContainerMatch = containerMatches(containerFormat, inferContainersFromMime(mimeType))

  const missingFields: string[] = []
  const suspiciousFields: string[] = []

  if (!containerFormat) missingFields.push('format.format_name')
  if (durationSeconds === null) missingFields.push('duration')
  if (bitrateBps === null) missingFields.push('bitrate')

  if (videoStreams.length > 0) {
    if (width === null || height === null) missingFields.push('width/height')
    if (fps === null) missingFields.push('fps')
    if (!primaryVideo?.codec_name) missingFields.push('video.codec_name')
  }

  if (audioStreams.length > 0 && !primaryAudio?.codec_name) {
    missingFields.push('audio.codec_name')
  }

  const declaredStreamCount = parseNumber(fileInfo.format?.nb_streams)
  if (declaredStreamCount !== null && declaredStreamCount !== fileInfo.streams.length) {
    suspiciousFields.push(
      `format.nb_streams (${declaredStreamCount}) != streams.length (${fileInfo.streams.length})`,
    )
  }

  if (extensionContainerMatch === false) {
    suspiciousFields.push('file extension does not match detected container')
  }

  if (mimeContainerMatch === false) {
    suspiciousFields.push('MIME type does not match detected container')
  }

  if (isVfrSuspected(avgFps, rawFps)) {
    suspiciousFields.push(`VFR suspected: avg_frame_rate=${primaryVideo?.avg_frame_rate}, r_frame_rate=${primaryVideo?.r_frame_rate}`)
  }

  if (videoStreams.length > 1) {
    suspiciousFields.push(`multiple video streams (${videoStreams.length})`)
  }

  if (audioStreams.length > 1) {
    suspiciousFields.push(`multiple audio streams (${audioStreams.length})`)
  }

  return {
    containerFormat,
    durationSeconds,
    formatDurationSeconds,
    videoStreamDurationSeconds,
    audioStreamDurationSeconds,
    videoCodec: primaryVideo?.codec_name ?? null,
    audioCodec: primaryAudio?.codec_name ?? null,
    videoProfile: primaryVideo?.profile || null,
    videoLevel: typeof primaryVideo?.level === 'number' ? primaryVideo.level : null,
    width,
    height,
    isVertical: Boolean(width && height && height > width),
    aspectRatio,
    standardAspectRatio: width && height ? isStandardAspectRatio(width, height) : false,
    fps,
    avgFps,
    rawFps,
    bitrateBps,
    audioBitrateBps,
    audioSampleRate,
    audioChannels,
    hasVideo: videoStreams.length > 0,
    hasAudio: audioStreams.length > 0,
    videoStreamCount: videoStreams.length,
    audioStreamCount: audioStreams.length,
    fileName,
    fileExtension,
    mimeType,
    fileSizeBytes,
    uploadSizeCategory: getUploadSizeCategory(fileSizeBytes),
    resolutionCategory: getResolutionCategory(width, height),
    pixelFormat,
    fieldOrder,
    rotation: parseRotation(primaryVideo),
    colorRange: primaryVideo?.color_range ?? null,
    colorPrimaries,
    colorTransfer,
    isHdr: isHdrVideo(colorPrimaries, colorTransfer),
    is10Bit: is10BitPixelFormat(pixelFormat),
    isInterlaced: isInterlacedFieldOrder(fieldOrder),
    vfrSuspected: isVfrSuspected(avgFps, rawFps),
    extensionContainerMatch,
    mimeContainerMatch,
    primaryVideoStreamIndex: primaryVideo?.index ?? null,
    primaryAudioStreamIndex: primaryAudio?.index ?? null,
    videoStreamDimensions: getStreamDimensions(primaryVideo),
    audioStreamDimensions: getStreamDimensions(primaryAudio),
    missingFields,
    suspiciousFields,
  }
}
