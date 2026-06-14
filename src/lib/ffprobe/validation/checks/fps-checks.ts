import type { NormalizedMetadata, UploaderPolicy, ValidationIssue } from '../../types'
import { createIssue } from '../helpers'

export function runFpsChecks(
  metadata: NormalizedMetadata,
  policy: UploaderPolicy,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!metadata.hasVideo) {
    return issues
  }

  if (metadata.fps === null) {
    issues.push(createIssue('fps_missing', 'FPS could not be determined (missing or 0/0).', 'warning'))
    return issues
  }

  if (!Number.isFinite(metadata.fps) || metadata.fps <= 0) {
    issues.push(createIssue('fps_invalid', `FPS looks invalid (${metadata.fps}).`, 'warning'))
    return issues
  }

  if (metadata.fps < policy.minFps) {
    issues.push(
      createIssue(
        'fps_too_low',
        `FPS (${metadata.fps.toFixed(3)}) is below minimum (${policy.minFps}).`,
        'warning',
      ),
    )
  } else if (metadata.fps > policy.maxFps) {
    issues.push(
      createIssue(
        'fps_too_high',
        `FPS (${metadata.fps.toFixed(3)}) exceeds maximum (${policy.maxFps}).`,
        'warning',
      ),
    )
  }

  if (metadata.vfrSuspected) {
    issues.push(
      createIssue(
        'vfr_suspected',
        `Variable frame rate suspected (avg=${metadata.avgFps?.toFixed(3) ?? 'n/a'}, r=${metadata.rawFps?.toFixed(3) ?? 'n/a'}).`,
        'warning',
      ),
    )
  }

  return issues
}
