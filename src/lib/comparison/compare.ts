import type { AnalysisResult } from '../engines/types'
import { getAllEngines, getEngine } from '../engines/registry'
import {
  COMPARISON_FIELDS,
  formatComparisonValue,
  getMetadataFieldValue,
  valuesMatch,
} from './fields'
import type {
  EngineBenchmarkRow,
  EngineComparisonRecommendation,
  EngineComparisonReport,
  EngineReliabilityScore,
  FieldComparisonCell,
  FieldComparisonRow,
  FieldDiffStatus,
  MatrixEngineSummary,
} from './types'
import type { CompatibilityTestResult } from '../compatibility/test-results'

const RELIABILITY_FIELD_KEYS = [
  'containerFormat',
  'videoCodec',
  'audioCodec',
  'width',
  'height',
  'fps',
  'bitrateBps',
  'durationSeconds',
  'hasVideo',
  'hasAudio',
  'pixelFormat',
]

function buildFieldCells(
  results: AnalysisResult[],
  fieldKey: string,
  format: (raw: unknown) => string,
): FieldComparisonCell[] {
  return results.map((result) => {
    const rawValue = getMetadataFieldValue(result.metadata, fieldKey)
    const present = result.success && rawValue !== null && rawValue !== undefined && rawValue !== ''
    return {
      engineId: result.engineId,
      engineName: result.engineName,
      value: result.success ? format(rawValue) : '—',
      rawValue,
      present,
      engineSuccess: result.success,
    }
  })
}

function resolveRowStatus(cells: FieldComparisonCell[], tolerance?: number): FieldDiffStatus {
  if (cells.every((cell) => !cell.engineSuccess)) return 'engine_failed'

  const successful = cells.filter((cell) => cell.engineSuccess && getEngine(cell.engineId)?.available)
  if (successful.length === 0) return 'engine_failed'

  const present = successful.filter((cell) => cell.present)
  if (present.length === 0) return 'both_missing'

  if (present.length === 1) {
    const engineId = present[0].engineId
    if (engineId === 'ffprobe-wasm') return 'only_current'
    if (engineId === 'minimal-metadata-ffprobe') return 'only_minimal'
    return 'missing'
  }

  const reference = present[0].rawValue
  const referenceFormatted = present[0].value
  const allMatch = present.every(
    (cell) => valuesMatch(cell.rawValue, reference, tolerance) || cell.value === referenceFormatted
  )
  if (!allMatch) return 'mismatch'

  if (present.length < successful.length) return 'missing'

  return 'match'
}

export function buildFieldComparisonRows(results: AnalysisResult[]): FieldComparisonRow[] {
  return COMPARISON_FIELDS.map((field) => {
    const cells = buildFieldCells(results, field.key, (raw) => formatComparisonValue(field, raw))
    return {
      key: field.key,
      label: field.label,
      status: resolveRowStatus(cells, field.tolerance),
      cells,
    }
  })
}

export function buildBenchmarkRows(results: AnalysisResult[]): EngineBenchmarkRow[] {
  return results.map((result) => ({
    engineId: result.engineId,
    engineName: result.engineName,
    available: getEngine(result.engineId)?.available ?? false,
    success: result.success,
    importMs: result.timings.importMs,
    initMs: result.timings.initMs,
    analyzeMs: result.timings.analyzeMs,
    totalMs: result.timings.totalMs,
  }))
}

export function calculateReliabilityScore(result: AnalysisResult): EngineReliabilityScore {
  const engine = getEngine(result.engineId)
  const details: string[] = []
  let fieldsDetected = 0
  let fieldsMissing = 0

  if (!engine?.available) {
    return {
      engineId: result.engineId,
      engineName: result.engineName,
      available: false,
      success: false,
      scorePercent: 0,
      fieldsDetected: 0,
      fieldsMissing: RELIABILITY_FIELD_KEYS.length,
      fieldsTotal: RELIABILITY_FIELD_KEYS.length,
      analyzeFailures: 1,
      unsupportedFormats: 0,
      details: ['Engine not yet available'],
    }
  }

  if (!result.success) {
    return {
      engineId: result.engineId,
      engineName: result.engineName,
      available: true,
      success: false,
      scorePercent: 0,
      fieldsDetected: 0,
      fieldsMissing: RELIABILITY_FIELD_KEYS.length,
      fieldsTotal: RELIABILITY_FIELD_KEYS.length,
      analyzeFailures: 1,
      unsupportedFormats: 0,
      details: [result.error ?? 'Analyze failed'],
    }
  }

  for (const key of RELIABILITY_FIELD_KEYS) {
    const value = getMetadataFieldValue(result.metadata, key)
    const present = value !== null && value !== undefined && value !== ''
    if (present) {
      fieldsDetected += 1
    } else {
      fieldsMissing += 1
      details.push(`Missing: ${key}`)
    }
  }

  const unsupportedFormats = result.validation?.warnings.filter((w) =>
    ['unsupported_container', 'analyze_failed'].includes(w.code),
  ).length ?? 0

  const scorePercent = Math.round((fieldsDetected / RELIABILITY_FIELD_KEYS.length) * 100)

  return {
    engineId: result.engineId,
    engineName: result.engineName,
    available: true,
    success: true,
    scorePercent,
    fieldsDetected,
    fieldsMissing,
    fieldsTotal: RELIABILITY_FIELD_KEYS.length,
    analyzeFailures: 0,
    unsupportedFormats,
    details,
  }
}

export function buildEngineRecommendation(
  results: AnalysisResult[],
  reliabilityScores: EngineReliabilityScore[],
  matrixSummaries: MatrixEngineSummary[] = [],
): EngineComparisonRecommendation {
  const availableScores = reliabilityScores.filter((s) => getEngine(s.engineId)?.available)

  if (availableScores.length === 0) {
    return {
      preferredEngineId: null,
      preferredEngineName: null,
      summary: 'No engines are fully available yet. ffprobe-wasm remains the only active option.',
      reasons: ['Internal engine adapter pending integration'],
      confidence: 'low',
    }
  }

  if (availableScores.length === 1) {
    const only = availableScores[0]
    return {
      preferredEngineId: only.engineId,
      preferredEngineName: only.engineName,
      summary: `${only.engineName} is the only available engine (${only.scorePercent}% reliability on this file).`,
      reasons: ['No alternative engine available for comparison yet'],
      confidence: 'medium',
    }
  }

  const minimal = availableScores.find((s) => s.engineId === 'minimal-metadata-ffprobe')
  const npm = availableScores.find((s) => s.engineId === 'ffprobe-wasm')
  const minimalResult = results.find((r) => r.engineId === 'minimal-metadata-ffprobe')
  const npmResult = results.find((r) => r.engineId === 'ffprobe-wasm')

  if (minimal && npm) {
    if (!minimalResult?.success && npmResult?.success) {
      return {
        preferredEngineId: 'ffprobe-wasm',
        preferredEngineName: 'ffprobe-wasm',
        summary:
          'Use npm ffprobe-wasm for this file — minimal-metadata failed to analyze. Do not prefer a failing engine.',
        reasons: [
          minimalResult?.error ?? 'minimal-metadata analyze failed on this file',
          `Reliability on this file: npm ${npm.scorePercent}% vs minimal 0%`,
          'Verify /engines/minimal-metadata/ffprobe.wasm is deployed if minimal should run',
        ],
        confidence: 'high',
      }
    }

    if (!npmResult?.success && minimalResult?.success) {
      return {
        preferredEngineId: 'minimal-metadata-ffprobe',
        preferredEngineName: 'minimal-metadata-ffprobe',
        summary:
          'minimal-metadata succeeded on this file; npm ffprobe-wasm failed (often COOP/COEP or SharedArrayBuffer).',
        reasons: [
          npmResult?.error ?? 'npm ffprobe-wasm analyze failed',
          `Reliability on this file: minimal ${minimal.scorePercent}% vs npm 0%`,
          'Smaller payload and no cross-origin isolation required for minimal',
        ],
        confidence: 'high',
      }
    }

    if (!minimalResult?.success && !npmResult?.success) {
      return {
        preferredEngineId: null,
        preferredEngineName: null,
        summary:
          'No browser engine succeeded on this file. Use backend/Akuma as source of truth — do not block upload on browser failure alone.',
        reasons: [
          minimalResult?.error ?? 'minimal-metadata failed',
          npmResult?.error ?? 'npm ffprobe-wasm failed',
        ],
        confidence: 'low',
      }
    }

    if (npm.scorePercent > minimal.scorePercent + 15) {
      return {
        preferredEngineId: 'ffprobe-wasm',
        preferredEngineName: 'ffprobe-wasm',
        summary:
          'npm ffprobe-wasm is more reliable on this file. Consider minimal-metadata only after parity improves.',
        reasons: [
          `Reliability on this file: npm ${npm.scorePercent}% vs minimal ${minimal.scorePercent}%`,
          'npm detects more fields (pixelFormat, profile, level)',
          'Trade-off: npm lazy chunk ~2.9 MiB gzip and requires COOP/COEP',
        ],
        confidence: matrixSummaries.length > 0 ? 'high' : 'medium',
      }
    }

    if (minimal.scorePercent >= npm.scorePercent - 10) {
      return {
        preferredEngineId: 'minimal-metadata-ffprobe',
        preferredEngineName: 'minimal-metadata-ffprobe',
        summary:
          'Prefer minimal-metadata for upload preflight when core metadata parity holds: smaller payload, no COOP/COEP.',
        reasons: [
          `Reliability on this file: minimal ${minimal.scorePercent}% vs npm ${npm.scorePercent}%`,
          'Bundle: ~1.1 MiB brotli vs ~2.9 MiB npm lazy chunk',
          'Runtime: no SharedArrayBuffer / pthreads required',
          'Caveat: pixelFormat, videoProfile, videoLevel may be absent without decoders',
        ],
        confidence: matrixSummaries.length > 0 ? 'high' : 'medium',
      }
    }

    return {
      preferredEngineId: 'ffprobe-wasm',
      preferredEngineName: 'ffprobe-wasm',
      summary: 'npm ffprobe-wasm leads on metadata coverage for this file.',
      reasons: [
        `Reliability on this file: npm ${npm.scorePercent}% vs minimal ${minimal.scorePercent}%`,
        'Use minimal-metadata after field parity improves or for COOP-free deployments',
      ],
      confidence: 'medium',
    }
  }

  const ranked = [...availableScores].sort((a, b) => {
    const matrixA = matrixSummaries.find((m) => m.engineId === a.engineId)?.successRatePercent ?? a.scorePercent
    const matrixB = matrixSummaries.find((m) => m.engineId === b.engineId)?.successRatePercent ?? b.scorePercent
    if (matrixB !== matrixA) return matrixB - matrixA
    if (b.scorePercent !== a.scorePercent) return b.scorePercent - a.scorePercent
    const benchA = results.find((r) => r.engineId === a.engineId)?.timings.totalMs ?? Infinity
    const benchB = results.find((r) => r.engineId === b.engineId)?.timings.totalMs ?? Infinity
    return benchA - benchB
  })

  const winner = ranked[0]
  const runnerUp = ranked[1]

  const reasons: string[] = [
    `Reliability score: ${winner.scorePercent}% vs ${runnerUp.scorePercent}%`,
  ]

  const matrixWinner = matrixSummaries.find((m) => m.engineId === winner.engineId)
  const matrixRunner = matrixSummaries.find((m) => m.engineId === runnerUp.engineId)
  if (matrixWinner && matrixRunner) {
    reasons.push(
      `Matrix success rate: ${matrixWinner.successRatePercent}% vs ${matrixRunner.successRatePercent}%`,
    )
  }

  const winnerBench = results.find((r) => r.engineId === winner.engineId)?.timings.totalMs
  const runnerBench = results.find((r) => r.engineId === runnerUp.engineId)?.timings.totalMs
  if (winnerBench != null && runnerBench != null) {
    reasons.push(`Total time: ${winnerBench.toFixed(1)}ms vs ${runnerBench.toFixed(1)}ms`)
  }

  const summary =
    winner.scorePercent > runnerUp.scorePercent + 5
      ? `${winner.engineName} is preferred for production metadata extraction.`
      : winner.scorePercent === runnerUp.scorePercent
        ? `Engines are comparable on this file — run the full matrix before deciding.`
        : `${winner.engineName} leads slightly; validate with the full sample matrix.`

  return {
    preferredEngineId: winner.engineId,
    preferredEngineName: winner.engineName,
    summary,
    reasons,
    confidence: matrixSummaries.length > 0 ? 'high' : 'medium',
  }
}

export function buildEngineComparisonReport(
  fileName: string,
  results: AnalysisResult[],
  matrixSummaries: MatrixEngineSummary[] = [],
): EngineComparisonReport {
  const fieldRows = buildFieldComparisonRows(results)
  const reliabilityScores = results.map(calculateReliabilityScore)
  const benchmarks = buildBenchmarkRows(results)

  return {
    fileName,
    engineIds: results.map((r) => r.engineId),
    fieldRows,
    benchmarks,
    reliabilityScores,
    mismatchCount: fieldRows.filter((r) => r.status === 'mismatch').length,
    missingCount: fieldRows.filter((r) => r.status === 'missing').length,
    recommendation: buildEngineRecommendation(results, reliabilityScores, matrixSummaries),
  }
}

export function summarizeMatrixByEngine(
  results: Array<CompatibilityTestResult & { engineId?: string }>,
): MatrixEngineSummary[] {
  const engines = getAllEngines()
  return engines.map((engine) => {
    const engineResults = results.filter((r) => (r.engineId ?? 'ffprobe-wasm') === engine.id)
    const total = engineResults.length
    const success = engineResults.filter((r) => r.analyzeSuccess).length
    return {
      engineId: engine.id,
      engineName: engine.name,
      total,
      success,
      successRatePercent: total > 0 ? Math.round((success / total) * 100) : 0,
    }
  })
}

export function diffStatusBadgeClass(status: FieldDiffStatus): string {
  switch (status) {
    case 'match':
      return 'badge-success'
    case 'mismatch':
      return 'badge-error'
    case 'only_current':
    case 'only_minimal':
      return 'badge-info'
    case 'both_missing':
    case 'missing':
      return 'badge-warning'
    case 'unsupported':
      return 'badge-diagnostic'
    case 'engine_failed':
      return 'badge-error'
    default:
      return 'badge-info'
  }
}

export function diffStatusLabel(status: FieldDiffStatus): string {
  switch (status) {
    case 'match':
      return 'match'
    case 'mismatch':
      return 'mismatch'
    case 'only_current':
      return 'only current'
    case 'only_minimal':
      return 'only minimal'
    case 'both_missing':
      return 'missing from both'
    case 'missing':
      return 'missing'
    case 'unsupported':
      return 'unsupported'
    case 'engine_failed':
      return 'failed'
    default:
      return status
  }
}
