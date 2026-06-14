import { getAllEngines } from '../../../lib/engines'

export type AnalyzeMode = 'single' | 'compare'

interface EngineSelectorProps {
  mode: AnalyzeMode
  selectedEngineId: string
  matrixEngineIds: string[]
  onModeChange: (mode: AnalyzeMode) => void
  onEngineChange: (engineId: string) => void
  onMatrixEnginesChange: (engineIds: string[]) => void
}

export function EngineSelector({
  mode,
  selectedEngineId,
  matrixEngineIds,
  onModeChange,
  onEngineChange,
  onMatrixEnginesChange,
}: EngineSelectorProps) {
  const engines = getAllEngines()

  const handleMatrixToggle = (engineId: string) => {
    if (matrixEngineIds.includes(engineId)) {
      onMatrixEnginesChange(matrixEngineIds.filter((id) => id !== engineId))
    } else {
      onMatrixEnginesChange([...matrixEngineIds, engineId])
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Analysis engines</h2>
      <div className="engine-mode-toggle">
        <button
          type="button"
          className={`tab-btn ${mode === 'single' ? 'active' : ''}`}
          onClick={() => onModeChange('single')}
        >
          Single engine
        </button>
        <button
          type="button"
          className={`tab-btn ${mode === 'compare' ? 'active' : ''}`}
          onClick={() => onModeChange('compare')}
        >
          Compare mode
        </button>
      </div>
      <p className="status-text" style={{ marginTop: 0 }}>
        {mode === 'compare'
          ? 'Runs all registered engines side-by-side on the same file.'
          : 'Runs one selected engine.'}
      </p>
      <div className="engine-list">
        {engines.map((engine) => (
          <label key={engine.id} className={`engine-card ${engine.available ? '' : 'engine-card--unavailable'}`}>
            {mode === 'single' ? (
              <input
                type="radio"
                name="engine"
                checked={selectedEngineId === engine.id}
                disabled={!engine.available && mode === 'single'}
                onChange={() => onEngineChange(engine.id)}
              />
            ) : (
              <input
                type="checkbox"
                checked={matrixEngineIds.includes(engine.id) || mode === 'compare'}
                disabled={mode === 'compare'}
                onChange={() => handleMatrixToggle(engine.id)}
              />
            )}
            <div className="engine-card__body">
              <div className="engine-card__header">
                <strong>{engine.name}</strong>
                <span className={`badge ${engine.available ? 'badge-success' : 'badge-diagnostic'}`}>
                  {engine.available ? 'available' : 'pending'}
                </span>
              </div>
              <p className="engine-card__desc">{engine.description}</p>
              {engine.capabilities.bundleImpactGzip ? (
                <span className="badge badge-performance">{engine.capabilities.bundleImpactGzip}</span>
              ) : null}
            </div>
          </label>
        ))}
      </div>
    </section>
  )
}
