export type ViewMode = 'overview' | 'technical' | 'logic'

interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle nav-tabs" role="group" aria-label="View mode">
      <button
        type="button"
        className={`tab-btn ${mode === 'overview' ? 'active' : ''}`}
        onClick={() => onChange('overview')}
      >
        Overview
      </button>
      <button
        type="button"
        className={`tab-btn ${mode === 'logic' ? 'active' : ''}`}
        onClick={() => onChange('logic')}
      >
        Validation logic
      </button>
      <button
        type="button"
        className={`tab-btn ${mode === 'technical' ? 'active' : ''}`}
        onClick={() => onChange('technical')}
      >
        Technical
      </button>
    </div>
  )
}

