import { getAllEngines } from '../../../lib/engines'
import type { DecisionComparisonRow } from '../../../lib/evaluation/decision-comparison'

interface DecisionComparisonTableProps {
  rows: DecisionComparisonRow[]
}

export function DecisionComparisonTable({ rows }: DecisionComparisonTableProps) {
  const engines = getAllEngines().filter((engine) => engine.available)

  return (
    <section className="card">
      <h2 className="card-title">Engine decision comparison</h2>
      <p className="status-text" style={{ marginTop: 0 }}>
        Key fields only — full per-field diffs are in technical details.
      </p>
      <div className="table-container">
        <table className="workout-table decision-table">
          <thead>
            <tr>
              <th>Criteria</th>
              {engines.map((engine) => (
                <th key={engine.id}>{engine.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                {engines.map((engine) => {
                  const value = row.values[engine.id] ?? (engine.available ? '—' : 'Pending')
                  const failed = value === 'Failed' || value === 'Analyze failed'
                  const pending = value === 'Pending'
                  return (
                    <td
                      key={`${row.id}-${engine.id}`}
                      className={failed ? 'decision-cell--fail' : pending ? 'decision-cell--pending' : ''}
                    >
                      {value}
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
