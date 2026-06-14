import type { ValidationDecision, ValidationIssue } from '../types'
import type { UploaderPolicy } from '../types'

export function deriveValidationDecision(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  analyzeError: string | null,
  policy: UploaderPolicy,
): ValidationDecision {
  if (analyzeError) {
    return 'soft_fail'
  }

  const blockCodes = new Set(policy.blockViolationCodes)
  const blockingErrors = errors.filter((entry) => blockCodes.has(entry.code))

  if (blockingErrors.length > 0) {
    return 'block'
  }

  if (errors.some((entry) => entry.code === 'analyze_failed')) {
    return 'soft_fail'
  }

  if (errors.length > 0) {
    return 'soft_fail'
  }

  if (warnings.length > 0) {
    return 'warn'
  }

  return 'pass'
}
