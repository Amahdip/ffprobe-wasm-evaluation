import type { FileInfo } from 'ffprobe-wasm'
import type { NormalizedMetadata, UploaderPolicy, ValidationIssue } from '../../types'
import {
  createIssue,
  is10BitPixelFormat,
  isHdrVideo,
  isInterlacedFieldOrder,
  normalizeCodec,
} from '../helpers'

type ExtendedStream = FileInfo['streams'][number] & {
  field_order?: string
  color_transfer?: string
}

export function runVideoChecks(
  fileInfo: FileInfo,
  metadata: NormalizedMetadata,
  policy: UploaderPolicy,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!metadata.hasVideo) {
    issues.push(createIssue('no_video_stream', 'No video stream detected.', 'warning'))
    return issues
  }

  if (metadata.videoStreamCount > 1) {
    issues.push(
      createIssue(
        'multiple_video_streams',
        `Multiple video streams detected (${metadata.videoStreamCount}).`,
        'warning',
      ),
    )
  }

  const videoCodec = normalizeCodec(metadata.videoCodec)
  const isAllowed = policy.allowedVideoCodecs.some((codec) => videoCodec.includes(codec))

  if (!isAllowed) {
    issues.push(
      createIssue(
        'video_codec_unsupported',
        `Video codec "${metadata.videoCodec}" is outside the allowed list (${policy.allowedVideoCodecs.join(', ')}).`,
        'warning',
      ),
    )
  }

  if (videoCodec.includes('av1')) {
    issues.push(
      createIssue('codec_av1', 'AV1 detected. Downstream compatibility may vary.', 'warning'),
    )
  } else if (videoCodec.includes('hevc') || videoCodec.includes('h265')) {
    issues.push(
      createIssue('codec_hevc', 'HEVC/H.265 detected. Playback/transcode support varies.', 'warning'),
    )
  } else if (
    policy.warnVp8Vp9 &&
    (videoCodec.includes('vp8') || videoCodec.includes('vp9'))
  ) {
    issues.push(
      createIssue(
        'codec_vp8_vp9',
        `${metadata.videoCodec?.toUpperCase()} detected. Policy prefers other codecs for upload.`,
        'warning',
      ),
    )
  } else if (policy.warnVideoCodecs.some((codec) => videoCodec.includes(codec))) {
    issues.push(
      createIssue(
        'video_codec_review',
        `Video codec "${metadata.videoCodec}" is flagged for extra review.`,
        'warning',
      ),
    )
  }

  const primaryVideo = fileInfo.streams.find(
    (stream) => stream.index === metadata.primaryVideoStreamIndex,
  ) as ExtendedStream | undefined

  const pixelFormat = metadata.pixelFormat?.toLowerCase() ?? ''
  if (
    pixelFormat &&
    !policy.standardPixelFormats.some((fmt) => pixelFormat === fmt.toLowerCase())
  ) {
    issues.push(
      createIssue(
        'pixel_format_unusual',
        `Pixel format "${metadata.pixelFormat}" is not a standard upload format (expected ${policy.standardPixelFormats.join(', ')}).`,
        'warning',
      ),
    )
  }

  if (is10BitPixelFormat(metadata.pixelFormat)) {
    issues.push(
      createIssue(
        'video_10bit',
        `10-bit video detected (pixel format: ${metadata.pixelFormat}). Transcode compatibility may vary.`,
        'warning',
      ),
    )
  }

  if (isHdrVideo(metadata.colorPrimaries, metadata.colorTransfer)) {
    issues.push(
      createIssue(
        'video_hdr_metadata',
        `HDR metadata detected (primaries: ${metadata.colorPrimaries ?? 'n/a'}, transfer: ${metadata.colorTransfer ?? 'n/a'}).`,
        'warning',
      ),
    )
  }

  const fieldOrder =
    metadata.fieldOrder ??
    primaryVideo?.field_order ??
    primaryVideo?.tags?.field_order ??
    null

  if (isInterlacedFieldOrder(fieldOrder)) {
    issues.push(
      createIssue(
        'video_interlaced',
        `Interlaced video detected (field_order: ${fieldOrder}).`,
        'warning',
      ),
    )
  }

  return issues
}
