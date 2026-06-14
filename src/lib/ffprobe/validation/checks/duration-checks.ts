import type { NormalizedMetadata, UploaderPolicy, ValidationIssue } from '../../types'
import { createIssue } from '../helpers'

export function runDurationChecks(
  metadata: NormalizedMetadata,
  policy: UploaderPolicy,
): { warnings: ValidationIssue[]; errors: ValidationIssue[] } {
  const warnings: ValidationIssue[] = []
  const errors: ValidationIssue[] = []

  if (metadata.durationSeconds === null) {
    warnings.push(createIssue('duration_missing', 'Duration is missing.', 'warning'))
    return { warnings, errors }
  }

  if (metadata.durationSeconds < policy.minDurationSeconds) {
    warnings.push(
      createIssue(
        'duration_too_short',
        `Duration (${metadata.durationSeconds.toFixed(3)}s) is below minimum (${policy.minDurationSeconds}s).`,
        'warning',
      ),
    )
  }

  if (metadata.durationSeconds > policy.maxDurationSeconds) {
    errors.push(
      createIssue(
        'duration_exceeds_max',
        `Duration (${metadata.durationSeconds.toFixed(1)}s) exceeds configured maximum (${policy.maxDurationSeconds}s).`,
        'error',
      ),
    )
  }

  if (
    metadata.formatDurationSeconds !== null &&
    metadata.videoStreamDurationSeconds !== null &&
    Math.abs(metadata.formatDurationSeconds - metadata.videoStreamDurationSeconds) >
      policy.maxContainerStreamDurationDeltaSeconds
  ) {
    warnings.push(
      createIssue(
        'container_stream_duration_mismatch',
        `Container duration (${metadata.formatDurationSeconds.toFixed(3)}s) differs from primary video stream duration (${metadata.videoStreamDurationSeconds.toFixed(3)}s).`,
        'warning',
      ),
    )
  }

  return { warnings, errors }
}
