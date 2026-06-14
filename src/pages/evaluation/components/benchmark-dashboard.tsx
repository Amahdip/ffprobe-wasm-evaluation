import type { EngineBenchmarkRow } from '../../../lib/comparison'

interface BenchmarkDashboardProps {
  benchmarks: EngineBenchmarkRow[]
}

export function BenchmarkDashboard({ benchmarks }: BenchmarkDashboardProps) {
  if (benchmarks.length === 0) return null

  const fastest = [...benchmarks]
    .filter((b) => b.success)
    .sort((a, b) => a.totalMs - b.totalMs)[0]

  return (
    <section className="card">
      <h2 className="card-title">Benchmark</h2>
      <div className="table-container">
        <table className="workout-table">
          <thead>
            <tr>
              <th>Engine</th>
              <th>Status</th>
              <th>Import ms</th>
              <th>Init ms</th>
              <th>Analyze ms</th>
              <th>Total ms</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((row) => (
              <tr key={row.engineId}>
                <td>{row.engineName}</td>
                <td>
                  <span className={`badge ${row.success ? 'badge-success' : 'badge-error'}`}>
                    {row.success ? 'ok' : 'failed'}
                  </span>
                </td>
                <td>{row.importMs.toFixed(1)}</td>
                <td>{row.initMs.toFixed(1)}</td>
                <td>{row.analyzeMs.toFixed(1)}</td>
                <td className={fastest?.engineId === row.engineId ? 'benchmark-fastest' : ''}>
                  {row.totalMs.toFixed(1)}
                  {fastest?.engineId === row.engineId ? ' ⚡' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
