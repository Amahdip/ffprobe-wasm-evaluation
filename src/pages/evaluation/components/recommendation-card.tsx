import type { EngineComparisonRecommendation } from '../../../lib/comparison'

interface RecommendationCardProps {
  recommendation: EngineComparisonRecommendation | null
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  if (!recommendation) return null

  const engineLabel = recommendation.preferredEngineName ?? 'a working engine'

  return (
    <section className="card recommendation-card">
      <h2 className="card-title">Recommendation</h2>
      <ul className="recommendation-principles">
        <li>
          {recommendation.preferredEngineId ? (
            <>
              Use <strong>{engineLabel}</strong> only as a pre-upload <em>warning</em> layer when analysis
              succeeds.
            </>
          ) : (
            <>Do not prefer any browser engine when analysis fails — treat results as non-authoritative.</>
          )}
        </li>
        <li>Do not use browser analysis as authoritative validation.</li>
        <li>Keep backend/Akuma validation as the source of truth.</li>
        <li>Do not block upload solely because browser analysis fails.</li>
      </ul>
      {recommendation.reasons.length > 0 ? (
        <details className="technical-details">
          <summary>Why this recommendation</summary>
          <ul className="recommendation-list">
            {recommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
