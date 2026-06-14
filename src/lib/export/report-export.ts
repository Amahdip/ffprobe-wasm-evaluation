import type { ValidationResult } from '../ffprobe/types'
import type { CompatibilityTestResult } from '../compatibility/test-results'
import type { AnalysisResult } from '../engines/types'
import type { EngineComparisonReport, MatrixEngineSummary } from '../comparison/types'
import { buildRecommendationFromValidation } from '../ffprobe/recommendation'
import { getAllEngines } from '../engines/registry'

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportAnalysisJson(payload: unknown, prefix = 'engine-comparison') {
  downloadTextFile(
    `${prefix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  )
}

export function exportComparisonCsv(payload: {
  fileName: string
  comparison: EngineComparisonReport
}) {
  const headers = ['field', 'status', ...payload.comparison.engineIds]
  const rows = payload.comparison.fieldRows.map((row) => [
    row.label,
    row.status,
    ...row.cells.map((cell) => cell.value),
  ])

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  downloadTextFile(
    `engine-comparison-${payload.fileName}-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    'text/csv',
  )
}

export function exportSingleAnalysisCsv(payload: {
  fileName: string
  engineId: string
  validation: ValidationResult
  timings: { importMs: number; analyzeMs: number; totalMs: number } | null
}) {
  const row = {
    fileName: payload.fileName,
    engineId: payload.engineId,
    decision: payload.validation.decision,
    container: payload.validation.metadata.containerFormat ?? '',
    videoCodec: payload.validation.metadata.videoCodec ?? '',
    audioCodec: payload.validation.metadata.audioCodec ?? '',
    width: payload.validation.metadata.width ?? '',
    height: payload.validation.metadata.height ?? '',
    duration: payload.validation.metadata.durationSeconds ?? '',
    fps: payload.validation.metadata.fps ?? '',
    warnings: payload.validation.warnings.map((issue) => issue.code).join('; '),
    errors: payload.validation.errors.map((issue) => issue.code).join('; '),
    importMs: payload.timings?.importMs ?? '',
    analyzeMs: payload.timings?.analyzeMs ?? '',
    totalMs: payload.timings?.totalMs ?? '',
  }

  const headers = Object.keys(row)
  const values = headers.map((header) => {
    const value = String(row[header as keyof typeof row])
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  })

  downloadTextFile(
    `analysis-${payload.engineId}-${new Date().toISOString().slice(0, 10)}.csv`,
    `${headers.join(',')}\n${values.join(',')}`,
    'text/csv',
  )
}

export function exportMatrixCsv(results: CompatibilityTestResult[]) {
  if (results.length === 0) return

  const headers = Object.keys(results[0])
  const rows = results.map((result) =>
    headers
      .map((header) => {
        const value = String(result[header as keyof CompatibilityTestResult] ?? '')
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
      })
      .join(','),
  )

  downloadTextFile(
    `engine-matrix-${new Date().toISOString().slice(0, 10)}.csv`,
    [headers.join(','), ...rows].join('\n'),
    'text/csv',
  )
}

export function exportMarkdownReport(options: {
  browser: string
  tester: string
  bundleSummary: string
  results: CompatibilityTestResult[]
  comparison: EngineComparisonReport | null
  engineResults: AnalysisResult[]
  matrixSummaries: MatrixEngineSummary[]
}) {
  const latestValidation = options.engineResults.find((r) => r.success)?.validation ?? null
  const recommendation = buildRecommendationFromValidation(latestValidation)

  const enginePassTable = options.matrixSummaries
    .map(
      (s) =>
        `| ${s.engineName} | ${s.total > 0 ? `${s.successRatePercent}% (${s.success}/${s.total})` : '—'} |`,
    )
    .join('\n')

  const benchmarkTable = options.comparison?.benchmarks
    .map(
      (b) =>
        `| ${b.engineName} | ${b.success ? 'ok' : 'fail'} | ${b.importMs.toFixed(1)} | ${b.initMs.toFixed(1)} | ${b.analyzeMs.toFixed(1)} | ${b.totalMs.toFixed(1)} |`,
    )
    .join('\n') ?? ''

  const comparisonTable = options.comparison?.fieldRows
    .map((row) => {
      const values = row.cells.map((c) => c.value).join(' | ')
      return `| ${row.label} | ${row.status} | ${values} |`
    })
    .join('\n') ?? ''

  const reliabilityTable = options.comparison?.reliabilityScores
    .map((s) => `| ${s.engineName} | ${s.scorePercent}% | ${s.fieldsDetected}/${s.fieldsTotal} | ${s.analyzeFailures} |`)
    .join('\n') ?? ''

  const engines = getAllEngines()
  const supportedFormats = engines
    .map((e) => `- **${e.name}**: ${e.capabilities.supportedContainers?.join(', ') ?? '—'}`)
    .join('\n')
  const unsupportedFormats = engines
    .map((e) => `- **${e.name}**: ${e.capabilities.knownUnsupportedContainers?.join(', ') ?? '—'}`)
    .join('\n')

  const engineRec = options.comparison?.recommendation

  const markdown = `# Media analysis engine comparison report

## Metadata
- Date: ${new Date().toISOString()}
- Tester: ${options.tester || 'unknown'}
- Browser: ${options.browser}
- File: ${options.comparison?.fileName ?? '—'}

## Engine pass rate (test matrix)
| Engine | Success rate |
| --- | --- |
${enginePassTable || '| — | — |'}

## Bundle impact
${options.bundleSummary}

## Supported formats
${supportedFormats}

## Unsupported / known failures
${unsupportedFormats}

## Side-by-side metadata (${options.comparison?.fileName ?? 'latest file'})
| Field | Status | ${options.comparison?.fieldRows[0]?.cells.map((c) => c.engineName).join(' | ') ?? 'Engines'} |
| --- | --- | ${options.comparison?.fieldRows[0]?.cells.map(() => '---').join(' | ') ?? '---'} |
${comparisonTable || '| — | — | — |'}

## Benchmark (latest file)
| Engine | Status | Import ms | Init ms | Analyze ms | Total ms |
| --- | --- | --- | --- | --- | --- |
${benchmarkTable || '| — | — | — | — | — | — |'}

## Reliability scores (latest file)
| Engine | Score | Fields | Failures |
| --- | --- | --- | --- |
${reliabilityTable || '| — | — | — | — |'}

## Preflight recommendation (ffprobe-wasm policy layer)
**${recommendation.recommendationLabel}**

${recommendation.reason}

## Engine recommendation
${engineRec ? `**${engineRec.preferredEngineName ?? 'Undecided'}** — ${engineRec.summary}

${engineRec.reasons.map((r) => `- ${r}`).join('\n')}` : 'Run compare mode on a file to generate engine recommendation.'}

## Matrix results
- Total rows: ${options.results.length}
- Engines tested: ${[...new Set(options.results.map((r) => r.engineId))].join(', ') || 'ffprobe-wasm'}
`

  downloadTextFile(
    `engine-comparison-report-${new Date().toISOString().slice(0, 10)}.md`,
    markdown,
    'text/markdown',
  )
}
