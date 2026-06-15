import type { AnalyzeMode } from './engine-selector'

interface BundleImpactCardProps {
  mode?: AnalyzeMode
  selectedEngineId?: string
}

export function BundleImpactCard({
  mode: _mode,
  selectedEngineId: _selectedEngineId,
}: BundleImpactCardProps = {}) {
  void _mode
  void _selectedEngineId
  const tableData = [
    {
      metric: 'Raw payload',
      ffprobe: { value: '~8.5 MB', type: 'warn' }, // Amber
      minimal: { value: '~1.1 MB', type: 'success' }, // Green
    },
    {
      metric: 'Gzip payload',
      ffprobe: { value: '~2.9 MiB', type: 'warn' },
      minimal: { value: '~510 KB', type: 'success' },
    },
    {
      metric: 'Wasm delivery',
      ffprobe: { value: 'embedded in lazy JS chunk', type: 'neutral' }, // Gray
      minimal: { value: 'standalone .wasm + lazy loader', type: 'neutral' },
    },
    {
      metric: 'Lazy-loaded',
      ffprobe: { value: 'yes', type: 'neutral' },
      minimal: { value: 'yes', type: 'neutral' },
    },
    {
      metric: 'COOP/COEP required',
      ffprobe: { value: 'required', type: 'warn' },
      minimal: { value: 'not required', type: 'success' },
    },
    {
      metric: 'SharedArrayBuffer required',
      ffprobe: { value: 'required', type: 'warn' },
      minimal: { value: 'not required', type: 'success' },
    },
    {
      metric: 'First-use cost',
      ffprobe: { value: 'high', type: 'warn' },
      minimal: { value: 'low', type: 'success' },
    },
    {
      metric: 'Cache recommendation',
      ffprobe: { value: 'Cache in service worker / browser cache', type: 'neutral' },
      minimal: { value: 'Cache in service worker / browser cache', type: 'neutral' },
    },
  ]

  const getStyleForType = (type: string) => {
    switch (type) {
      case 'success':
        return { color: 'var(--success)', fontWeight: 600 }
      case 'warn':
        return { color: 'var(--warning)', fontWeight: 600 }
      default:
        return { color: 'var(--text-muted)' }
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* 1. App shell bundle summary */}
      <section className="card" style={{ marginBottom: 0 }}>
        <h2 className="card-title">App shell bundle summary</h2>
        <p className="status-text" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          App-level initial load metrics (excludes lazy engine payloads).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="executive-card" style={{ padding: '12px 14px' }}>
            <span className="executive-card__label" style={{ fontSize: 10 }}>Main app shell bundle</span>
            <strong className="executive-card__value" style={{ fontSize: 16 }}>~63 KiB gzip</strong>
          </div>
          <div className="executive-card" style={{ padding: '12px 14px' }}>
            <span className="executive-card__label" style={{ fontSize: 10 }}>Engine code in main bundle</span>
            <strong className="executive-card__value" style={{ fontSize: 16, color: 'var(--success)' }}>No</strong>
          </div>
          <div className="executive-card" style={{ padding: '12px 14px' }}>
            <span className="executive-card__label" style={{ fontSize: 10 }}>Engines are lazy-loaded</span>
            <strong className="executive-card__value" style={{ fontSize: 16, color: 'var(--success)' }}>Yes</strong>
          </div>
        </div>
      </section>

      {/* 2. Engine Payload Comparison */}
      <section className="card" style={{ marginBottom: 0 }}>
        <h2 className="card-title">Engine Payload Comparison</h2>
        <p className="status-text" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          Side-by-side comparison of the preflight engine payload costs.
        </p>
        <div className="table-container">
          <table className="workout-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Metric</th>
                <th style={{ width: '35%' }}>ffprobe-wasm npm</th>
                <th style={{ width: '35%' }}>minimal-metadata</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.metric}>
                  <td style={{ fontWeight: 600 }}>{row.metric}</td>
                  <td style={getStyleForType(row.ffprobe.type)}>{row.ffprobe.value}</td>
                  <td style={getStyleForType(row.minimal.type)}>{row.minimal.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Production Implication Takeaway */}
      <section className="card" style={{ marginBottom: 0, borderColor: 'rgba(34, 197, 94, 0.25)', background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.04), rgba(0, 0, 0, 0.1))' }}>
        <h2 className="card-title" style={{ color: 'var(--success)', margin: 0, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Production Implication
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5, fontWeight: 500 }}>
          “Minimal-metadata is the better production candidate because it keeps the app bundle clean, reduces first-use engine download cost, and removes COOP/COEP requirements.”
        </p>
      </section>
    </div>
  )
}
