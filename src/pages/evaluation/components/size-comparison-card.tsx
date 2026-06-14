import { ENGINE_SIZE_ROWS, type EngineSizeRow } from '../../../lib/evaluation/bench-summary'

export function SizeComparisonCard() {
  return (
    <section className="card">
      <h2 className="card-title">Engine size comparison</h2>
      <p className="status-text" style={{ marginTop: 0 }}>
        npm lazy chunk vs rebuilt baseline vs optimized minimal-metadata (from controlled bench build).
      </p>
      <div className="table-container">
        <table className="workout-table">
          <thead>
            <tr>
              <th>Engine</th>
              <th>Raw</th>
              <th>gzip</th>
              <th>brotli</th>
              <th>SAB / COOP-COEP</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {ENGINE_SIZE_ROWS.map((row: EngineSizeRow) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                <td>{row.raw}</td>
                <td>{row.gzip}</td>
                <td>{row.brotli}</td>
                <td>{row.coopCoepRequired ? 'required' : 'not required'}</td>
                <td className="status-text">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="recommendation-list" style={{ marginTop: 16 }}>
        <li>Initial npm lazy JS chunk in this app was ~8.5 MB raw before optimization.</li>
        <li>Rebuilt full baseline from source is ~2.2 MB raw / ~604 KB brotli (still needs pthreads + COOP/COEP).</li>
        <li>Optimized minimal-metadata is ~920 KB raw / ~401 KB brotli and removes SharedArrayBuffer requirements.</li>
      </ul>
    </section>
  )
}
