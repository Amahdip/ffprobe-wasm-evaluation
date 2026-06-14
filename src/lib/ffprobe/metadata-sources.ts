import type { FileInfo } from 'ffprobe-wasm'
import {
  getPrimaryAudioStream,
  getPrimaryVideoStream,
  readStreamDimensionWithSource,
} from './stream-utils'
import type { FileContext, NormalizedMetadata } from './types'

export type MetadataSourceMap = Record<string, string>

function parseRational(value: string | undefined): number | null {
  if (!value || value === '0/0' || value === 'N/A') return null
  const [n, d] = value.split('/').map(Number)
  return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : null
}

function parseNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '' || value === 'N/A') return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function streamRef(index: number | undefined, field: string): string {
  return index === undefined ? field : `streams[${index}].${field}`
}

export function buildMetadataSources(
  fileInfo: FileInfo,
  metadata: NormalizedMetadata,
  context: FileContext = {},
): MetadataSourceMap {
  const primaryVideo = getPrimaryVideoStream(fileInfo.streams)
  const primaryAudio = getPrimaryAudioStream(fileInfo.streams)
  const videoIndex = primaryVideo?.index
  const audioIndex = primaryAudio?.index

  const width = readStreamDimensionWithSource(primaryVideo, 'width')
  const height = readStreamDimensionWithSource(primaryVideo, 'height')

  const avgFps = parseRational(primaryVideo?.avg_frame_rate)
  const rawFps = parseRational(primaryVideo?.r_frame_rate)
  const fpsSource =
    avgFps && avgFps > 0
      ? streamRef(videoIndex, 'avg_frame_rate')
      : rawFps && rawFps > 0
        ? streamRef(videoIndex, 'r_frame_rate')
        : 'unavailable'

  const formatDuration = parseNumber(fileInfo.format?.duration)
  const videoDuration = parseNumber(primaryVideo?.duration)
  const audioDuration = parseNumber(primaryAudio?.duration)
  const durationSource =
    formatDuration !== null
      ? 'format.duration'
      : videoDuration !== null
        ? streamRef(videoIndex, 'duration')
        : audioDuration !== null
          ? streamRef(audioIndex, 'duration')
          : 'unavailable'

  const formatBitrate = parseNumber(fileInfo.format?.bit_rate)
  const videoBitrate = parseNumber(primaryVideo?.bit_rate)
  const audioBitrate = parseNumber(primaryAudio?.bit_rate)
  const bitrateSource =
    formatBitrate !== null
      ? 'format.bit_rate'
      : videoBitrate !== null
        ? streamRef(videoIndex, 'bit_rate')
        : audioBitrate !== null
          ? streamRef(audioIndex, 'bit_rate')
          : 'unavailable'

  const resolutionSource =
    width.source && height.source
      ? width.source === height.source
        ? width.source.replace('.width', '.width × height').replace('codec_width', 'codec_width/codec_height fallback')
        : `${width.source} × ${height.source}`
      : width.source ?? height.source ?? 'unavailable'

  const rotationTag = primaryVideo?.tags?.rotate ?? primaryVideo?.tags?.Rotate
  const rotationSource = rotationTag
    ? streamRef(videoIndex, 'tags.rotate')
    : metadata.rotation !== null
      ? 'derived'
      : 'unavailable (not verified in ffprobe-wasm)'

  const colorPrimariesSource = primaryVideo?.color_primaries
    ? streamRef(videoIndex, 'color_primaries')
    : 'unavailable (not verified in ffprobe-wasm)'

  const pixelFormatSource = primaryVideo?.pix_fmt
    ? streamRef(videoIndex, 'pix_fmt')
    : 'unavailable'

  return {
    resolution: resolutionSource,
    fps: fpsSource,
    videoCodec: primaryVideo?.codec_name
      ? streamRef(videoIndex, 'codec_name')
      : 'unavailable',
    audioCodec: primaryAudio?.codec_name
      ? streamRef(audioIndex, 'codec_name')
      : 'unavailable',
    duration: durationSource,
    bitrate: bitrateSource,
    container: fileInfo.format?.format_name ? 'format.format_name' : 'unavailable',
    hasVideo: `streams filtered by codec_type=video (${metadata.videoStreamCount} found)`,
    hasAudio: `streams filtered by codec_type=audio (${metadata.audioStreamCount} found)`,
    fileSize: context.fileSizeBytes != null ? 'File API (file.size)' : fileInfo.format?.size ? 'format.size' : 'unavailable',
    fileExtension: context.fileName ? 'File API (file.name)' : 'unavailable',
    extensionMatch: metadata.extensionContainerMatch === null
      ? 'not evaluated'
      : 'file extension vs format.format_name',
    mimeMatch: metadata.mimeContainerMatch === null
      ? 'not evaluated'
      : 'file.type vs format.format_name',
    resolutionCategory: metadata.width && metadata.height ? 'derived from width/height' : 'unavailable',
    rotation: rotationSource,
    pixelFormat: pixelFormatSource,
    colorPrimaries: colorPrimariesSource,
    colorRange: primaryVideo?.color_range
      ? streamRef(videoIndex, 'color_range')
      : 'unavailable (not verified in ffprobe-wasm)',
    vfrSuspected: 'avg_frame_rate vs r_frame_rate comparison',
    videoStreamCount: 'streams.filter(codec_type=video).length',
    audioStreamCount: 'streams.filter(codec_type=audio).length',
  }
}
