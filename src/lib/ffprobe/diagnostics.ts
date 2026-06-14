import type { FileInfo } from 'ffprobe-wasm'
import { getPrimaryVideoStream } from './stream-utils'
import type { DimensionDiagnostics, NormalizedMetadata } from './types'

export function buildDimensionDiagnostics(
  fileInfo: FileInfo,
  metadata: NormalizedMetadata,
): DimensionDiagnostics {
  const primaryVideo = getPrimaryVideoStream(fileInfo.streams)
  const videoDims = metadata.videoStreamDimensions
  const audioDims = metadata.audioStreamDimensions

  if (!primaryVideo) {
    return {
      normalizerUsesPrimaryVideoStream: true,
      primaryVideoStreamIndex: null,
      normalizedWidth: metadata.width,
      normalizedHeight: metadata.height,
      rawVideoWidth: null,
      rawVideoHeight: null,
      rawVideoCodecWidth: null,
      rawVideoCodecHeight: null,
      rawAudioWidth: audioDims.rawWidth,
      rawAudioHeight: audioDims.rawHeight,
      dimensionSource: 'unavailable',
      conclusion: 'no_video_stream',
      explanation: 'No video stream found; width/height are not applicable.',
    }
  }

  const hasNativeDimensions =
    (videoDims.rawWidth ?? 0) > 0 && (videoDims.rawHeight ?? 0) > 0

  const hasCodecFallbackDimensions =
    (videoDims.rawCodecWidth ?? 0) > 0 && (videoDims.rawCodecHeight ?? 0) > 0

  const hasNormalizedDimensions =
    (metadata.width ?? 0) > 0 && (metadata.height ?? 0) > 0

  const hasAnyRawDimensions =
    hasNativeDimensions ||
    hasCodecFallbackDimensions ||
    (videoDims.rawWidth ?? 0) > 0 ||
    (videoDims.rawHeight ?? 0) > 0

  let dimensionSource: DimensionDiagnostics['dimensionSource'] = 'unavailable'
  let conclusion: DimensionDiagnostics['conclusion'] = 'ok'
  let explanation = 'Primary video stream width/height detected from streams[n].width/height.'

  if (hasNativeDimensions) {
    dimensionSource = 'native'
    conclusion = 'ok'
    explanation = 'Primary video stream width/height detected from streams[n].width/height.'
  } else if (hasCodecFallbackDimensions && hasNormalizedDimensions) {
    dimensionSource = 'codec_fallback'
    conclusion = 'codec_fallback'
    explanation =
      'Native width/height were unavailable. Resolution was recovered from codec_width/codec_height.'
  } else if (!hasAnyRawDimensions && !hasNormalizedDimensions) {
    dimensionSource = 'unavailable'
    conclusion = 'ffprobe_wasm_limitation'
    explanation =
      'Primary video stream exists and codec is detected, but ffprobe-wasm returned width/height and codec_width/codec_height as 0 or missing. This is a library limitation, not a normalizer bug. Resolution preflight should remain disabled.'
  } else if (hasAnyRawDimensions && !hasNormalizedDimensions) {
    dimensionSource = 'unavailable'
    conclusion = 'normalizer_bug'
    explanation =
      'Raw video stream contains dimension fields, but normalized width/height are missing. Check normalizer fallback logic.'
  } else if (
    primaryVideo.index !== metadata.primaryVideoStreamIndex &&
    metadata.primaryVideoStreamIndex !== null
  ) {
    dimensionSource = 'unavailable'
    conclusion = 'normalizer_bug'
    explanation = 'Normalizer selected a different stream index than the primary video stream.'
  }

  return {
    normalizerUsesPrimaryVideoStream: true,
    primaryVideoStreamIndex: primaryVideo.index,
    normalizedWidth: metadata.width,
    normalizedHeight: metadata.height,
    rawVideoWidth: videoDims.rawWidth,
    rawVideoHeight: videoDims.rawHeight,
    rawVideoCodecWidth: videoDims.rawCodecWidth,
    rawVideoCodecHeight: videoDims.rawCodecHeight,
    rawAudioWidth: audioDims.rawWidth,
    rawAudioHeight: audioDims.rawHeight,
    dimensionSource,
    conclusion,
    explanation,
  }
}

export function getFieldReliability(metadata: NormalizedMetadata, dimensions: DimensionDiagnostics): {
  reliableFields: string[]
  unreliableFields: string[]
  fallbackFields: string[]
} {
  const reliableFields = [
    'containerFormat',
    'videoCodec',
    'audioCodec',
    'hasVideo',
    'hasAudio',
    'videoStreamCount',
    'audioStreamCount',
    'durationSeconds',
    'fps',
    'bitrateBps',
    'fileSizeBytes',
    'fileExtension',
    'extensionContainerMatch',
  ]

  const unreliableFields: string[] = []
  const fallbackFields: string[] = []

  if (dimensions.conclusion === 'codec_fallback') {
    fallbackFields.push('width', 'height', 'resolutionCategory')
  } else if (dimensions.conclusion === 'ffprobe_wasm_limitation') {
    unreliableFields.push('width', 'height', 'resolutionCategory')
  }

  if (metadata.fps === null) unreliableFields.push('fps')
  if (metadata.bitrateBps === null) unreliableFields.push('bitrateBps')
  if (metadata.durationSeconds === null) unreliableFields.push('durationSeconds')
  if (metadata.vfrSuspected) unreliableFields.push('fps (VFR suspected)')
  if (metadata.rotation === null) unreliableFields.push('rotation')
  if (!metadata.colorPrimaries) unreliableFields.push('colorPrimaries/HDR')

  return {
    reliableFields: reliableFields.filter((field) => !unreliableFields.includes(field) && !fallbackFields.includes(field)),
    unreliableFields,
    fallbackFields,
  }
}
