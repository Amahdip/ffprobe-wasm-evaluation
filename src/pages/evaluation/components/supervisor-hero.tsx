import type { EngineComparisonRecommendation } from '../../../lib/comparison'

interface SupervisorHeroProps {
  recommendation: EngineComparisonRecommendation | null
  hasAnalysis: boolean
  onAnalyze: () => void
  onExportReport: () => void
  canAnalyze: boolean
  isAnalyzing: boolean
  analyzeLabel: string
  canExport: boolean
}

export function SupervisorHero({
  recommendation,
  hasAnalysis,
  onAnalyze,
  onExportReport,
  canAnalyze,
  isAnalyzing,
  analyzeLabel,
  canExport,
}: SupervisorHeroProps) {
  const preferred = recommendation?.preferredEngineName
  const badgeClass =
    !preferred
      ? 'badge-error'
      : recommendation?.confidence === 'high'
        ? 'badge-success'
        : recommendation?.confidence === 'medium'
          ? 'badge-warning'
          : 'badge-error'

  return (
    <section className="card hero-card">
      <h1 className="hero-card__title">Uploader Preflight Engine Evaluation</h1>
      {preferred ? (
        <>
          <div className="hero-card__badges">
            <span className={`badge ${badgeClass}`}>Recommended: {preferred}</span>
            {recommendation?.confidence ? (
              <span className="badge badge-info">{recommendation.confidence} confidence</span>
            ) : null}
          </div>
          <p className="hero-card__reason">{recommendation?.summary}</p>
        </>
      ) : hasAnalysis ? (
        <>
          <div className="hero-card__badges">
            <span className="badge badge-error">No engine recommended</span>
          </div>
          <p className="hero-card__reason">
            {recommendation?.summary ?? 'Browser analysis did not produce a reliable engine preference.'}
          </p>
        </>
      ) : (
        <p className="hero-card__reason">
          Compare browser engines for pre-upload warnings. Backend/Akuma remains authoritative.
        </p>
      )}
      <div className="btn-row hero-card__actions">
        <button type="button" className="btn btn-primary" disabled={!canAnalyze || isAnalyzing} onClick={onAnalyze}>
          {isAnalyzing ? 'Analyzing…' : analyzeLabel}
        </button>
        <button type="button" className="btn btn-secondary" disabled={!canExport} onClick={onExportReport}>
          Export report
        </button>
        <a className="btn btn-secondary" href="#technical-details">
          View technical details
        </a>
      </div>
      {!hasAnalysis ? (
        <p className="status-text">Upload a video below to compare engines on your file.</p>
      ) : null}
    </section>
  )
}
