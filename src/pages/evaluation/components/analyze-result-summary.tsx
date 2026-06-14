import { decisionBadgeClass } from '../../../lib/ffprobe'
import type { AnalysisResult } from '../../../lib/engines/types'

interface AnalyzeResultSummaryProps {
  results: AnalysisResult[]
}

export function AnalyzeResultSummary({ results }: AnalyzeResultSummaryProps) {
  if (results.length === 0) return null

  return (
    <section className="card">
      <h2 className="card-title">Upload analysis summary</h2>
      <div className="engine-result-grid">
        {results.map((result) => (
          <div key={result.engineId} className="engine-result-card">
            <div className="engine-result-card__header">
              <h3>{result.engineName}</h3>
              <span className={`badge ${result.success ? 'badge-success' : 'badge-error'}`}>
                {result.success ? 'OK' : 'Failed'}
              </span>
            </div>

            {result.error ? (
              <p className="status-error engine-result-card__error">{result.error}</p>
            ) : null}

            {result.validation ? (
              <p className="engine-result-card__decision">
                Decision:{' '}
                <span className={decisionBadgeClass(result.validation.decision)}>
                  {result.validation.decision}
                </span>
              </p>
            ) : (
              <p className="status-error">{result.error ?? 'No validation result'}</p>
            )}

            {result.validation?.warnings.length ? (
              <div className="engine-result-card__section">
                <strong>Warnings</strong>
                <ul className="compact-issue-list">
                  {result.validation.warnings.slice(0, 4).map((w) => (
                    <li key={`${w.code}-${w.message}`}>{w.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.metadata && result.success ? (
              <dl className="compact-meta">
                <div><dt>Container</dt><dd>{result.metadata.containerFormat ?? '—'}</dd></div>
                <div><dt>Video</dt><dd>{result.metadata.videoCodec ?? '—'}</dd></div>
                <div><dt>Audio</dt><dd>{result.metadata.audioCodec ?? '—'}</dd></div>
                <div><dt>Duration</dt><dd>{result.metadata.durationSeconds != null ? `${result.metadata.durationSeconds.toFixed(1)}s` : '—'}</dd></div>
                <div><dt>Resolution</dt><dd>{result.metadata.width && result.metadata.height ? `${result.metadata.width}×${result.metadata.height}` : '—'}</dd></div>
                <div><dt>FPS</dt><dd>{result.metadata.fps?.toFixed(0) ?? '—'}</dd></div>
              </dl>
            ) : null}

            <details className="technical-details">
              <summary>Show raw output</summary>
              <pre className="db-viewer">{JSON.stringify(result.rawOutput, null, 2)}</pre>
            </details>
          </div>
        ))}
      </div>
    </section>
  )
}
