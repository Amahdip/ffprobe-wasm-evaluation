import type { ValidationDecision, ValidationIssue } from '../types'
import type { UploaderPolicy } from '../types'

export function deriveValidationDecision(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  analyzeError: string | null,
  policy: UploaderPolicy,
): ValidationDecision {
  if (analyzeError) {
    return 'SOFT FAIL'
  }

  const blockCodes = new Set(policy.blockViolationCodes)
  const blockingErrors = errors.filter((entry) => blockCodes.has(entry.code))

  if (blockingErrors.length > 0) {
    return 'BLOCKED'
  }

  if (errors.some((entry) => entry.code === 'analyze_failed')) {
    return 'SOFT FAIL'
  }

  if (errors.length > 0) {
    return 'SOFT FAIL'
  }

  if (warnings.length > 0) {
    return 'WARNING'
  }

  return 'PASS'
}

