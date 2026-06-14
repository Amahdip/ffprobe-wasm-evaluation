import {
  diffStatusBadgeClass,
  diffStatusLabel,
  type EngineComparisonReport,
} from '../../../lib/comparison'

interface CompareTableProps {
  report: EngineComparisonReport
}

export function CompareTable({ report }: CompareTableProps) {
  const engineHeaders = report.fieldRows[0]?.cells.map((cell) => cell.engineName) ?? []

  return (
    <section className="card">
      <h2 className="card-title">Metadata comparison</h2>
      <p className="status-text" style={{ marginTop: 0 }}>
        {report.mismatchCount} mismatch(es), {report.missingCount} missing field(s) across engines.
      </p>
      <div className="table-container">
        <table className="workout-table compare-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Status</th>
              {engineHeaders.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.fieldRows.map((row) => (
              <tr key={row.key} className={`compare-row compare-row--${row.status}`}>
                <td>{row.label}</td>
                <td>
                  <span className={`badge ${diffStatusBadgeClass(row.status)}`}>
                    {diffStatusLabel(row.status)}
                  </span>
                </td>
                {row.cells.map((cell) => (
                  <td key={`${row.key}-${cell.engineId}`} className={cell.present ? '' : 'compare-cell--missing'}>
                    {cell.engineSuccess ? cell.value : <span className="compare-cell--failed">failed</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
