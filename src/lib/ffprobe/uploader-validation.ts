import type { FileInfo } from './types'
import { buildDimensionDiagnostics, getFieldReliability } from './diagnostics'
import { buildMetadataSources } from './metadata-sources'
import { normalizeMetadata } from './normalize-metadata'
import type {
  FileContext,
  UploaderPolicy,
  ValidationResult,
} from './types'
import { DEFAULT_UPLOADER_POLICY } from './types'
import { deriveValidationDecision } from './validation/decision'
import { runAllPreflightChecks } from './validation/run-checks'

export function evaluateUploaderValidation(
  fileInfo: FileInfo,
  context: FileContext = {},
  policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY,
  analyzeError: string | null = null,
): ValidationResult {
  const metadata = normalizeMetadata(fileInfo, context)
  const dimensionDiagnostics = buildDimensionDiagnostics(fileInfo, metadata)
  const reliability = getFieldReliability(metadata, dimensionDiagnostics)
  const metadataSources = buildMetadataSources(fileInfo, metadata, context)

  const { warnings, errors, checkGroups } = runAllPreflightChecks(
    fileInfo,
    metadata,
    dimensionDiagnostics,
    policy,
    analyzeError,
  )

  return {
    metadata,
    diagnostics: {
      dimensions: dimensionDiagnostics,
      analyzeError,
      reliableFields: reliability.reliableFields,
      unreliableFields: reliability.unreliableFields,
      fallbackFields: reliability.fallbackFields,
      metadataSources,
    },
    warnings,
    errors,
    checkGroups,
    decision: deriveValidationDecision(errors, warnings, analyzeError, policy),
  }
}

/** Backward-compatible alias */
export const evaluatePreflight = evaluateUploaderValidation
