import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileInfo } from 'ffprobe-wasm'
import {
  DEFAULT_UPLOADER_POLICY,
  type UploaderPolicy,
  type ValidationResult,
} from '../../lib/ffprobe'
import {
  buildEngineComparisonReport,
  summarizeMatrixByEngine,
  type EngineComparisonReport,
} from '../../lib/comparison'
import {
  getAllEngines,
  getEngine,
  resolveEngineSelection,
  runEnginesAnalysis,
  type AnalysisResult,
} from '../../lib/engines'
import { getWasmEnvironmentStatus } from '../../lib/browser-environment'
import { buildBundleImpactView } from '../../lib/evaluation/bundle-impact'
import {
  loadBenchSummary,
  type BenchSummary,
  BENCH_SUMMARY_FALLBACK,
} from '../../lib/evaluation/bench-summary'
import {
  checkFixturesForTestCases,
  formatFixtureMissingError,
  getFixtureUrl,
  type FixtureCheckResult,
} from '../../lib/fixtures'
import {
  buildEmptyResult,
  buildResultFromValidation,
  detectBrowser,
  evaluateExpectations,
  type CompatibilityTestResult,
  type TestCaseDefinition,
} from '../../lib/compatibility/test-results'
import {
  exportAnalysisJson,
  exportComparisonCsv,
  exportMatrixCsv,
  exportMarkdownReport,
  exportExecutiveSummary,
} from '../../lib/export/report-export'
import { getFriendlyContainerName } from '../../lib/ffprobe/recommendation'
import { productionRiskLevel } from '../../lib/evaluation/decision-comparison'

import { ViewModeToggle, type ViewMode } from './components/view-mode-toggle'
import { OverviewMode } from './components/overview-mode'
import { TechnicalMode } from './components/technical-mode'

interface TestMatrix {
  version: string
  package: string
  testCases: TestCaseDefinition[]
}

function canRunEngine(engineId: string, env: ReturnType<typeof getWasmEnvironmentStatus>): boolean {
  const engine = getEngine(engineId)
  if (!engine?.available) return false
  if (engineId === 'ffprobe-wasm') return env.canRunFfprobeWasm
  if (engineId === 'minimal-metadata-ffprobe') return env.isSecureContext
  return true
}

export function EvaluationApp() {
  const wasmEnvironment = useMemo(() => getWasmEnvironmentStatus(), [])
  const [analyzeMode, setAnalyzeMode] = useState<'single' | 'compare'>('compare')
  const [selectedEngineId, setSelectedEngineId] = useState('ffprobe-wasm')
  const [matrixEngineIds, setMatrixEngineIds] = useState<string[]>(() => getAllEngines().map((e) => e.id))
  const [policy, setPolicy] = useState<UploaderPolicy>(DEFAULT_UPLOADER_POLICY)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rawOutput, setRawOutput] = useState<FileInfo | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [engineResults, setEngineResults] = useState<AnalysisResult[]>([])
  const [comparisonReport, setComparisonReport] = useState<EngineComparisonReport | null>(null)
  const [status, setStatus] = useState('Select a video file to analyze.')
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const [matrix, setMatrix] = useState<TestMatrix | null>(null)
  const [matrixResults, setMatrixResults] = useState<CompatibilityTestResult[]>([])
  const [activeTestId, setActiveTestId] = useState<string | null>(null)
  const [testerName, setTesterName] = useState('')
  const [fixtureCheck, setFixtureCheck] = useState<FixtureCheckResult | null>(null)
  const [fixtureCheckLoading, setFixtureCheckLoading] = useState(true)
  const [includeOptionalFixtures, setIncludeOptionalFixtures] = useState(false)
  const [matrixError, setMatrixError] = useState<string | null>(null)
  const [benchSummary, setBenchSummary] = useState<BenchSummary>(BENCH_SUMMARY_FALLBACK)
  const [viewMode, setViewMode] = useState<ViewMode>('overview')
  const [primaryEngineId, setPrimaryEngineId] = useState<string | null>(null)

  useEffect(() => {
    loadBenchSummary().then(setBenchSummary)
  }, [])

  useEffect(() => {
    fetch('/compatibility/test-matrix.json')
      .then((response) => response.json())
      .then((data: TestMatrix) => setMatrix(data))
      .catch(() => setMatrix(null))
  }, [])

  useEffect(() => {
    if (!matrix) {
      setFixtureCheckLoading(false)
      return
    }

    setFixtureCheckLoading(true)
    checkFixturesForTestCases(matrix.testCases, { includeOptional: includeOptionalFixtures })
      .then(setFixtureCheck)
      .catch(() => setFixtureCheck({
        available: false,
        coreMissing: [],
        optionalMissing: [],
        checked: 0,
        error: 'Could not verify fixture availability.',
      }))
      .finally(() => setFixtureCheckLoading(false))
  }, [matrix, includeOptionalFixtures])

  const fixturesReady = fixtureCheck?.available === true
  const fixturesMissing = !fixtureCheckLoading && fixtureCheck !== null && !fixturesReady

  const bundleTechnicalDetails = useMemo(
    () =>
      buildBundleImpactView(
        analyzeMode === 'compare'
          ? getAllEngines().filter((engine) => engine.available).map((engine) => engine.id)
          : [selectedEngineId],
        analyzeMode,
      ).technicalDetails,
    [analyzeMode, selectedEngineId],
  )

  const matrixSummaries = useMemo(
    () => summarizeMatrixByEngine(matrixResults),
    [matrixResults],
  )

  const primaryEngineName = useMemo(
    () => getEngine(primaryEngineId ?? '')?.name ?? primaryEngineId ?? '—',
    [primaryEngineId],
  )

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) {
      setStatus('Choose a video file first.')
      return
    }

    if (!wasmEnvironment.canRunFfprobeWasm && !wasmEnvironment.isSecureContext) {
      setError([wasmEnvironment.issue, wasmEnvironment.recommendation].filter(Boolean).join(' '))
      setStatus('Cannot run analysis in this browser environment.')
      return
    }

    const engineIds = resolveEngineSelection(analyzeMode, [selectedEngineId])
    const runnableIds = engineIds.filter((id) => canRunEngine(id, wasmEnvironment))

    if (runnableIds.length === 0) {
      setError('No selected engines can run in this browser environment.')
      setStatus('Cannot run analysis.')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setStatus(`Analyzing with ${runnableIds.length} engine(s)…`)

    try {
      // Overview mode forces default policy parameters. Technical mode uses configurable inputs.
      const activePolicy = viewMode === 'overview' ? DEFAULT_UPLOADER_POLICY : policy
      const results = await runEnginesAnalysis(runnableIds, selectedFile, activePolicy)
      const report = buildEngineComparisonReport(selectedFile.name, results, matrixSummaries)

      setEngineResults(results)
      setComparisonReport(report)

      const primary =
        analyzeMode === 'single'
          ? results[0]
          : results.find((r) => r.engineId === 'ffprobe-wasm') ?? results.find((r) => r.success) ?? results[0]

      setRawOutput((primary?.rawOutput as FileInfo) ?? null)
      setValidation(primary?.validation ?? null)
      setPrimaryEngineId(primary?.engineId ?? null)
      setStatus(`Analysis complete — ${results.filter((r) => r.success).length}/${results.length} engine(s) succeeded`)
    } catch (analyzeError) {
      const message = analyzeError instanceof Error ? analyzeError.message : 'Unknown error'
      setError(message)
      setEngineResults([])
      setComparisonReport(null)
      setRawOutput(null)
      setValidation(null)
      setPrimaryEngineId(null)
      setStatus('Analysis failed.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [analyzeMode, matrixSummaries, policy, selectedEngineId, selectedFile, wasmEnvironment, viewMode])

  const handleRunAllTests = useCallback(async () => {
    if (!matrix) return

    if (!wasmEnvironment.canRunFfprobeWasm) {
      setMatrixError([wasmEnvironment.issue, wasmEnvironment.recommendation].filter(Boolean).join(' '))
      return
    }

    setMatrixError(null)
    const check = await checkFixturesForTestCases(matrix.testCases, {
      includeOptional: includeOptionalFixtures,
    })

    if (!check.available) {
      const message = check.error ?? formatFixtureMissingError(check.coreMissing)
      setMatrixError(message)
      setFixtureCheck(check)
      return
    }

    const engineIds = matrixEngineIds.length > 0 ? matrixEngineIds : ['ffprobe-wasm']
    const testCases = matrix.testCases.filter(
      (testCase) => includeOptionalFixtures || !testCase.optional,
    )
    const results: CompatibilityTestResult[] = []

    for (const testCase of testCases) {
      for (const engineId of engineIds) {
        setActiveTestId(`${testCase.id}:${engineId}`)
        results.push(await runMatrixTest(testCase, policy, testerName, engineId))
        setMatrixResults([...results])
      }
    }
    setActiveTestId(null)
  }, [includeOptionalFixtures, matrix, matrixEngineIds, policy, testerName, wasmEnvironment])

  const handleRunOneTest = useCallback(
    async (testCase: TestCaseDefinition, engineId = matrixEngineIds[0] ?? 'ffprobe-wasm') => {
      if (!wasmEnvironment.canRunFfprobeWasm) {
        setMatrixError([wasmEnvironment.issue, wasmEnvironment.recommendation].filter(Boolean).join(' '))
        return
      }

      setActiveTestId(`${testCase.id}:${engineId}`)
      const result = await runMatrixTest(testCase, policy, testerName, engineId)
      setMatrixResults((current) => [
        ...current.filter((entry) => !(entry.testId === testCase.id && entry.engineId === engineId)),
        result,
      ])
      setActiveTestId(null)
    },
    [matrixEngineIds, policy, testerName, wasmEnvironment],
  )

  const handleExportExecutiveSummary = useCallback(() => {
    const preferredResult = engineResults.find((r) => r.engineId === 'minimal-metadata-ffprobe') ?? engineResults.find((r) => r.success) ?? null
    const decision = preferredResult?.validation?.decision
    const friendlyContainer = preferredResult?.metadata?.containerFormat
      ? getFriendlyContainerName(preferredResult.metadata.containerFormat)
      : null
    const warnings = preferredResult?.validation?.warnings.map(w => w.message) ?? []
    const risk = productionRiskLevel(comparisonReport, engineResults)

    exportExecutiveSummary({
      tester: testerName || 'Amir',
      browser: detectBrowser(),
      fileName: selectedFile?.name,
      fileSize: selectedFile ? `${(selectedFile.size / 1_000_000).toFixed(2)} MB` : null,
      decision,
      friendlyContainer,
      warnings,
      productionRisk: risk.level,
      productionRiskExplanation: risk.explanation,
    })
  }, [engineResults, comparisonReport, selectedFile, testerName])

  const handleExportFullReport = useCallback(() => {
    exportMarkdownReport({
      browser: detectBrowser(),
      tester: testerName || 'Amir',
      bundleSummary: bundleTechnicalDetails,
      benchSummary,
      results: matrixResults,
      comparison: comparisonReport,
      engineResults,
      matrixSummaries,
    })
  }, [testerName, bundleTechnicalDetails, benchSummary, matrixResults, comparisonReport, engineResults, matrixSummaries])

  return (
    <>
      <header className="header">
        <div className="container header-content">
          <div className="logo-section">
            <div className="logo-icon">FP</div>
            <div className="logo-text">Aparat media analysis evaluation</div>
          </div>
          {/* Header tabs removed. In Overview Mode they are hidden. In Technical Mode, sub-tabs are displayed inside the main content area. */}
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {viewMode === 'overview' ? (
            <OverviewMode
              report={comparisonReport}
              results={engineResults}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              isAnalyzing={isAnalyzing}
              onAnalyze={handleAnalyze}
              wasmEnvironment={wasmEnvironment}
              onExportExecutiveSummary={handleExportExecutiveSummary}
              onExportFullReport={handleExportFullReport}
            />
          ) : (
            <TechnicalMode
              wasmEnvironment={wasmEnvironment}
              policy={policy}
              setPolicy={setPolicy}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              isAnalyzing={isAnalyzing}
              onAnalyze={handleAnalyze}
              status={status}
              error={error}
              engineResults={engineResults}
              comparisonReport={comparisonReport}
              rawOutput={rawOutput}
              validation={validation}
              primaryEngineName={primaryEngineName}
              analyzeMode={analyzeMode}
              setAnalyzeMode={setAnalyzeMode}
              selectedEngineId={selectedEngineId}
              setSelectedEngineId={setSelectedEngineId}
              matrixEngineIds={matrixEngineIds}
              setMatrixEngineIds={setMatrixEngineIds}
              matrix={matrix}
              matrixResults={matrixResults}
              matrixSummaries={matrixSummaries}
              activeTestId={activeTestId}
              testerName={testerName}
              setTesterName={setTesterName}
              fixtureCheck={fixtureCheck}
              fixtureCheckLoading={fixtureCheckLoading}
              includeOptionalFixtures={includeOptionalFixtures}
              setIncludeOptionalFixtures={setIncludeOptionalFixtures}
              matrixError={matrixError}
              fixturesReady={fixturesReady}
              fixturesMissing={fixturesMissing}
              handleRunAllTests={handleRunAllTests}
              handleRunOneTest={handleRunOneTest}
              onExportJson={() => exportAnalysisJson({ engineResults, comparisonReport, validation, policy, benchSummary })}
              onExportComparisonCsv={() => comparisonReport && exportComparisonCsv({ fileName: selectedFile?.name ?? 'file', comparison: comparisonReport })}
              onExportMatrixCsv={() => exportMatrixCsv(matrixResults)}
              onExportFullReport={handleExportFullReport}
            />
          )}
        </div>
      </main>
    </>
  )
}

async function runMatrixTest(
  testCase: TestCaseDefinition,
  policy: UploaderPolicy,
  testerName: string,
  engineId: string,
): Promise<CompatibilityTestResult> {
  const fixtureUrl = getFixtureUrl(testCase.fixtureFile)
  const engine = getAllEngines().find((e) => e.id === engineId)
  const engineName = engine?.name ?? engineId

  try {
    const probe = await fetch(fixtureUrl, { method: 'HEAD', cache: 'no-store' })
    if (!probe.ok) {
      const getProbe = await fetch(fixtureUrl, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
      if (!getProbe.ok && getProbe.status !== 206) {
        throw new Error(formatFixtureMissingError([testCase.fixtureFile]))
      }
    }

    const response = await fetch(fixtureUrl)
    if (!response.ok) throw new Error(`Fixture not found: ${fixtureUrl}`)

    const blob = await response.blob()
    const fileName = testCase.fixtureFile.split('/').pop() ?? testCase.fixtureFile
    const file = new File([blob], fileName, { type: blob.type || 'video/mp4' })

    const startedAt = performance.now()
    const analysis = await runEnginesAnalysis([engineId], file, policy)
    const processingTimeMs = performance.now() - startedAt
    const result = analysis[0]

    if (!result?.validation) {
      throw new Error(result?.error ?? 'No validation result')
    }

    const notes = evaluateExpectations(testCase, result.validation.metadata, result.success).join('; ')

    return {
      ...buildResultFromValidation(
        testCase,
        result.validation,
        processingTimeMs,
        result.success,
        result.error ?? '',
        notes,
        engineId,
        engineName,
      ),
      tester: testerName,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      ...buildEmptyResult(testCase, testCase.browserNotes, engineId, engineName),
      analyzeSuccess: false,
      analyzeError: message,
      decision: 'soft_fail',
      tester: testerName,
      notes: testCase.expected.analyzeSuccess === false ? 'Expected failure' : message,
    }
  }
}
