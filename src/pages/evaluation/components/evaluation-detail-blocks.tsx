import type { ValidationCheckGroup, ValidationResult } from '../../../lib/ffprobe'

export function CheckGroupPanel({ group }: { group: ValidationCheckGroup }) {
  const hasIssues = group.issues.length > 0
  const highestSeverity = group.issues.some((i) => i.severity === 'error')
    ? 'error'
    : group.issues.some((i) => i.severity === 'warning')
      ? 'warning'
      : group.issues.some((i) => i.severity === 'info')
        ? 'info'
        : 'pass'

  const badgeClass =
    highestSeverity === 'error'
      ? 'badge-error'
      : highestSeverity === 'warning'
        ? 'badge-warning'
        : highestSeverity === 'info'
          ? 'badge-info'
          : 'badge-success'

  return (
    <div className="check-group">
      <div className="check-group__header">
        <h3 className="check-group__title">{group.label}</h3>
        <span className={`badge ${badgeClass}`}>
          {hasIssues ? `${group.issues.length} issue${group.issues.length === 1 ? '' : 's'}` : 'pass'}
        </span>
      </div>
      {hasIssues ? (
        <ul className="check-group__list">
          {group.issues.map((item) => (
            <li
              key={`${group.id}-${item.code}`}
              className={`check-group__item check-group__item--${item.severity}`}
            >
              <code>{item.code}</code>: {item.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="status-text check-group__empty">No issues detected.</p>
      )}
    </div>
  )
}

export function MetaItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="meta-item">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}

export function DimensionMetaItem({ validation }: { validation: ValidationResult }) {
  const { dimensions } = validation.diagnostics
  const { width, height } = validation.metadata
  const isFallback = dimensions.dimensionSource === 'codec_fallback'

  if (width && height) {
    return (
      <div className={`meta-item ${isFallback ? 'source-item--fallback' : ''}`}>
        <dt>
          Resolution {isFallback ? <span className="badge badge-fallback">fallback</span> : null}
        </dt>
        <dd>
          {width}×{height}
          {isFallback ? (
            <p className="status-text" style={{ marginTop: 6, fontWeight: 400, fontSize: 12 }}>
              Recovered from codec_width/codec_height — not detected from native width/height.
            </p>
          ) : null}
        </dd>
      </div>
    )
  }

  return (
    <>
      <MetaItem label="Normalized width" value={width} />
      <MetaItem label="Normalized height" value={height} />
    </>
  )
}

export function FieldTagSection({
  label,
  fields,
  variant,
}: {
  label: string
  fields: string[]
  variant: 'reliable' | 'unreliable' | 'fallback'
}) {
  if (fields.length === 0) return null

  return (
    <div style={{ marginTop: 12 }}>
      <p className="status-text" style={{ marginTop: 0, marginBottom: 4 }}>{label}</p>
      <div className="field-tag-list">
        {fields.map((field) => (
          <span key={field} className={`field-tag field-tag--${variant}`}>{field}</span>
        ))}
      </div>
    </div>
  )
}

export function SourceItem({
  label,
  value,
  source,
  isFallback = false,
}: {
  label: string
  value: string | number | null | undefined
  source: string
  isFallback?: boolean
}) {
  const fallback = isFallback || source.includes('fallback')

  return (
    <div className={`source-item ${fallback ? 'source-item--fallback' : ''}`}>
      <dt>
        {label} {fallback ? <span className="badge badge-fallback">fallback</span> : null}
      </dt>
      <dd className="source-item__value">{value ?? '—'}</dd>
      <dd className={`source-item__source ${fallback ? 'source-item__source--fallback' : ''}`}>
        source: {source}
      </dd>
    </div>
  )
}

export function IssueList({
  items,
  empty,
  variant,
}: {
  items: { code: string; message: string }[]
  empty: string
  variant?: 'warnings' | 'errors'
}) {
  if (items.length === 0) return <p className="status-text">{empty}</p>

  const listClass = variant === 'warnings'
    ? 'issue-list issue-list--warnings'
    : variant === 'errors'
      ? 'issue-list issue-list--errors'
      : 'issue-list'

  return (
    <ul className={listClass}>
      {items.map((item) => (
        <li key={`${item.code}-${item.message}`}>
          <code>{item.code}</code>: {item.message}
        </li>
      ))}
    </ul>
  )
}

// Shared with diagnostic callouts in the same feature area.
// eslint-disable-next-line react-refresh/only-export-components -- utility used by sibling components
export function diagnosticCalloutClass(conclusion: ValidationResult['diagnostics']['dimensions']['conclusion']): string {
  switch (conclusion) {
    case 'ok':
      return 'diagnostic-callout diagnostic-callout--success'
    case 'codec_fallback':
      return 'diagnostic-callout diagnostic-callout--fallback'
    case 'ffprobe_wasm_limitation':
    case 'normalizer_bug':
      return 'diagnostic-callout diagnostic-callout--error'
    case 'no_video_stream':
      return 'diagnostic-callout diagnostic-callout--info'
    default:
      return 'diagnostic-callout diagnostic-callout--diagnostic'
  }
}
