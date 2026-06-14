import type { EngineComparisonRecommendation, EngineReliabilityScore, MatrixEngineSummary } from '../../../lib/comparison'

interface EngineScorecardsProps {
  scores: EngineReliabilityScore[]
  matrixSummaries: MatrixEngineSummary[]
  recommendation: EngineComparisonRecommendation
}

export function EngineScorecards({ scores, matrixSummaries, recommendation }: EngineScorecardsProps) {
  return (
    <>
      <section className="card">
        <h2 className="card-title">Engine scorecards</h2>
        <div className="scorecard-grid">
          {scores.map((score) => {
            const matrix = matrixSummaries.find((m) => m.engineId === score.engineId)
            return (
              <div key={score.engineId} className="scorecard">
                <div className="scorecard__header">
                  <h3 className="scorecard__title">{score.engineName}</h3>
                  <span className={`badge ${score.available ? 'badge-success' : 'badge-diagnostic'}`}>
                    {score.available ? 'available' : 'pending'}
                  </span>
                </div>
                <div className="scorecard__score">
                  Reliability score:{' '}
                  <strong className={score.scorePercent >= 80 ? 'text-success' : score.scorePercent >= 50 ? 'text-warning' : 'text-error'}>
                    {score.scorePercent}%
                  </strong>
                </div>
                <dl className="scorecard__stats">
                  <div><dt>Fields detected</dt><dd>{score.fieldsDetected}/{score.fieldsTotal}</dd></div>
                  <div><dt>Fields missing</dt><dd>{score.fieldsMissing}</dd></div>
                  <div><dt>Failures</dt><dd>{score.analyzeFailures}</dd></div>
                  {matrix && matrix.total > 0 ? (
                    <div><dt>Matrix pass rate</dt><dd>{matrix.successRatePercent}% ({matrix.success}/{matrix.total})</dd></div>
                  ) : null}
                </dl>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Engine recommendation</h2>
        <div className="recommendation-card__header">
          {recommendation.preferredEngineName ? (
            <span className="badge badge-success">{recommendation.preferredEngineName}</span>
          ) : (
            <span className="badge badge-warning">undecided</span>
          )}
          <span className={`badge badge-${recommendation.confidence === 'high' ? 'success' : recommendation.confidence === 'medium' ? 'warning' : 'info'}`}>
            {recommendation.confidence} confidence
          </span>
        </div>
        <p className="recommendation-section"><strong>Recommendation:</strong> {recommendation.summary}</p>
        {recommendation.reasons.length > 0 ? (
          <ul className="recommendation-list">
            {recommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  )
}
