export type ViewMode = 'overview' | 'technical'

interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        className={`tab-btn ${mode === 'overview' ? 'active' : ''}`}
        onClick={() => onChange('overview')}
      >
        Overview Mode
      </button>
      <button
        type="button"
        className={`tab-btn ${mode === 'technical' ? 'active' : ''}`}
        onClick={() => onChange('technical')}
      >
        Technical Mode
      </button>
    </div>
  )
}

