import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileInfo } from 'ffprobe-wasm'
import {
  buildRecommendationFromValidation,
  decisionBadgeClass,
  DEFAULT_UPLOADER_POLICY,
  recommendationBadgeClass,
  type UploaderPolicy,
  type ValidationCheckGroup,
  type ValidationDecision,
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
import { BUNDLE_IMPACT, BUNDLE_TECHNICAL_DETAILS } from '../../lib/evaluation/bundle-impact'
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
  exportSingleAnalysisCsv,
} from '../../lib/export/report-export'
import { BenchmarkDashboard } from './components/benchmark-dashboard'
import { BenchSummaryCard } from './components/bench-summary-card'
import { CompareTable } from './components/compare-table'
import { EngineScorecards } from './components/engine-scorecards'
import { EngineSelector, type AnalyzeMode } from './components/engine-selector'
import { SizeComparisonCard } from './components/size-comparison-card'

interface TestMatrix {
  version: string
  package: string
  testCases: TestCaseDefinition[]
}

type TabId = 'analyze' | 'matrix'

function canRunEngine(engineId: string, env: ReturnType<typeof getWasmEnvironmentStatus>): boolean {
  const engine = getEngine(engineId)
  if (!engine?.available) return false
  if (engineId === 'ffprobe-wasm') return env.canRunFfprobeWasm
  if (engineId === 'minimal-metadata-ffprobe') return env.isSecureContext
  return true
}

export function EvaluationApp() {
  const wasmEnvironment = useMemo(() => getWasmEnvironmentStatus(), [])
  const [tab, setTab] = useState<TabId>('analyze')
  const [analyzeMode, setAnalyzeMode] = useState<AnalyzeMode>('compare')
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

  const recommendation = useMemo(
    () => buildRecommendationFromValidation(validation),
    [validation],
  )

  const matrixSummary = useMemo(() => {
    const total = matrixResults.length
    const success = matrixResults.filter((result) => result.analyzeSuccess).length
    const failed = total - success
    const unsupported = matrixResults.filter((result) =>
      ['TC-FMT-005', 'TC-FMT-006'].includes(result.testId),
    )
    const dimensionLimited = matrixResults.filter(
      (result) => result.dimensionConclusion === 'ffprobe_wasm_limitation',
    ).length

    return { total, success, failed, unsupported, dimensionLimited }
  }, [matrixResults])

  const matrixSummaries = useMemo(
    () => summarizeMatrixByEngine(matrixResults),
    [matrixResults],
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
      const results = await runEnginesAnalysis(runnableIds, selectedFile, policy)
      const report = buildEngineComparisonReport(selectedFile.name, results, matrixSummaries)

      setEngineResults(results)
      setComparisonReport(report)

      const primary =
        analyzeMode === 'single'
          ? results[0]
          : results.find((r) => r.engineId === 'ffprobe-wasm') ?? results.find((r) => r.success) ?? results[0]

      setRawOutput((primary?.rawOutput as FileInfo) ?? null)
      setValidation(primary?.validation ?? null)
      setStatus(`Analysis complete — ${results.filter((r) => r.success).length}/${results.length} engine(s) succeeded`)
    } catch (analyzeError) {
      const message = analyzeError instanceof Error ? analyzeError.message : 'Unknown error'
      setError(message)
      setEngineResults([])
      setComparisonReport(null)
      setRawOutput(null)
      setValidation(null)
      setStatus('Analysis failed.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [analyzeMode, matrixSummaries, policy, selectedEngineId, selectedFile, wasmEnvironment])

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

  return (
    <>
      <header className="header">
        <div className="container header-content">
          <div className="logo-section">
            <div className="logo-icon">FP</div>
            <div className="logo-text">Aparat media analysis evaluation</div>
          </div>
          <nav className="nav-tabs">
            <button type="button" className={`tab-btn ${tab === 'analyze' ? 'active' : ''}`} onClick={() => setTab('analyze')}>
              Analyze
            </button>
            <button type="button" className={`tab-btn ${tab === 'matrix' ? 'active' : ''}`} onClick={() => setTab('matrix')}>
              Test matrix
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <h1 className="section-title">Media analysis engine evaluation</h1>
          <p className="section-subtitle">
            Compare ffprobe-wasm with internal and future engines. Backend/Akuma remains authoritative.
          </p>

          <EngineSelector
            mode={analyzeMode}
            selectedEngineId={selectedEngineId}
            matrixEngineIds={matrixEngineIds}
            onModeChange={setAnalyzeMode}
            onEngineChange={setSelectedEngineId}
            onMatrixEnginesChange={setMatrixEngineIds}
          />

          {fixturesMissing ? (
            <section className="card fixture-warning">
              <h2 className="card-title">Sample videos unavailable</h2>
              <p>
                Sample videos are not available in this deployment. Single-file upload analysis still works,
                but the test matrix cannot run.
              </p>
              {fixtureCheck?.error ? <p className="status-error">{fixtureCheck.error}</p> : null}
              {fixtureCheck?.coreMissing.length ? (
                <p className="status-error">{formatFixtureMissingError(fixtureCheck.coreMissing)}</p>
              ) : null}
              <p className="status-text">
                Deploy with <code>npm run build:deploy</code> (generates fixtures into <code>public/fixtures/</code> before build).
              </p>
            </section>
          ) : null}

          {!wasmEnvironment.canRunFfprobeWasm ? (
            <section className="card environment-warning">
              <h2 className="card-title">Browser environment note</h2>
              {wasmEnvironment.issue ? <p className="status-error">{wasmEnvironment.issue}</p> : null}
              {wasmEnvironment.recommendation ? <p>{wasmEnvironment.recommendation}</p> : null}
              <p className="status-text">
                npm ffprobe-wasm requires COOP/COEP + SharedArrayBuffer.{' '}
                <strong>minimal-metadata-ffprobe</strong> can still run in compare mode on HTTPS without cross-origin isolation.
              </p>
              <p className="status-text">
                Secure context: {wasmEnvironment.isSecureContext ? 'yes' : 'no'} · Cross-origin isolated:{' '}
                {wasmEnvironment.crossOriginIsolated ? 'yes' : 'no'} · SharedArrayBuffer:{' '}
                {wasmEnvironment.sharedArrayBufferAvailable ? 'yes' : 'no'}
              </p>
            </section>
          ) : null}

          <section className="card">
            <h2 className="card-title">Bundle impact</h2>
            <div className="executive-summary">
              <div className="summary-row">
                <span className="summary-row__label">Main bundle impact</span>
                <span className="badge badge-success">{BUNDLE_IMPACT.mainBundleImpact}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">ffprobe-wasm lazy chunk</span>
                <span className="summary-row__value">
                  <span className="badge badge-performance">{BUNDLE_IMPACT.lazyChunkGzip}</span>
                  {' '}
                  <span className="badge badge-performance">{BUNDLE_IMPACT.lazyChunkBrotli}</span>
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Lazy-loaded</span>
                <span className="badge badge-info">{BUNDLE_IMPACT.lazyLoaded ? 'Yes' : 'No'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Standalone wasm</span>
                <span className="badge badge-diagnostic">{BUNDLE_IMPACT.standaloneWasm}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">User impact</span>
                <span className="summary-row__value">{BUNDLE_IMPACT.userImpact}</span>
              </div>
              <div className="summary-row summary-row--risk">
                <span className="summary-row__label">Risk</span>
                <span className="summary-row__value">{BUNDLE_IMPACT.firstAnalysisRisk}</span>
              </div>
            </div>
            <details className="technical-details">
              <summary>Technical details</summary>
              <pre className="db-viewer">{BUNDLE_TECHNICAL_DETAILS}</pre>
            </details>
          </section>

          <SizeComparisonCard />
          <BenchSummaryCard />

          <section className="card card-compact">
            <h2 className="card-title">Status legend</h2>
            <div className="legend-grid">
              <LegendItem badgeClass="badge-success" label="Pass / match" description="Validation succeeded or engines agree" />
              <LegendItem badgeClass="badge-warning" label="Warning / missing" description="Needs attention or field absent from both" />
              <LegendItem badgeClass="badge-error" label="Error / mismatch" description="Block or different values" />
              <LegendItem badgeClass="badge-info" label="Only one engine" description="only current / only minimal" />
              <LegendItem badgeClass="badge-fallback" label="Fallback" description="Recovered via codec_width/codec_height" />
              <LegendItem badgeClass="badge-info" label="Info" description="Neutral metadata" />
              <LegendItem badgeClass="badge-diagnostic" label="Unsupported" description="Engine pending integration" />
              <LegendItem badgeClass="badge-performance" label="Performance cost" description="Bundle or download impact" />
            </div>
          </section>

          {tab === 'analyze' ? (
            <>
              <div className="grid-two-cols">
                <section className="card">
                  <h2 className="card-title">Analyze single file</h2>
                  <div className="form-group">
                    <span className="form-label">Video file</span>
                    <div className="file-picker">
                      <input
                        id="video-file-input"
                        className="file-picker__input"
                        type="file"
                        accept="video/*,audio/*"
                        onChange={(event) => {
                          setSelectedFile(event.target.files?.[0] ?? null)
                          setValidation(null)
                          setRawOutput(null)
                          setEngineResults([])
                          setComparisonReport(null)
                        }}
                      />
                      <label className="btn btn-secondary file-picker__button" htmlFor="video-file-input">
                        Choose file
                      </label>
                      <span
                        className={`file-picker__name ${selectedFile ? 'file-picker__name--selected' : ''}`}
                        title={selectedFile?.name}
                      >
                        {selectedFile?.name ?? 'No file chosen'}
                      </span>
                      {selectedFile ? (
                        <span className="file-picker__meta">
                          {(selectedFile.size / 1_000_000).toFixed(2)} MB
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Max duration (s)</label>
                      <input className="form-input" type="number" value={policy.maxDurationSeconds} onChange={(event) => setPolicy({ ...policy, maxDurationSeconds: Number(event.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max bitrate (bps)</label>
                      <input className="form-input" type="number" value={policy.maxBitrateBps} onChange={(event) => setPolicy({ ...policy, maxBitrateBps: Number(event.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">A/V delta (s)</label>
                      <input className="form-input" type="number" step="0.1" value={policy.maxAudioVideoDurationDeltaSeconds} onChange={(event) => setPolicy({ ...policy, maxAudioVideoDurationDeltaSeconds: Number(event.target.value) })} />
                    </div>
                  </div>
                  <div className="btn-row">
                    <button type="button" className="btn btn-primary" disabled={!selectedFile || isAnalyzing || (!wasmEnvironment.canRunFfprobeWasm && !wasmEnvironment.isSecureContext)} onClick={handleAnalyze}>
                      {isAnalyzing ? 'Analyzing…' : analyzeMode === 'compare' ? 'Compare engines' : 'Analyze video'}
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={engineResults.length === 0} onClick={() => exportAnalysisJson({ engineResults, comparisonReport, validation, policy, benchSummary })}>
                      Export JSON
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={!comparisonReport} onClick={() => comparisonReport && exportComparisonCsv({ fileName: selectedFile?.name ?? 'file', comparison: comparisonReport })}>
                      Export comparison CSV
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={!validation || !selectedFile} onClick={() => validation && selectedFile && exportSingleAnalysisCsv({ fileName: selectedFile.name, engineId: selectedEngineId, validation, timings: engineResults.find((r) => r.engineId === selectedEngineId)?.timings ?? null })}>
                      Export CSV row
                    </button>
                  </div>
                  <p className="status-text">{status}</p>
                  {error ? <p className="status-error">{error}</p> : null}
                  {validation ? (
                    <p style={{ marginTop: 12 }}>
                      Decision: <span className={decisionBadgeClass(validation.decision)}>{validation.decision}</span>
                    </p>
                  ) : null}
                </section>

                <section className="card">
                  <h2 className="card-title">Summary dashboard</h2>
                  <div className="metric-card-grid">
                    <div className="metric-card metric-info">
                      <div className="metric-title">Matrix tests run</div>
                      <div className="metric-value metric-value--info">{matrixSummary.total}</div>
                    </div>
                    <div className="metric-card metric-success">
                      <div className="metric-title">Analyze success</div>
                      <div className="metric-value metric-value--success">{matrixSummary.success}</div>
                    </div>
                    <div className="metric-card metric-error">
                      <div className="metric-title">Failures</div>
                      <div className="metric-value">{matrixSummary.failed}</div>
                    </div>
                    <div className="metric-card metric-diagnostic">
                      <div className="metric-title">Dimension limitation rows</div>
                      <div className="metric-value">{matrixSummary.dimensionLimited}</div>
                    </div>
                  </div>
                </section>
              </div>

              {comparisonReport ? (
                <>
                  <CompareTable report={comparisonReport} />
                  <BenchmarkDashboard benchmarks={comparisonReport.benchmarks} />
                  <EngineScorecards
                    scores={comparisonReport.reliabilityScores}
                    matrixSummaries={matrixSummaries}
                    recommendation={comparisonReport.recommendation}
                  />
                </>
              ) : null}

              {validation ? (
                <>
                  <section className="card">
                    <h2 className="card-title">Normalized metadata</h2>
                    <dl className="meta-grid">
                      <MetaItem label="Container" value={validation.metadata.containerFormat} />
                      <MetaItem label="Duration" value={validation.metadata.durationSeconds != null ? `${validation.metadata.durationSeconds.toFixed(3)}s` : '—'} />
                      <MetaItem label="Video codec" value={validation.metadata.videoCodec} />
                      <MetaItem label="Audio codec" value={validation.metadata.audioCodec} />
                      <DimensionMetaItem validation={validation} />
                      <MetaItem label="FPS" value={validation.metadata.fps?.toFixed(3) ?? '—'} />
                      <MetaItem label="Bitrate" value={validation.metadata.bitrateBps != null ? `${Math.round(validation.metadata.bitrateBps / 1000)} kbps` : '—'} />
                      <MetaItem label="File size" value={validation.metadata.fileSizeBytes != null ? `${(validation.metadata.fileSizeBytes / 1_000_000).toFixed(2)} MB` : '—'} />
                      <MetaItem label="Upload size category" value={validation.metadata.uploadSizeCategory} />
                      <MetaItem label="Resolution category" value={validation.metadata.resolutionCategory} />
                      <MetaItem label="Extension match" value={String(validation.metadata.extensionContainerMatch)} />
                      <MetaItem label="MIME match" value={String(validation.metadata.mimeContainerMatch)} />
                      <MetaItem label="Video streams" value={validation.metadata.videoStreamCount} />
                      <MetaItem label="Audio streams" value={validation.metadata.audioStreamCount} />
                      <MetaItem label="Pixel format" value={validation.metadata.pixelFormat} />
                      <MetaItem label="Rotation" value={validation.metadata.rotation} />
                      <MetaItem label="Audio channels" value={validation.metadata.audioChannels} />
                      <MetaItem label="Audio sample rate" value={validation.metadata.audioSampleRate ? `${validation.metadata.audioSampleRate} Hz` : '—'} />
                      <MetaItem label="Video profile" value={validation.metadata.videoProfile ? `${validation.metadata.videoProfile}${validation.metadata.videoLevel != null ? ` L${validation.metadata.videoLevel}` : ''}` : '—'} />
                      <MetaItem label="Vertical video" value={String(validation.metadata.isVertical)} />
                      <MetaItem label="HDR" value={String(validation.metadata.isHdr)} />
                      <MetaItem label="10-bit" value={String(validation.metadata.is10Bit)} />
                      <MetaItem label="Interlaced" value={String(validation.metadata.isInterlaced)} />
                      <MetaItem label="Field order" value={validation.metadata.fieldOrder} />
                      <MetaItem label="VFR suspected" value={String(validation.metadata.vfrSuspected)} />
                    </dl>
                  </section>

                  <section className="card">
                    <h2 className="card-title">Preflight checks</h2>
                    <p className="status-text" style={{ marginTop: 0, marginBottom: 16 }}>
                      Best-effort client-side checks grouped by category. Backend/Akuma remains authoritative.
                    </p>
                    <div className="check-groups">
                      {validation.checkGroups.map((group) => (
                        <CheckGroupPanel key={group.id} group={group} />
                      ))}
                    </div>
                  </section>

                  <section className="card">
                    <h2 className="card-title">Diagnostics</h2>
                    <dl className="meta-grid">
                      <MetaItem label="Primary video stream index" value={validation.diagnostics.dimensions.primaryVideoStreamIndex} />
                      <MetaItem label="Raw video width" value={validation.diagnostics.dimensions.rawVideoWidth} />
                      <MetaItem label="Raw video height" value={validation.diagnostics.dimensions.rawVideoHeight} />
                      <MetaItem label="Raw codec_width" value={validation.diagnostics.dimensions.rawVideoCodecWidth} />
                      <MetaItem label="Raw codec_height" value={validation.diagnostics.dimensions.rawVideoCodecHeight} />
                      <MetaItem label="Raw audio width" value={validation.diagnostics.dimensions.rawAudioWidth} />
                      <MetaItem label="Raw audio height" value={validation.diagnostics.dimensions.rawAudioHeight} />
                    </dl>
                    <div className={diagnosticCalloutClass(validation.diagnostics.dimensions.conclusion)}>
                      <strong>
                        {validation.diagnostics.dimensions.conclusion === 'codec_fallback' ? (
                          <>Resolution <span className="badge badge-fallback">fallback</span></>
                        ) : (
                          validation.diagnostics.dimensions.conclusion
                        )}
                      </strong>
                      <p>{validation.diagnostics.dimensions.explanation}</p>
                    </div>
                    <FieldTagSection label="Reliable fields" fields={validation.diagnostics.reliableFields} variant="reliable" />
                    <FieldTagSection label="Fallback fields" fields={validation.diagnostics.fallbackFields} variant="fallback" />
                    <FieldTagSection label="Unreliable fields" fields={validation.diagnostics.unreliableFields} variant="unreliable" />
                  </section>

                  <section className="card">
                    <h2 className="card-title">Metadata source</h2>
                    <p className="status-text" style={{ marginTop: 0, marginBottom: 12 }}>
                      Where each displayed field value was read from in ffprobe-wasm output.
                    </p>
                    <dl className="source-grid">
                      <SourceItem label="Resolution" value={validation.metadata.width && validation.metadata.height ? `${validation.metadata.width}×${validation.metadata.height}` : '—'} source={validation.diagnostics.metadataSources.resolution} isFallback={validation.diagnostics.dimensions.dimensionSource === 'codec_fallback'} />
                      <SourceItem label="FPS" value={validation.metadata.fps?.toFixed(3) ?? '—'} source={validation.diagnostics.metadataSources.fps} />
                      <SourceItem label="Video codec" value={validation.metadata.videoCodec} source={validation.diagnostics.metadataSources.videoCodec} />
                      <SourceItem label="Audio codec" value={validation.metadata.audioCodec} source={validation.diagnostics.metadataSources.audioCodec} />
                      <SourceItem label="Duration" value={validation.metadata.durationSeconds != null ? `${validation.metadata.durationSeconds.toFixed(3)}s` : '—'} source={validation.diagnostics.metadataSources.duration} />
                      <SourceItem label="Bitrate" value={validation.metadata.bitrateBps != null ? `${Math.round(validation.metadata.bitrateBps / 1000)} kbps` : '—'} source={validation.diagnostics.metadataSources.bitrate} />
                      <SourceItem label="Container" value={validation.metadata.containerFormat} source={validation.diagnostics.metadataSources.container} />
                      <SourceItem label="Has video" value={String(validation.metadata.hasVideo)} source={validation.diagnostics.metadataSources.hasVideo} />
                      <SourceItem label="Has audio" value={String(validation.metadata.hasAudio)} source={validation.diagnostics.metadataSources.hasAudio} />
                      <SourceItem label="Extension match" value={String(validation.metadata.extensionContainerMatch)} source={validation.diagnostics.metadataSources.extensionMatch} />
                      <SourceItem label="Rotation" value={validation.metadata.rotation ?? '—'} source={validation.diagnostics.metadataSources.rotation} />
                      <SourceItem label="Pixel format" value={validation.metadata.pixelFormat ?? '—'} source={validation.diagnostics.metadataSources.pixelFormat} />
                      <SourceItem label="Color primaries" value={validation.metadata.colorPrimaries ?? '—'} source={validation.diagnostics.metadataSources.colorPrimaries} />
                    </dl>
                  </section>

                  <div className="grid-two-cols">
                    <section className="card">
                      <h2 className="card-title">Warnings</h2>
                      <IssueList items={validation.warnings} empty="No warnings." variant="warnings" />
                    </section>
                    <section className="card">
                      <h2 className="card-title">Errors</h2>
                      <IssueList items={validation.errors} empty="No errors." variant="errors" />
                    </section>
                  </div>
                </>
              ) : null}

              {rawOutput ? (
                <section className="card">
                  <h2 className="card-title">Raw ffprobe JSON</h2>
                  <pre className="db-viewer">{JSON.stringify(rawOutput, null, 2)}</pre>
                </section>
              ) : null}
            </>
          ) : (
            <>
              <section className="card">
                <h2 className="card-title">Test matrix runner</h2>
                <p className="status-text" style={{ marginTop: 0 }}>
                  Engines: {matrixEngineIds.join(', ') || 'ffprobe-wasm'}
                </p>
                {matrixSummaries.some((s) => s.total > 0) ? (
                  <div className="table-container" style={{ marginBottom: 16 }}>
                    <table className="workout-table">
                      <thead>
                        <tr>
                          <th>Engine</th>
                          <th>Success rate</th>
                          <th>Pass / total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrixSummaries.filter((s) => s.total > 0).map((summary) => (
                          <tr key={summary.engineId}>
                            <td>{summary.engineName}</td>
                            <td><span className={`badge ${summary.successRatePercent >= 90 ? 'badge-success' : summary.successRatePercent >= 70 ? 'badge-warning' : 'badge-error'}`}>{summary.successRatePercent}%</span></td>
                            <td>{summary.success}/{summary.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="tester-name-input">Tester name</label>
                    <input id="tester-name-input" className="form-input" value={testerName} onChange={(event) => setTesterName(event.target.value)} placeholder="amir" />
                  </div>
                  <div className="form-group">
                    <span className="form-label">Optional fixtures</span>
                    <label className="form-checkbox" htmlFor="include-optional-fixtures">
                      <input
                        id="include-optional-fixtures"
                        type="checkbox"
                        checked={includeOptionalFixtures}
                        onChange={(event) => setIncludeOptionalFixtures(event.target.checked)}
                      />
                      <span className="form-checkbox__label">Include 4K, long duration, real-world</span>
                    </label>
                  </div>
                </div>
                {fixtureCheckLoading ? (
                  <p className="status-text">Checking fixture availability…</p>
                ) : fixturesReady ? (
                  <p className="status-text">Fixtures ready ({fixtureCheck?.checked ?? 0} checked).</p>
                ) : null}
                {matrixError ? <p className="status-error">{matrixError}</p> : null}
                <div className="btn-row">
                  <button type="button" className="btn btn-primary" disabled={!matrix || Boolean(activeTestId) || !fixturesReady || !wasmEnvironment.canRunFfprobeWasm} onClick={handleRunAllTests}>
                    Run all tests
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={matrixResults.length === 0} onClick={() => exportMatrixCsv(matrixResults)}>
                    Export matrix CSV
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={matrixResults.length === 0} onClick={() => exportMarkdownReport({
                    browser: detectBrowser(),
                    tester: testerName,
                    bundleSummary: BUNDLE_TECHNICAL_DETAILS,
                    benchSummary,
                    results: matrixResults,
                    comparison: comparisonReport,
                    engineResults,
                    matrixSummaries,
                  })}>
                    Export Markdown report
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="table-container">
                  <table className="workout-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Engine</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Decision</th>
                        <th>Dims</th>
                        <th>Diag</th>
                        <th>ms</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {matrix?.testCases.flatMap((testCase) =>
                        (matrixEngineIds.length > 0 ? matrixEngineIds : ['ffprobe-wasm']).map((engineId) => {
                          const result = matrixResults.find(
                            (entry) => entry.testId === testCase.id && entry.engineId === engineId,
                          )
                          const rowKey = `${testCase.id}:${engineId}`
                          return (
                          <tr key={rowKey}>
                            <td>{testCase.id}</td>
                            <td><span className="badge badge-info">{engineId}</span></td>
                            <td>{testCase.name}</td>
                            <td>
                              <MatrixStatusCell
                                isRunning={activeTestId === rowKey}
                                result={result}
                                testId={testCase.id}
                              />
                            </td>
                            <td>
                              {result?.decision ? (
                                <span className={decisionBadgeClass(result.decision as ValidationDecision)}>
                                  {result.decision}
                                </span>
                              ) : '—'}
                            </td>
                            <td>
                              {result ? (
                                <>
                                  {result.widthDetected || 0}×{result.heightDetected || 0}
                                  {result.dimensionConclusion === 'codec_fallback' ? (
                                    <span className="badge badge-fallback" style={{ marginLeft: 6 }}>fallback</span>
                                  ) : null}
                                </>
                              ) : '—'}
                            </td>
                            <td>
                              {result?.dimensionConclusion ? (
                                <span className={dimensionConclusionBadgeClass(result.dimensionConclusion)}>
                                  {result.dimensionConclusion}
                                </span>
                              ) : '—'}
                            </td>
                            <td>{result?.processingTimeMs.toFixed(1) ?? '—'}</td>
                            <td>
                              <button type="button" className="btn btn-secondary" disabled={Boolean(activeTestId)} onClick={() => handleRunOneTest(testCase, engineId)}>
                                Run
                              </button>
                            </td>
                          </tr>
                          )
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <section className="card">
            <h2 className="card-title">Final recommendation</h2>
            <div className="recommendation-card__header">
              <span className={recommendationBadgeClass()}>{recommendation.recommendationLabel}</span>
              <h3 className="recommendation-card__title">Recommendation for Aparat upload preflight</h3>
            </div>
            <div className="recommendation-section">
              <h3>Reason</h3>
              <p>{recommendation.reason}</p>
            </div>
            {recommendation.caveats?.length ? (
              <div className="recommendation-section">
                <h3>Caveats</h3>
                <ul className="recommendation-list recommendation-list--risks">
                  {recommendation.caveats.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="grid-two-cols">
              <div className="recommendation-section">
                <h3>Good for</h3>
                <ul className="recommendation-list recommendation-list--good">
                  {recommendation.goodFor.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="recommendation-section">
                <h3>Risks</h3>
                <ul className="recommendation-list recommendation-list--risks">
                  {recommendation.risks.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

function CheckGroupPanel({ group }: { group: ValidationCheckGroup }) {
  const hasIssues = group.issues.length > 0
  const highestSeverity = group.issues.some((i) => i.severity === 'error')
    ? 'error'
    : group.issues.some((i) => i.severity === 'warning')
      ? 'warning'
      : group.issues.some((i) => i.severity === 'info')
        ? 'info'
        : 'pass'

  const badgeClass =
    highestSeverity === 'error'
      ? 'badge-error'
      : highestSeverity === 'warning'
        ? 'badge-warning'
        : highestSeverity === 'info'
          ? 'badge-info'
          : 'badge-success'

  return (
    <div className="check-group">
      <div className="check-group__header">
        <h3 className="check-group__title">{group.label}</h3>
        <span className={`badge ${badgeClass}`}>
          {hasIssues ? `${group.issues.length} issue${group.issues.length === 1 ? '' : 's'}` : 'pass'}
        </span>
      </div>
      {hasIssues ? (
        <ul className="check-group__list">
          {group.issues.map((item) => (
            <li
              key={`${group.id}-${item.code}`}
              className={`check-group__item check-group__item--${item.severity}`}
            >
              <code>{item.code}</code>: {item.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="status-text check-group__empty">No issues detected.</p>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="meta-item">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}

function DimensionMetaItem({ validation }: { validation: ValidationResult }) {
  const { dimensions } = validation.diagnostics
  const { width, height } = validation.metadata
  const isFallback = dimensions.dimensionSource === 'codec_fallback'

  if (width && height) {
    return (
      <div className={`meta-item ${isFallback ? 'source-item--fallback' : ''}`}>
        <dt>
          Resolution {isFallback ? <span className="badge badge-fallback">fallback</span> : null}
        </dt>
        <dd>
          {width}×{height}
          {isFallback ? (
            <p className="status-text" style={{ marginTop: 6, fontWeight: 400, fontSize: 12 }}>
              Recovered from codec_width/codec_height — not detected from native width/height.
            </p>
          ) : null}
        </dd>
      </div>
    )
  }

  return (
    <>
      <MetaItem label="Normalized width" value={width} />
      <MetaItem label="Normalized height" value={height} />
    </>
  )
}

function FieldTagSection({
  label,
  fields,
  variant,
}: {
  label: string
  fields: string[]
  variant: 'reliable' | 'unreliable' | 'fallback'
}) {
  if (fields.length === 0) return null

  return (
    <div style={{ marginTop: 12 }}>
      <p className="status-text" style={{ marginTop: 0, marginBottom: 4 }}>{label}</p>
      <div className="field-tag-list">
        {fields.map((field) => (
          <span key={field} className={`field-tag field-tag--${variant}`}>{field}</span>
        ))}
      </div>
    </div>
  )
}

function LegendItem({
  badgeClass,
  label,
  description,
}: {
  badgeClass: string
  label: string
  description: string
}) {
  return (
    <div className="legend-item">
      <span className={`badge ${badgeClass}`}>{label}</span>
      <span className="legend-item__desc">{description}</span>
    </div>
  )
}

function diagnosticCalloutClass(conclusion: ValidationResult['diagnostics']['dimensions']['conclusion']): string {
  switch (conclusion) {
    case 'ok':
      return 'diagnostic-callout diagnostic-callout--success'
    case 'codec_fallback':
      return 'diagnostic-callout diagnostic-callout--fallback'
    case 'ffprobe_wasm_limitation':
    case 'normalizer_bug':
      return 'diagnostic-callout diagnostic-callout--error'
    case 'no_video_stream':
      return 'diagnostic-callout diagnostic-callout--info'
    default:
      return 'diagnostic-callout diagnostic-callout--diagnostic'
  }
}

function dimensionConclusionBadgeClass(conclusion: string): string {
  switch (conclusion) {
    case 'ok':
      return 'badge badge-success'
    case 'codec_fallback':
      return 'badge badge-fallback'
    case 'ffprobe_wasm_limitation':
    case 'normalizer_bug':
      return 'badge badge-error'
    case 'no_video_stream':
      return 'badge badge-info'
    default:
      return 'badge badge-diagnostic'
  }
}

function MatrixStatusCell({
  isRunning,
  result,
  testId,
}: {
  isRunning: boolean
  result: CompatibilityTestResult | undefined
  testId: string
}) {
  if (isRunning) {
    return <span className="badge badge-info table-status">Running…</span>
  }

  if (!result) {
    return <span className="badge badge-diagnostic table-status">pending</span>
  }

  if (result.analyzeSuccess) {
    return <span className="badge badge-success table-status">pass</span>
  }

  if (['TC-FMT-005', 'TC-FMT-006'].includes(testId)) {
    return <span className="badge badge-error table-status">unsupported</span>
  }

  return <span className="badge badge-error table-status">fail</span>
}

function SourceItem({
  label,
  value,
  source,
  isFallback = false,
}: {
  label: string
  value: string | number | null | undefined
  source: string
  isFallback?: boolean
}) {
  const fallback = isFallback || source.includes('fallback')

  return (
    <div className={`source-item ${fallback ? 'source-item--fallback' : ''}`}>
      <dt>
        {label} {fallback ? <span className="badge badge-fallback">fallback</span> : null}
      </dt>
      <dd className="source-item__value">{value ?? '—'}</dd>
      <dd className={`source-item__source ${fallback ? 'source-item__source--fallback' : ''}`}>
        source: {source}
      </dd>
    </div>
  )
}

function IssueList({
  items,
  empty,
  variant,
}: {
  items: { code: string; message: string }[]
  empty: string
  variant?: 'warnings' | 'errors'
}) {
  if (items.length === 0) return <p className="status-text">{empty}</p>

  const listClass = variant === 'warnings'
    ? 'issue-list issue-list--warnings'
    : variant === 'errors'
      ? 'issue-list issue-list--errors'
      : 'issue-list'

  return (
    <ul className={listClass}>
      {items.map((item) => (
        <li key={`${item.code}-${item.message}`}>
          <code>{item.code}</code>: {item.message}
        </li>
      ))}
    </ul>
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
