import type { FileInfo } from '../types'
import type { DimensionDiagnostics, NormalizedMetadata, UploaderPolicy, ValidationCheckGroup, ValidationIssue } from '../types'
import { validationRules, type RuleContext } from '../../../config/validationRules'

function groupIssues(id: string, label: string, issues: ValidationIssue[]): ValidationCheckGroup {
  return { id, label, issues }
}

export function runAllPreflightChecks(
  fileInfo: FileInfo,
  metadata: NormalizedMetadata,
  dimensionDiagnostics: DimensionDiagnostics,
  policy: UploaderPolicy,
  analyzeError: string | null,
): {
  warnings: ValidationIssue[]
  errors: ValidationIssue[]
  checkGroups: ValidationCheckGroup[]
} {
  const ctx: RuleContext = {
    fileInfo,
    metadata,
    policy,
    dimensionDiagnostics,
    analyzeError,
  }

  const issues = validationRules.map((rule) => {
    const message = rule.condition(ctx)
    if (!message) return null
    return {
      code: rule.id,
      message,
      severity: rule.severity,
      group: rule.group,
    } as ValidationIssue & { group: string }
  }).filter((x): x is ValidationIssue & { group: string } => x !== null)

  const groupLabels: Record<string, string> = {
    container: 'Container / file',
    audio: 'Audio',
    video: 'Video stream',
    resolution: 'Resolution / dimensions',
    fps: 'FPS',
    duration: 'Duration',
    bitrate: 'Bitrate / size',
  }

  const checkGroups: ValidationCheckGroup[] = Object.entries(groupLabels).map(([id, label]) => {
    return groupIssues(id, label, issues.filter((i) => i.group === id))
  })

  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')

  // Dedupe by code — first occurrence wins
  const dedupe = (items: ValidationIssue[]) => {
    const seen = new Set<string>()
    return items.filter((item) => {
      if (seen.has(item.code)) return false
      seen.add(item.code)
      return true
    })
  }

  return {
    errors: dedupe(errors),
    warnings: dedupe(warnings),
    checkGroups,
  }
}
