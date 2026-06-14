import type { EngineComparisonReport } from '../../../lib/comparison'
import type { AnalysisResult } from '../../../lib/engines/types'
import { ENGINE_BUNDLE_PROFILES } from '../../../lib/evaluation/bundle-impact'
import { productionRiskLevel } from '../../../lib/evaluation/decision-comparison'

interface OverviewExecutiveSummaryProps {
  report: EngineComparisonReport | null
  results: AnalysisResult[]
}

export function OverviewExecutiveSummary({ report, results }: OverviewExecutiveSummaryProps) {
  // Determine preferred engine
  const preferredId = report?.recommendation.preferredEngineId ?? 'minimal-metadata-ffprobe'
  const profile = ENGINE_BUNDLE_PROFILES[preferredId]

  const payload = profile?.lazyChunkBrotli ?? '401 KB brotli'

  // Browser Requirements
  const browserRequirements =
    preferredId === 'ffprobe-wasm'
      ? 'Requires SharedArrayBuffer'
      : 'No SharedArrayBuffer'

  // Metadata Coverage
  let coverage = 'Core Metadata: Complete / Nice-to-have: Partial'
  if (preferredId === 'ffprobe-wasm') {
    coverage = 'Core Metadata: Complete / Nice-to-have: Complete'
  }
  if (report) {
    const preferredResult = results.find((r) => r.engineId === preferredId)
    if (preferredResult && !preferredResult.success) {
      coverage = 'Analysis failed'
    } else if (report.mismatchCount > 0 || report.missingCount > 0) {
      coverage = `Core: Complete (${report.mismatchCount} mismatch, ${report.missingCount} missing)`
    }
  }

  // Risk Level
  const risk = productionRiskLevel(report, results)
  const riskClass =
    risk.level === 'low'
      ? 'badge-success'
      : risk.level === 'medium'
        ? 'badge-warning'
        : 'badge-error'

  return (
    <div className="executive-cards" style={{ marginBottom: 24 }}>
      <div className="executive-card">
        <span className="executive-card__label">Payload</span>
        <strong className="executive-card__value">{payload}</strong>
        <span className="executive-card__hint" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {preferredId === 'minimal-metadata-ffprobe'
            ? 'Optimized standalone chunk'
            : 'Standard WebAssembly chunk'}
        </span>
      </div>

      <div className="executive-card">
        <span className="executive-card__label">Metadata Coverage</span>
        <strong className="executive-card__value" style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
          {coverage}
        </strong>
        <span className="executive-card__hint" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          For Aparat uploader preflight requirements
        </span>
      </div>

      <div className="executive-card">
        <span className="executive-card__label">Browser Requirements</span>
        <strong className="executive-card__value" style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
          {browserRequirements}
        </strong>
        <span className="executive-card__hint" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {preferredId === 'minimal-metadata-ffprobe'
            ? 'Runs on standard HTTP/HTTPS context'
            : 'Requires cross-origin isolation headers'}
        </span>
      </div>

      <div className={`executive-card executive-card--${risk.level}`}>
        <span className="executive-card__label">Production Risk</span>
        <div>
          <span className={`badge ${riskClass}`} style={{ fontSize: 12, textTransform: 'uppercase' }}>
            {risk.level}
          </span>
        </div>
        <span className="executive-card__hint" style={{ marginTop: 2 }}>
          {risk.explanation}
        </span>
      </div>
    </div>
  )
}
