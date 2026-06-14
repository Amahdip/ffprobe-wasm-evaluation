import { getAllEngines } from '../../../lib/engines'

export function OverviewComparisonTable() {
  const engines = getAllEngines().filter((engine) => engine.available)

  // Hardcoded profiles representing the overall decision characteristics for available engines
  const tableData = [
    {
      criteria: 'Payload Size',
      values: {
        'ffprobe-wasm': '2.03 MB brotli (~2.9 MB gzip)',
        'minimal-metadata-ffprobe': '401 KB brotli (~480 KB gzip)',
      },
    },
    {
      criteria: 'Metadata Coverage',
      values: {
        'ffprobe-wasm': 'Core Metadata: Complete\nNice-to-have Metadata: Complete',
        'minimal-metadata-ffprobe': 'Core Metadata: Complete\nNice-to-have: Partial',
      },
    },
    {
      criteria: 'Browser Requirements',
      values: {
        'ffprobe-wasm': 'SharedArrayBuffer / COOP-COEP (Secure Context Only)',
        'minimal-metadata-ffprobe': 'Standard Browser (No SharedArrayBuffer / COOP-COEP)',
      },
    },
    {
      criteria: 'Core Reliability',
      values: {
        'ffprobe-wasm': 'High (Standard WebAssembly build)',
        'minimal-metadata-ffprobe': 'High (matches core fields)',
      },
    },
    {
      criteria: 'Recommendation',
      values: {
        'ffprobe-wasm': 'Backup / fallback isolation context only',
        'minimal-metadata-ffprobe': 'Recommended for pre-upload warnings',
      },
    },
  ]

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
            {tableData.map((row) => (
              <tr key={row.criteria}>
                <td style={{ fontWeight: 600 }}>{row.criteria}</td>
                {engines.map((engine) => {
                  const val = row.values[engine.id as keyof typeof row.values] || '—'
                  const isRecommended =
                    row.criteria === 'Recommendation' &&
                    engine.id === 'minimal-metadata-ffprobe'
                  const isFallback =
                    row.criteria === 'Recommendation' &&
                    engine.id === 'ffprobe-wasm'

                  return (
                    <td
                      key={`${row.criteria}-${engine.id}`}
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
