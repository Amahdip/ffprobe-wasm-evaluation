import { useMemo } from 'react'
import type { EngineComparisonReport } from '../../../lib/comparison'
import type { AnalysisResult } from '../../../lib/engines/types'
import { getFriendlyContainerName } from '../../../lib/ffprobe/recommendation'
import { OverviewComparisonTable } from './overview-comparison-table'
import { OverviewExecutiveSummary } from './overview-executive-summary'

interface OverviewModeProps {
  report: EngineComparisonReport | null
  results: AnalysisResult[]
  selectedFile: File | null
  setSelectedFile: (file: File | null) => void
  isAnalyzing: boolean
  onAnalyze: () => void
  wasmEnvironment: {
    canRunFfprobeWasm: boolean
    isSecureContext: boolean
    issue: string | null
    recommendation: string | null
  }
  onExportExecutiveSummary: () => void
  onExportFullReport: () => void
}

export function OverviewMode({
  report,
  results,
  selectedFile,
  setSelectedFile,
  isAnalyzing,
  onAnalyze,
  wasmEnvironment,
  onExportExecutiveSummary,
  onExportFullReport,
}: OverviewModeProps) {
  // Extract preferred engine analysis result
  const preferredResult = useMemo(() => {
    return results.find((r) => r.engineId === 'minimal-metadata-ffprobe') ?? results.find((r) => r.success) ?? null
  }, [results])

  // Map decision label and badge class
  const decisionInfo = useMemo(() => {
    if (!preferredResult || !preferredResult.validation) return null
    const decision = preferredResult.validation.decision
    let text = 'PASS'
    let badgeClass = 'badge-success'

    switch (decision) {
      case 'PASS':
        text = 'PASS'
        badgeClass = 'badge-success'
        break
      case 'WARNING':
        text = 'WARNING'
        badgeClass = 'badge-warning'
        break
      case 'SOFT FAIL':
        text = 'SOFT FAIL'
        badgeClass = 'badge-warning' // Amber warning, not red
        break
      case 'BLOCKED':
        text = 'BLOCKED'
        badgeClass = 'badge-error'
        break
      default:
        text = 'PASS'
        badgeClass = 'badge-success'
    }

    return { text, badgeClass }
  }, [preferredResult])

  const friendlyContainer = useMemo(() => {
    if (!preferredResult?.metadata?.containerFormat) return null
    return getFriendlyContainerName(preferredResult.metadata.containerFormat)
  }, [preferredResult])

  const warnings = useMemo(() => {
    if (!preferredResult?.validation) return []
    return preferredResult.validation.warnings.map((w) => w.message)
  }, [preferredResult])

  return (
    <div className="overview-mode-layout">
      {/* 1. RECOMMENDATION SECTION */}
      <section className="card hero-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="card-title" style={{ margin: 0, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Recommendation
          </h2>
          <span className="badge badge-success" style={{ fontWeight: 700 }}>
            RECOMMENDED: MINIMAL METADATA ENGINE
          </span>
        </div>
        <p className="hero-card__reason" style={{ fontSize: 16, lineHeight: 1.5, margin: '8px 0 16px' }}>
          Provides all required uploader preflight metadata while reducing payload size (~430 KB brotli) and removing SharedArrayBuffer/COOP-COEP requirements.
        </p>
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 500 }}>
            ⚠ Recommended for pre-upload warnings, not authoritative validation.
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Note: Backend/Akuma remains the source of truth.
          </span>
        </div>
      </section>

      {/* 2. EXECUTIVE SUMMARY */}
      <OverviewExecutiveSummary report={report} results={results} />

      {/* 3. DECISION COMPARISON */}
      <OverviewComparisonTable report={report} results={results} />

      {/* 4. ANALYZE A VIDEO */}
      <section className="card" style={{ marginBottom: 24 }}>
        <h2 className="card-title">Analyze a Video</h2>
        <p className="status-text" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          Upload a sample video file to check how the preflight validation behaves.
        </p>

        <div className="form-group" style={{ marginBottom: 18 }}>
          <div className="file-picker" style={{ padding: '8px 12px' }}>
            <input
              id="overview-video-file-input"
              className="file-picker__input"
              type="file"
              accept="video/*,audio/*"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null)
              }}
            />
            <label className="btn btn-secondary file-picker__button" htmlFor="overview-video-file-input" style={{ padding: '8px 14px', fontSize: 12 }}>
              Choose Video File
            </label>
            <span
              className={`file-picker__name ${selectedFile ? 'file-picker__name--selected' : ''}`}
              title={selectedFile?.name}
              style={{ fontSize: 13 }}
            >
              {selectedFile?.name ?? 'No file chosen'}
            </span>
            {selectedFile ? (
              <span className="file-picker__meta" style={{ fontSize: 12 }}>
                {(selectedFile.size / 1_000_000).toFixed(2)} MB
              </span>
            ) : null}
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedFile || isAnalyzing || (!wasmEnvironment.canRunFfprobeWasm && !wasmEnvironment.isSecureContext)}
            onClick={onAnalyze}
            style={{ padding: '10px 20px', fontSize: 14 }}
          >
            {isAnalyzing ? 'Analyzing Video…' : 'Run Preflight Analysis'}
          </button>
        </div>

        {/* Display Simplified Results */}
        {preferredResult && decisionInfo ? (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
                Analysis Result:
              </span>
              <span className={`badge ${decisionInfo.badgeClass}`} style={{ fontSize: 13, padding: '5px 12px', fontWeight: 700 }}>
                {decisionInfo.text}
              </span>
            </div>

            {friendlyContainer ? (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Container:</span>
                <strong style={{ color: 'var(--text-main)' }}>{friendlyContainer}</strong>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Preflight Warnings ({warnings.length})
                </strong>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {warnings.map((w, index) => (
                    <li key={index} style={{ marginBottom: 4 }}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : (
              preferredResult.success && (
                <div style={{ color: 'var(--success)', fontSize: 13, fontWeight: 500, marginTop: 8 }}>
                  ✓ Video passed all preflight checks without warnings.
                </div>
              )
            )}
          </div>
        ) : null}
      </section>

      {/* 5. EXPORT REPORT BUTTON */}
      <section className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Export Evaluation Report</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Download a summary of the engine comparison and validation details.
          </p>
        </div>
        <div className="btn-row" style={{ alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onExportExecutiveSummary}
            style={{ padding: '10px 18px', fontSize: 13 }}
          >
            Export Executive Summary
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onExportFullReport}
            style={{ padding: '10px 18px', fontSize: 13 }}
          >
            Export Full Technical Report
          </button>
        </div>
      </section>
    </div>
  )
}
