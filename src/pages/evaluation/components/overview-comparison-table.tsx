import { getAllEngines } from '../../../lib/engines'
import { buildDecisionComparisonRows } from '../../../lib/evaluation/decision-comparison'
import type { EngineComparisonReport } from '../../../lib/comparison'
import type { AnalysisResult } from '../../../lib/engines/types'

interface OverviewComparisonTableProps {
  report: EngineComparisonReport | null
  results: AnalysisResult[]
}

export function OverviewComparisonTable({ report, results }: OverviewComparisonTableProps) {
  const engines = getAllEngines().filter((engine) => engine.available)
  const rows = buildDecisionComparisonRows(report, results)

  return (
    <section className="card">
      <h2 className="card-title">Engine Decision Comparison</h2>
      <div className="table-container">
        <table className="workout-table decision-table">
          <thead>
            <tr>
              <th style={{ width: '24%' }}>Criteria</th>
              {engines.map((engine) => (
                <th key={engine.id} style={{ width: '38%' }}>
                  {engine.name === 'minimal-metadata-ffprobe'
                    ? 'Minimal Metadata Engine'
                    : engine.name === 'ffprobe-wasm'
                      ? 'Standard ffprobe-wasm'
                      : engine.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600 }}>{row.label}</td>
                {engines.map((engine) => {
                  const val = row.values[engine.id] || '—'
                  const isRecommended =
                    row.id === 'risk' &&
                    engine.id === 'minimal-metadata-ffprobe'
                  const isFallback =
                    row.id === 'risk' &&
                    engine.id === 'ffprobe-wasm'

                  return (
                    <td
                      key={`${row.id}-${engine.id}`}
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {isRecommended ? (
                        <span className="text-success" style={{ fontWeight: 700 }}>
                          {val}
                        </span>
                      ) : isFallback ? (
                        <span className="text-warning">{val}</span>
                      ) : (
                        val
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

