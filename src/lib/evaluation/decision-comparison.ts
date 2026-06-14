import type { EngineComparisonReport } from '../comparison/types'
import type { AnalysisResult } from '../engines/types'
import { getAllEngines, getEngine } from '../engines/registry'
import { ENGINE_BUNDLE_PROFILES } from './bundle-impact'

export interface DecisionComparisonRow {
  id: string
  label: string
  values: Record<string, string>
}

function fieldValue(report: EngineComparisonReport | null, key: string, engineId: string): string {
  if (!report) return '—'
  const row = report.fieldRows.find((r) => r.key === key)
  const cell = row?.cells.find((c) => c.engineId === engineId)
  if (!cell) return '—'
  if (!cell.engineSuccess) return 'Failed'
  return cell.value
}

function engineSuccess(results: AnalysisResult[], engineId: string): boolean {
  return results.find((r) => r.engineId === engineId)?.success ?? false
}

export function buildDecisionComparisonRows(
  report: EngineComparisonReport | null,
  results: AnalysisResult[],
): DecisionComparisonRow[] {
  const engineIds = getAllEngines().map((e) => e.id)

  const row = (id: string, label: string, values: Record<string, string>): DecisionComparisonRow => ({
    id,
    label,
    values,
  })

  const payloadValues = Object.fromEntries(
    engineIds.map((id) => {
      const profile = ENGINE_BUNDLE_PROFILES[id]
      if (!profile) return [id, getEngine(id)?.capabilities.bundleImpactBrotli ?? '—']
      return [id, profile.lazyChunkBrotli]
    }),
  )

  const coopValues = Object.fromEntries(
    engineIds.map((id) => {
      const required = ENGINE_BUNDLE_PROFILES[id]?.coopCoepRequired ?? false
      return [id, required ? 'Yes' : 'No']
    }),
  )

  const pick = (key: string) =>
    Object.fromEntries(engineIds.map((id) => [id, fieldValue(report, key, id)]))

  const corruptValues = Object.fromEntries(
    engineIds.map((id) => {
      const result = results.find((r) => r.engineId === id)
      if (!result) return [id, '—']
      if (!result.success) return [id, 'Failed']
      const code = result.validation?.decision
      return [id, code === 'block' ? 'Blocks' : code === 'soft_fail' ? 'Soft fail' : 'Handled']
    }),
  )

  const missingValues = Object.fromEntries(
    engineIds.map((id) => {
      const score = report?.reliabilityScores.find((s) => s.engineId === id)
      if (!score) return [id, '—']
      if (!score.success) return [id, 'Analyze failed']
      return [id, score.fieldsMissing === 0 ? 'None' : `${score.fieldsMissing} field(s)`]
    }),
  )

  const analyzeValues = Object.fromEntries(
    engineIds.map((id) => [id, engineSuccess(results, id) ? 'OK' : 'Failed']),
  )

  return [
    row('payload', 'Payload size (brotli)', payloadValues),
    row('coop', 'Requires COOP/COEP', coopValues),
    row('analyze', 'Analyze on current file', analyzeValues),
    row('codec', 'Codec detection', pick('videoCodec')),
    row('timing', 'Duration / FPS / bitrate', {
      ...Object.fromEntries(
        engineIds.map((id) => {
          const dur = fieldValue(report, 'durationSeconds', id)
          const fps = fieldValue(report, 'fps', id)
          const br = fieldValue(report, 'bitrateBps', id)
          if (dur === '—' && fps === '—' && br === '—') return [id, '—']
          return [id, `${dur} · ${fps} fps · ${br}`]
        }),
      ),
    }),
    row('resolution', 'Resolution', {
      ...Object.fromEntries(
        engineIds.map((id) => {
          const w = fieldValue(report, 'width', id)
          const h = fieldValue(report, 'height', id)
          if (w === '—' && h === '—') return [id, '—']
          return [id, `${w}×${h}`]
        }),
      ),
    }),
    row('av', 'Audio / video detection', {
      ...Object.fromEntries(
        engineIds.map((id) => {
          const v = fieldValue(report, 'hasVideo', id)
          const a = fieldValue(report, 'hasAudio', id)
          return [id, `video ${v} · audio ${a}`]
        }),
      ),
    }),
    row('corrupt', 'Corrupt file handling', corruptValues),
    row('missing', 'Missing core fields', missingValues),
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
