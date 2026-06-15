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
              <th style={{ width: '25%', whiteSpace: 'nowrap' }}>Engine</th>
              <th style={{ width: '10%', whiteSpace: 'nowrap' }}>Raw</th>
              <th style={{ width: '10%', whiteSpace: 'nowrap' }}>Gzip</th>
              <th style={{ width: '10%', whiteSpace: 'nowrap' }}>Brotli</th>
              <th style={{ width: '15%', whiteSpace: 'nowrap' }}>SAB / COOP-COEP</th>
              <th style={{ width: '30%' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {ENGINE_SIZE_ROWS.map((row: EngineSizeRow) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.label}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{row.raw}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{row.gzip}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{row.brotli}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className={row.coopCoepRequired ? 'badge badge-error' : 'badge badge-success'} style={{ fontSize: '11px', padding: '2px 6px', fontWeight: 600 }}>
                    {row.coopCoepRequired ? 'required' : 'not required'}
                  </span>
                </td>
                <td className="status-text" style={{ fontSize: '12px' }}>{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="recommendation-list" style={{ marginTop: 16 }}>
        <li>Initial npm lazy JS chunk in this app was ~8.5 MB raw before optimization.</li>
        <li>Rebuilt full baseline from source is ~2.2 MB raw / ~604 KB brotli (still needs pthreads + COOP/COEP).</li>
        <li>Optimized minimal-metadata is ~1.1 MB raw / ~430 KB brotli and removes SharedArrayBuffer requirements.</li>
      </ul>
    </section>
  )
}
