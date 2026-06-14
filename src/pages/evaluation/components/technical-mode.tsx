import { useState } from 'react'
import type { FileInfo } from 'ffprobe-wasm'
import type { EngineComparisonReport, MatrixEngineSummary } from '../../../lib/comparison'
import type { AnalysisResult } from '../../../lib/engines/types'
import type { ValidationResult, UploaderPolicy } from '../../../lib/ffprobe'
import type { CompatibilityTestResult, TestCaseDefinition } from '../../../lib/compatibility/test-results'
import type { FixtureCheckResult } from '../../../lib/fixtures'

import { EngineSelector, type AnalyzeMode } from './engine-selector'
import { BundleImpactCard } from './bundle-impact-card'
import { SizeComparisonCard } from './size-comparison-card'
import { BenchSummaryCard } from './bench-summary-card'
import { CompareTable } from './compare-table'
import { BenchmarkDashboard } from './benchmark-dashboard'
import { EngineScorecards } from './engine-scorecards'
import { TechnicalDetailsContent } from './technical-details-content'
import { decisionBadgeClass } from '../../../lib/ffprobe'

interface TechnicalModeProps {
  wasmEnvironment: {
    canRunFfprobeWasm: boolean
    isSecureContext: boolean
    crossOriginIsolated: boolean
    sharedArrayBufferAvailable: boolean
    issue: string | null
    recommendation: string | null
  }
  policy: UploaderPolicy
  setPolicy: (policy: UploaderPolicy) => void
  selectedFile: File | null
  setSelectedFile: (file: File | null) => void
  isAnalyzing: boolean
  onAnalyze: () => void
  status: string
  error: string | null

  engineResults: AnalysisResult[]
  comparisonReport: EngineComparisonReport | null
  rawOutput: FileInfo | null
  validation: ValidationResult | null
  primaryEngineName: string

  analyzeMode: AnalyzeMode
  setAnalyzeMode: (mode: AnalyzeMode) => void
  selectedEngineId: string
  setSelectedEngineId: (id: string) => void
  matrixEngineIds: string[]
  setMatrixEngineIds: (ids: string[]) => void

  // Matrix-related props
  matrix: { version: string; package: string; testCases: TestCaseDefinition[] } | null
  matrixResults: CompatibilityTestResult[]
  matrixSummaries: MatrixEngineSummary[]
  activeTestId: string | null
  testerName: string
  setTesterName: (name: string) => void
  fixtureCheck: FixtureCheckResult | null
  fixtureCheckLoading: boolean
  includeOptionalFixtures: boolean
  setIncludeOptionalFixtures: (val: boolean) => void
  matrixError: string | null
  fixturesReady: boolean
  fixturesMissing: boolean
  handleRunAllTests: () => void
  handleRunOneTest: (testCase: TestCaseDefinition, engineId?: string) => void

  // Export functions
  onExportJson: () => void
  onExportComparisonCsv: () => void
  onExportMatrixCsv: () => void
  onExportFullReport: () => void
}

type SubTabId = 'diagnostics' | 'matrix' | 'performance'

export function TechnicalMode({
  wasmEnvironment,
  policy,
  setPolicy,
  selectedFile,
  setSelectedFile,
  isAnalyzing,
  onAnalyze,
  status,
  error,
  engineResults,
  comparisonReport,
  rawOutput,
  validation,
  primaryEngineName,
  analyzeMode,
  setAnalyzeMode,
  selectedEngineId,
  setSelectedEngineId,
  matrixEngineIds,
  setMatrixEngineIds,

  matrix,
  matrixResults,
  matrixSummaries,
  activeTestId,
  testerName,
  setTesterName,
  fixtureCheck,
  fixtureCheckLoading,
  includeOptionalFixtures,
  setIncludeOptionalFixtures,
  matrixError,
  fixturesReady,
  fixturesMissing,
  handleRunAllTests,
  handleRunOneTest,

  onExportJson,
  onExportComparisonCsv,
  onExportMatrixCsv,
  onExportFullReport,
}: TechnicalModeProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('diagnostics')
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact')

  function getShortEngineName(id: string): string {
    if (id === 'ffprobe-wasm') return 'ffprobe'
    if (id === 'minimal-metadata-ffprobe') return 'minimal'
    return id
  }


  return (
    <div className="technical-mode-layout">
      {/* Sub-tab Navigation */}
      <nav className="nav-tabs" style={{ display: 'inline-flex', marginBottom: 24 }}>
        <button
          type="button"
          className={`tab-btn ${activeSubTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('diagnostics')}
        >
          Diagnostics & Uploads
        </button>
        <button
          type="button"
          className={`tab-btn ${activeSubTab === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('matrix')}
        >
          Sample Test Matrix
        </button>
        <button
          type="button"
          className={`tab-btn ${activeSubTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('performance')}
        >
          Performance & Bundle
        </button>
      </nav>

      {/* Sub-Tab Content: Diagnostics & Uploads */}
      {activeSubTab === 'diagnostics' && (
        <div className="sub-tab-panel">
          <section className="card">
            <h2 className="card-title">Analysis Engine Selection</h2>
            <EngineSelector
              mode={analyzeMode}
              selectedEngineId={selectedEngineId}
              matrixEngineIds={matrixEngineIds}
              onModeChange={setAnalyzeMode}
              onEngineChange={setSelectedEngineId}
              onMatrixEnginesChange={setMatrixEngineIds}
            />
          </section>

          {/* Validation Policy Parameters */}
          <section className="card">
            <h2 className="card-title">Uploader Validation Policy Configuration</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Max duration (seconds)</label>
                <input
                  className="form-input"
                  type="number"
                  value={policy.maxDurationSeconds}
                  onChange={(event) => setPolicy({ ...policy, maxDurationSeconds: Number(event.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max bitrate (bps)</label>
                <input
                  className="form-input"
                  type="number"
                  value={policy.maxBitrateBps}
                  onChange={(event) => setPolicy({ ...policy, maxBitrateBps: Number(event.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max A/V delta (seconds)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.1"
                  value={policy.maxAudioVideoDurationDeltaSeconds}
                  onChange={(event) => setPolicy({ ...policy, maxAudioVideoDurationDeltaSeconds: Number(event.target.value) })}
                />
              </div>
            </div>
          </section>

          {/* File Picker & Upload Area */}
          <section className="card">
            <h2 className="card-title">Analyze Video File</h2>
            <div className="form-group">
              <div className="file-picker">
                <input
                  id="tech-video-file-input"
                  className="file-picker__input"
                  type="file"
                  accept="video/*,audio/*"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }}
                />
                <label className="btn btn-secondary file-picker__button" htmlFor="tech-video-file-input">
                  Choose file
                </label>
                <span
                  className={`file-picker__name ${selectedFile ? 'file-picker__name--selected' : ''}`}
                  title={selectedFile?.name ?? ''}
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

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedFile || isAnalyzing || (!wasmEnvironment.canRunFfprobeWasm && !wasmEnvironment.isSecureContext)}
                onClick={onAnalyze}
              >
                {isAnalyzing ? 'Analyzing…' : analyzeMode === 'compare' ? 'Compare engines' : 'Analyze video'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={engineResults.length === 0}
                onClick={onExportJson}
              >
                Export Raw JSON
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!comparisonReport}
                onClick={onExportComparisonCsv}
              >
                Export Comparison CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={engineResults.length === 0}
                onClick={onExportFullReport}
              >
                Export Full Report
              </button>
            </div>
            <p className="status-text">{status}</p>
            {error ? <p className="status-error">{error}</p> : null}
          </section>

          {/* Side-by-side comparison tables */}
          {comparisonReport && (
            <>
              <CompareTable report={comparisonReport} />
              <EngineScorecards
                scores={comparisonReport.reliabilityScores}
                matrixSummaries={matrixSummaries}
                recommendation={comparisonReport.recommendation}
              />
            </>
          )}

          {/* Diagnostic detailed panels */}
          <TechnicalDetailsContent
            viewMode="technical"
            validation={validation}
            primaryEngineName={primaryEngineName}
            rawOutput={rawOutput}
            engineResults={engineResults}
            comparisonReport={comparisonReport}
            analyzeMode={analyzeMode}
            selectedEngineId={selectedEngineId}
            matrixEngineIds={matrixEngineIds}
            onModeChange={setAnalyzeMode}
            onEngineChange={setSelectedEngineId}
            onMatrixEnginesChange={setMatrixEngineIds}
          />
        </div>
      )}

      {/* Sub-Tab Content: Sample Test Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="sub-tab-panel">
          <section className="card">
            <h2 className="card-title">Test Matrix Runner</h2>
            <p className="status-text" style={{ marginTop: 0 }}>
              Engines under test: {matrixEngineIds.join(', ') || 'ffprobe-wasm'}
            </p>

            {matrixSummaries.some((s) => s.total > 0) && (
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
                        <td>
                          <span className={`badge ${summary.successRatePercent >= 90 ? 'badge-success' : summary.successRatePercent >= 70 ? 'badge-warning' : 'badge-error'}`}>
                            {summary.successRatePercent}%
                          </span>
                        </td>
                        <td>{summary.success}/{summary.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="tester-name-input">Tester name</label>
                <input
                  id="tester-name-input"
                  className="form-input"
                  value={testerName}
                  onChange={(event) => setTesterName(event.target.value)}
                  placeholder="amir"
                />
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

            {fixturesMissing && (
              <div className="diagnostic-callout diagnostic-callout--error" style={{ marginBottom: 16 }}>
                <strong>Fixtures Missing</strong>
                <p>Ensure fixtures are generated into `public/fixtures/` folder.</p>
              </div>
            )}

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!matrix || Boolean(activeTestId) || !fixturesReady || !wasmEnvironment.canRunFfprobeWasm}
                onClick={handleRunAllTests}
              >
                Run all tests
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={matrixResults.length === 0}
                onClick={onExportMatrixCsv}
              >
                Export Matrix CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={matrixResults.length === 0}
                onClick={onExportFullReport}
              >
                Export Full Markdown Report
              </button>
            </div>
          </section>

          {/* Test Matrix Results Table */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h2 className="card-title" style={{ margin: 0 }}>Test Suite Matrix Cases</h2>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-color)', borderRadius: '14px', padding: '2px', background: 'rgba(255, 255, 255, 0.03)' }}>
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  style={{
                    border: 'none',
                    background: density === 'compact' ? 'var(--primary)' : 'transparent',
                    color: density === 'compact' ? '#000' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: density === 'compact' ? 700 : 500,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('comfortable')}
                  style={{
                    border: 'none',
                    background: density === 'comfortable' ? 'var(--primary)' : 'transparent',
                    color: density === 'comfortable' ? '#000' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: density === 'comfortable' ? 700 : 500,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  Comfortable
                </button>
              </div>
            </div>

            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="workout-table" style={{ tableLayout: 'fixed', minWidth: '1100px', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '80px' }} />
                </colgroup>
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix?.testCases.flatMap((testCase) => {
                    const activeEngines = matrixEngineIds.length > 0 ? matrixEngineIds : ['ffprobe-wasm', 'minimal-metadata-ffprobe']
                    const cellPadding = density === 'compact' ? '6px 8px' : '12px 14px'

                    const commonCellStyle = {
                      padding: cellPadding,
                      whiteSpace: 'nowrap' as const,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      verticalAlign: 'middle',
                    }

                    return activeEngines.map((engineId, idx) => {
                      const result = matrixResults.find(
                        (entry) => entry.testId === testCase.id && entry.engineId === engineId,
                      )
                      const rowKey = `${testCase.id}:${engineId}`
                      const isRunning = activeTestId === rowKey
                      const isLastEngine = idx === activeEngines.length - 1

                      // Row borders: visual grouping of rows by test case
                      const rowStyle = isLastEngine
                        ? { borderBottom: '2px solid rgba(255, 255, 255, 0.12)' }
                        : { borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }

                      return (
                        <tr key={rowKey} style={rowStyle}>
                          {idx === 0 && (
                            <td
                              rowSpan={activeEngines.length}
                              style={{
                                ...commonCellStyle,
                                fontWeight: 700,
                                background: 'rgba(255, 255, 255, 0.015)',
                                borderRight: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                              }}
                            >
                              {testCase.id}
                            </td>
                          )}
                          <td style={commonCellStyle}>
                            <span
                              className="badge badge-info"
                              style={{ fontSize: '11px', padding: '2px 6px', fontWeight: 600, display: 'inline-block', lineHeight: 1.2 }}
                              title={engineId === 'ffprobe-wasm' ? 'Standard ffprobe-wasm Engine' : 'Minimal Metadata Engine'}
                            >
                              {getShortEngineName(engineId)}
                            </span>
                          </td>
                          {idx === 0 && (
                            <td
                              rowSpan={activeEngines.length}
                              title={testCase.name}
                              style={{
                                ...commonCellStyle,
                                background: 'rgba(255, 255, 255, 0.015)',
                                borderRight: '1px solid var(--border-color)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {testCase.name}
                            </td>
                          )}
                          <td style={commonCellStyle}>
                            {isRunning ? (
                              <span className="badge badge-info table-status" style={{ fontSize: '11px', padding: '2px 6px', lineHeight: 1.2 }}>
                                Running…
                              </span>
                            ) : !result ? (
                              <span className="badge badge-diagnostic table-status" style={{ fontSize: '11px', padding: '2px 6px', lineHeight: 1.2 }}>
                                pending
                              </span>
                            ) : result.analyzeSuccess ? (
                              <span className="badge badge-success table-status" style={{ fontSize: '11px', padding: '2px 6px', lineHeight: 1.2 }}>
                                pass
                              </span>
                            ) : ['TC-FMT-005', 'TC-FMT-006'].includes(testCase.id) ? (
                              <span className="badge badge-error table-status" style={{ fontSize: '11px', padding: '2px 6px', lineHeight: 1.2 }}>
                                unsupported
                              </span>
                            ) : (
                              <span className="badge badge-error table-status" style={{ fontSize: '11px', padding: '2px 6px', lineHeight: 1.2 }}>
                                fail
                              </span>
                            )}
                          </td>
                          <td style={commonCellStyle}>
                            {result?.decision ? (
                              <span
                                className={decisionBadgeClass(result.decision as any)}
                                style={{ fontSize: '11px', padding: '2px 6px', lineHeight: 1.2, fontWeight: 700 }}
                              >
                                {result.decision === 'pass'
                                  ? 'PASS'
                                  : result.decision === 'warn'
                                    ? 'WARNING'
                                    : result.decision === 'soft_fail'
                                      ? 'SOFT FAIL'
                                      : result.decision === 'block'
                                        ? 'BLOCKED'
                                        : result.decision.toUpperCase()}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={commonCellStyle}>
                            {result ? (
                              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                                {result.widthDetected || 0}×{result.heightDetected || 0}
                                {result.dimensionConclusion === 'codec_fallback' ? (
                                  <span className="badge badge-fallback" style={{ marginLeft: 4, fontSize: '10px', padding: '1px 4px' }}>fallback</span>
                                ) : null}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={commonCellStyle}>
                            {result?.dimensionConclusion ? (
                              <span
                                className={`badge ${result.dimensionConclusion === 'ok' ? 'badge-success' : result.dimensionConclusion === 'codec_fallback' ? 'badge-fallback' : 'badge-error'}`}
                                style={{ fontSize: '11px', padding: '2px 6px', lineHeight: 1.2 }}
                              >
                                {result.dimensionConclusion}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ ...commonCellStyle, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                            {result?.processingTimeMs != null ? `${result.processingTimeMs.toFixed(0)} ms` : '—'}
                          </td>
                          <td style={commonCellStyle}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={Boolean(activeTestId)}
                              onClick={() => handleRunOneTest(testCase, engineId)}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, minHeight: 'unset', height: '24px', lineHeight: 1 }}
                            >
                              Run
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Sub-Tab Content: Performance & Bundle */}
      {activeSubTab === 'performance' && (
        <div className="sub-tab-panel">
          <BundleImpactCard mode={analyzeMode} selectedEngineId={selectedEngineId} />
          <SizeComparisonCard />
          <BenchSummaryCard />

          {comparisonReport && (
            <BenchmarkDashboard benchmarks={comparisonReport.benchmarks} />
          )}

          {/* Environment Warnings & Status */}
          <section className="card">
            <h2 className="card-title">Browser Environment & Security Context</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="summary-row">
                <span className="summary-row__label">HTTPS / Secure Context</span>
                <span className="summary-row__value" style={{ color: wasmEnvironment.isSecureContext ? 'var(--success)' : 'var(--error)' }}>
                  {wasmEnvironment.isSecureContext ? 'Yes (Secure)' : 'No (Insecure)'}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Cross-Origin Isolated</span>
                <span className="summary-row__value" style={{ color: wasmEnvironment.crossOriginIsolated ? 'var(--success)' : 'var(--error)' }}>
                  {wasmEnvironment.crossOriginIsolated ? 'Yes (COOP-COEP active)' : 'No'}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">SharedArrayBuffer Availability</span>
                <span className="summary-row__value" style={{ color: wasmEnvironment.sharedArrayBufferAvailable ? 'var(--success)' : 'var(--error)' }}>
                  {wasmEnvironment.sharedArrayBufferAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
              {!wasmEnvironment.canRunFfprobeWasm && (
                <div className="diagnostic-callout diagnostic-callout--error" style={{ marginTop: 12 }}>
                  <strong>{wasmEnvironment.issue || 'Standard Wasm Engine Unavailable'}</strong>
                  <p>{wasmEnvironment.recommendation || 'SharedArrayBuffer is disabled. Served minimal-metadata adapter can still process requests.'}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
