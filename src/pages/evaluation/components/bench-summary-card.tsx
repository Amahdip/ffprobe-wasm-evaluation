import { useEffect, useState } from 'react'
import {
  BENCH_SUMMARY_FALLBACK,
  loadBenchSummary,
  type BenchSummary,
} from '../../../lib/evaluation/bench-summary'

function fmtKB(n: number): string {
  return `${(n / 1024).toFixed(1)} KB`
}

function fmtMB(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function BenchSummaryCard() {
  const [summary, setSummary] = useState<BenchSummary>(BENCH_SUMMARY_FALLBACK)

  useEffect(() => {
    loadBenchSummary().then(setSummary)
  }, [])

  const full = summary.sizes.full?.total
  const minimal = summary.sizes.minimal?.total

  return (
    <section className="card">
      <h2 className="card-title">Bench report summary</h2>
      <p className="status-text" style={{ marginTop: 0 }}>
        From ffprobe-wasm controlled comparison (`bench/REPORT.md`, 25-sample matrix).
      </p>
      <div className="executive-summary">
        <div className="summary-row">
          <span className="summary-row__label">Full baseline (raw / gzip)</span>
          <span className="summary-row__value">
            {full ? `${fmtMB(full.raw)} / ${fmtKB(full.gzip)}` : '—'}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-row__label">Minimal-metadata (raw / gzip)</span>
          <span className="summary-row__value">
            {minimal ? `${fmtMB(minimal.raw)} / ${fmtKB(minimal.gzip)}` : '—'}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-row__label">Init time (node)</span>
          <span className="summary-row__value">
            full {summary.initMs.full ?? '—'} ms · minimal {summary.initMs.minimal ?? '—'} ms
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-row__label">Median analyze (node)</span>
          <span className="summary-row__value">
            full {summary.medianAnalyzeMs.full ?? '—'} ms · minimal {summary.medianAnalyzeMs.minimal ?? '—'} ms
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-row__label">Fields regressed in minimal</span>
          <span className="summary-row__value">{summary.regressedFields.join(', ')}</span>
        </div>
      </div>
      <h3 style={{ marginTop: 16 }}>Success criteria</h3>
      <ul className="recommendation-list">
        <li>Significantly smaller raw download: {summary.successCriteria.muchSmallerRaw ? 'PASS' : 'FAIL'}</li>
        <li>Under 700 KB gzip: {summary.successCriteria.under700KbGzip ? 'PASS' : 'FAIL'}</li>
        <li>No core preflight regressions: {summary.successCriteria.noCoreRegressions ? 'PASS' : 'FAIL'}</li>
        <li>No SharedArrayBuffer required: {summary.successCriteria.noSabRequired ? 'PASS' : 'FAIL'}</li>
      </ul>
    </section>
  )
}
