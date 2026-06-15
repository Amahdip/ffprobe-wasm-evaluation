import type { EngineComparisonReport } from '../comparison/types'
import type { AnalysisResult } from '../engines/types'
import { getAllEngines } from '../engines/registry'

export interface DecisionComparisonRow {
  id: string
  label: string
  values: Record<string, string>
}

export function buildDecisionComparisonRows(
  report: EngineComparisonReport | null,
): DecisionComparisonRow[] {
  const engineIds = getAllEngines().filter(e => e.available).map((e) => e.id)

  const row = (id: string, label: string, values: Record<string, string>): DecisionComparisonRow => ({
    id,
    label,
    values,
  })

  const getMissingCount = (id: string) => {
    const score = report?.reliabilityScores.find((s) => s.engineId === id)
    if (!score || !score.success) return -1
    return score.fieldsMissing
  }

  const corePreflightValues = Object.fromEntries(
    engineIds.map((id) => {
      const missing = getMissingCount(id)
      if (missing === -1) return [id, 'Failed / Pending']
      if (missing === 0) return [id, '100%']
      return [id, '90% (core only)']
    }),
  )

  const advancedInfoValues = Object.fromEntries(
    engineIds.map((id) => {
      if (id === 'minimal-metadata-ffprobe') return [id, 'Minimal']
      return [id, 'Full']
    })
  )

  const deepStreamValues = Object.fromEntries(
    engineIds.map((id) => {
      if (id === 'minimal-metadata-ffprobe') return [id, 'No']
      return [id, 'Yes']
    })
  )

  const bundleImpactValues = Object.fromEntries(
    engineIds.map((id) => {
      if (id === 'minimal-metadata-ffprobe') return [id, '~510 KB']
      return [id, '~2.9 MB (COOP/COEP req)']
    })
  )

  const productionRiskValues = Object.fromEntries(
    engineIds.map((id) => {
      if (id === 'minimal-metadata-ffprobe') return [id, 'Low (Pre-upload)']
      return [id, 'Medium (Complex env requirements)']
    })
  )

  return [
    row('core', 'Core Preflight', corePreflightValues),
    row('advanced', 'Advanced Media Info', advancedInfoValues),
    row('deep', 'Deep Stream Analysis', deepStreamValues),
    row('bundle', 'Bundle Impact', bundleImpactValues),
    row('risk', 'Production Risk', productionRiskValues),
  ]
}

export function productionRiskLevel(
  report: EngineComparisonReport | null,
  results: AnalysisResult[],
): { level: 'low' | 'medium' | 'high'; explanation: string } {
  if (!report) {
    return { level: 'medium', explanation: 'Run an analysis to assess production risk.' }
  }

  const rec = report.recommendation
  const anySuccess = results.some((r) => r.success)

  if (!anySuccess) {
    return {
      level: 'high',
      explanation: 'No browser engine succeeded — rely on backend validation only.',
    }
  }

  if (!rec.preferredEngineId || rec.confidence === 'low') {
    return {
      level: 'high',
      explanation: 'Engines disagree or failed — do not use browser-only blocking.',
    }
  }

  if (report.mismatchCount > 3 || rec.confidence === 'medium') {
    return {
      level: 'medium',
      explanation: 'Some metadata gaps or mismatches — use as warning layer only.',
    }
  }

  return {
    level: 'low',
    explanation: 'Core metadata aligned — suitable as pre-upload warning layer.',
  }
}
