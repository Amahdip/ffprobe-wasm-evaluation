import type { DimensionDiagnostics, NormalizedMetadata, UploaderPolicy, ValidationIssue } from '../../types'
import { createIssue, getAspectRatioLabel } from '../helpers'

export function runResolutionChecks(
  metadata: NormalizedMetadata,
  dimensionDiagnostics: DimensionDiagnostics,
  policy: UploaderPolicy,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { width, height } = metadata

  if (!metadata.hasVideo) {
    return issues
  }

  if (width === null || height === null) {
    if (dimensionDiagnostics.conclusion === 'ffprobe_wasm_limitation') {
      issues.push(
        createIssue(
          'dimensions_unreliable',
          'Width/height are unavailable from ffprobe-wasm. Keep backend/Akuma resolution validation authoritative.',
          'warning',
        ),
      )
    } else {
      issues.push(createIssue('dimensions_missing', 'Width/height could not be determined.', 'warning'))
    }
    return issues
  }

  if (dimensionDiagnostics.conclusion === 'codec_fallback') {
    issues.push(
      createIssue(
        'dimensions_codec_fallback',
        'Native width/height were unavailable. Resolution was recovered from codec_width/codec_height.',
        'warning',
      ),
    )
  }

  if (width < policy.minWidth || height < policy.minHeight) {
      issues.push(
        createIssue(
          'resolution_too_small',
          `Resolution ${width}×${height} is below minimum ${policy.minWidth}×${policy.minHeight}.`,
          'warning',
        ),
      )
    }

  if (width > policy.maxWidth || height > policy.maxHeight) {
      issues.push(
        createIssue(
          'resolution_too_large',
          `Resolution ${width}×${height} exceeds maximum ${policy.maxWidth}×${policy.maxHeight}.`,
          'warning',
        ),
      )
    }

  if (metadata.isVertical) {
    issues.push(
      createIssue(
        'vertical_video',
        `Vertical video detected (${width}×${height}).`,
        'info',
      ),
    )
  }

  const aspectLabel = getAspectRatioLabel(width, height, policy.standardAspectRatioTolerance)
  if (!aspectLabel) {
    const ratio = (width / height).toFixed(3)
    issues.push(
      createIssue(
        'aspect_ratio_non_standard',
        `Non-standard aspect ratio detected (${ratio}:1).`,
        'warning',
      ),
    )
  }

  if (width % 2 !== 0 || height % 2 !== 0) {
    issues.push(
      createIssue(
        'dimensions_not_divisible_by_2',
        `Dimensions ${width}×${height} are not divisible by 2 (encoding compatibility risk).`,
        'warning',
      ),
    )
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    issues.push(
      createIssue(
        'dimensions_not_divisible_by_16',
        `Dimensions ${width}×${height} are not divisible by 16 (may affect encoder efficiency).`,
        'warning',
      ),
    )
  }

  return issues
}
