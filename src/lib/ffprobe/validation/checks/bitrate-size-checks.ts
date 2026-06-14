import type { NormalizedMetadata, UploaderPolicy, ValidationIssue } from '../../types'
import { createIssue, uploadSizeDisplayLabel } from '../helpers'

export function runBitrateSizeChecks(
  metadata: NormalizedMetadata,
  policy: UploaderPolicy,
): { warnings: ValidationIssue[]; errors: ValidationIssue[] } {
  const warnings: ValidationIssue[] = []
  const errors: ValidationIssue[] = []

  if (metadata.fileSizeBytes !== null && metadata.fileSizeBytes > policy.maxFileSizeBytes) {
    errors.push(
      createIssue(
        'file_too_large',
        `File size (${Math.round(metadata.fileSizeBytes / 1_000_000)} MB) exceeds configured maximum (${Math.round(policy.maxFileSizeBytes / 1_000_000)} MB).`,
        'error',
      ),
    )
  }

  if (metadata.fileSizeBytes !== null) {
    warnings.push(
      createIssue(
        'upload_size_category',
        `Estimated upload size category: ${uploadSizeDisplayLabel(metadata.uploadSizeCategory)}.`,
        'info',
      ),
    )
  }

  if (metadata.bitrateBps === null) {
    warnings.push(createIssue('bitrate_missing', 'Bitrate is missing.', 'warning'))
  } else {
    if (metadata.bitrateBps > policy.maxBitrateBps) {
      warnings.push(
        createIssue(
          'bitrate_too_high',
          `Bitrate (${Math.round(metadata.bitrateBps / 1_000_000)} Mbps) exceeds configured maximum (${Math.round(policy.maxBitrateBps / 1_000_000)} Mbps).`,
          'warning',
        ),
      )
    }

    if (
      metadata.width &&
      metadata.height &&
      metadata.hasVideo
    ) {
      const megapixels = (metadata.width * metadata.height) / 1_000_000
      const bpsPerMegapixel = metadata.bitrateBps / megapixels
      if (bpsPerMegapixel < policy.minBitrateBpsPerMegapixel) {
        warnings.push(
          createIssue(
            'bitrate_suspiciously_low',
            `Bitrate (${Math.round(metadata.bitrateBps / 1000)} kbps) looks low for ${metadata.width}×${metadata.height} (~${Math.round(bpsPerMegapixel / 1000)} kbps/Mpix).`,
            'warning',
          ),
        )
      }
    }
  }

  return { warnings, errors }
}
