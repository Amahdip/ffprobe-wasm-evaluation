import type { EngineComparisonReport } from '../../../lib/comparison'
import type { AnalysisResult } from '../../../lib/engines/types'
import { ENGINE_BUNDLE_PROFILES } from '../../../lib/evaluation/bundle-impact'
import { productionRiskLevel } from '../../../lib/evaluation/decision-comparison'

interface ExecutiveSummaryCardsProps {
  report: EngineComparisonReport | null
  results: AnalysisResult[]
}

export function ExecutiveSummaryCards({ report, results }: ExecutiveSummaryCardsProps) {
  const preferredId = report?.recommendation.preferredEngineId
  const preferredName = report?.recommendation.preferredEngineName ?? 'Pending analysis'
  const payload = preferredId ? ENGINE_BUNDLE_PROFILES[preferredId]?.lazyChunkBrotli ?? '—' : '—'

  const metadataNote =
    !report
      ? 'Run analysis'
      : report.mismatchCount === 0 && report.missingCount === 0
        ? 'No regressions on file'
        : `${report.mismatchCount} mismatch · ${report.missingCount} missing`

  const risk = productionRiskLevel(report, results)
  const riskClass =
    risk.level === 'low' ? 'metric-success' : risk.level === 'medium' ? 'metric-warning' : 'metric-error'

  return (
    <div className="executive-cards">
      <div className="executive-card">
        <span className="executive-card__label">Best engine</span>
        <strong className="executive-card__value">{preferredName}</strong>
      </div>
      <div className="executive-card">
        <span className="executive-card__label">Payload</span>
        <strong className="executive-card__value">{payload}</strong>
      </div>
      <div className="executive-card">
        <span className="executive-card__label">Core metadata</span>
        <strong className="executive-card__value">{metadataNote}</strong>
      </div>
      <div className={`executive-card executive-card--${risk.level}`}>
        <span className="executive-card__label">Production risk</span>
        <strong className={`executive-card__value ${riskClass}`}>{risk.level}</strong>
        <span className="executive-card__hint">{risk.explanation}</span>
      </div>
    </div>
  )
}
