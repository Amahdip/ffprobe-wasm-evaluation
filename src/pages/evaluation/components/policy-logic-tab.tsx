import { useMemo, useState } from 'react'
import { DEFAULT_UPLOADER_POLICY } from '../../../lib/ffprobe'
import {
  buildPolicyLimitRows,
  DECISION_OUTCOMES,
  SEVERITY_LEGEND,
  VALIDATION_CHECK_GROUPS,
  type IssueSeverity,
  type ValidationCheckGroupReference,
} from '../../../lib/ffprobe/validation/reference-data'

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const badgeClass =
    severity === 'error' ? 'badge-error' : severity === 'warning' ? 'badge-warning' : 'badge-info'
  return <span className={`badge ${badgeClass}`}>{severity}</span>
}

function CheckGroupTable({ group }: { group: ValidationCheckGroupReference }) {
  return (
    <div className="table-container">
      <table className="workout-table policy-logic-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Severity</th>
            <th>When it triggers</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          {group.checks.map((check) => (
            <tr key={check.code}>
              <td><code className="policy-logic-code">{check.code}</code></td>
              <td><SeverityBadge severity={check.severity} /></td>
              <td>{check.condition}</td>
              <td className="policy-logic-impact">{check.userImpact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PolicyLogicTab() {
  const policyRows = useMemo(() => buildPolicyLimitRows(DEFAULT_UPLOADER_POLICY), [])
  const [expandedGroup, setExpandedGroup] = useState<string>('container')

  return (
    <div className="policy-logic-layout">
      <section className="card hero-card policy-logic-hero">
        <h1 className="section-title" style={{ fontSize: 28, marginBottom: 8 }}>
          Validation logic reference
        </h1>
        <p className="section-subtitle" style={{ marginBottom: 0 }}>
          How browser preflight errors, warnings, and decisions are computed. Backend/Akuma remains the source of truth —
          this layer is for pre-upload warnings only.
        </p>
      </section>

      <div className="metric-card-grid policy-logic-principles">
        <div className="metric-card metric-success">
          <div className="metric-title">Purpose</div>
          <div className="metric-value metric-value--success" style={{ fontSize: 14, fontWeight: 600 }}>
            Pre-upload warnings
          </div>
          <p className="status-text" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Fast client-side feedback before upload completes.
          </p>
        </div>
        <div className="metric-card metric-info">
          <div className="metric-title">Authority</div>
          <div className="metric-value metric-value--info" style={{ fontSize: 14, fontWeight: 600 }}>
            Backend / Akuma
          </div>
          <p className="status-text" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Final validation always happens server-side.
          </p>
        </div>
        <div className="metric-card metric-warning">
          <div className="metric-title">On probe failure</div>
          <div className="metric-value" style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)' }}>
            Never block alone
          </div>
          <p className="status-text" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Browser analysis failure → soft_fail, not a hard stop.
          </p>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Decision flow</h2>
        <p className="status-text" style={{ marginTop: 0, marginBottom: 20 }}>
          After metadata extraction, checks run in seven groups. The final decision follows this priority order.
        </p>
        <div className="decision-flow" aria-label="Validation decision flow diagram">
          <div className="decision-flow__row">
            <div className="decision-flow__node decision-flow__node--step">Upload file</div>
            <div className="decision-flow__arrow" aria-hidden>→</div>
            <div className="decision-flow__node decision-flow__node--step">ffprobe metadata</div>
            <div className="decision-flow__arrow" aria-hidden>→</div>
            <div className="decision-flow__node decision-flow__node--decision">Probe OK?</div>
          </div>
          <div className="decision-flow__branch">
            <div className="decision-flow__branch-col">
              <span className="decision-flow__branch-label">No</span>
              <div className="decision-flow__node decision-flow__node--outcome">
                <span className="badge badge-warning">SOFT FAIL</span>
              </div>
            </div>
            <div className="decision-flow__branch-col decision-flow__branch-col--main">
              <span className="decision-flow__branch-label">Yes</span>
              <div className="decision-flow__node decision-flow__node--step">Run 7 check groups</div>
              <div className="decision-flow__arrow decision-flow__arrow--down" aria-hidden>↓</div>
              <div className="decision-flow__node decision-flow__node--decision">Block codes present?</div>
              <div className="decision-flow__split">
                <div className="decision-flow__branch-col">
                  <span className="decision-flow__branch-label">Yes</span>
                  <div className="decision-flow__node decision-flow__node--outcome">
                    <span className="badge badge-error">BLOCKED</span>
                  </div>
                </div>
                <div className="decision-flow__branch-col">
                  <span className="decision-flow__branch-label">No</span>
                  <div className="decision-flow__node decision-flow__node--decision">Other errors?</div>
                  <div className="decision-flow__split decision-flow__split--compact">
                    <div className="decision-flow__branch-col">
                      <span className="decision-flow__branch-label">Yes</span>
                      <div className="decision-flow__node decision-flow__node--outcome">
                        <span className="badge badge-warning">SOFT FAIL</span>
                      </div>
                    </div>
                    <div className="decision-flow__branch-col">
                      <span className="decision-flow__branch-label">No</span>
                      <div className="decision-flow__node decision-flow__node--decision">Warnings?</div>
                      <div className="decision-flow__split decision-flow__split--compact">
                        <div className="decision-flow__branch-col">
                          <span className="decision-flow__branch-label">Yes</span>
                          <div className="decision-flow__node decision-flow__node--outcome">
                            <span className="badge badge-warning">WARNING</span>
                          </div>
                        </div>
                        <div className="decision-flow__branch-col">
                          <span className="decision-flow__branch-label">No</span>
                          <div className="decision-flow__node decision-flow__node--outcome">
                            <span className="badge badge-success">PASS</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid-two-cols">
        <section className="card">
          <h2 className="card-title">Decision outcomes</h2>
          <div className="table-container">
            <table className="workout-table policy-logic-table">
              <thead>
                <tr>
                  <th>Decision</th>
                  <th>Meaning</th>
                  <th>Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {DECISION_OUTCOMES.map((row) => (
                  <tr key={row.decision}>
                    <td><span className={`badge ${row.badgeClass}`}>{row.label}</span></td>
                    <td>{row.meaning}</td>
                    <td>{row.uploadAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Severity levels</h2>
          <div className="table-container">
            <table className="workout-table policy-logic-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {SEVERITY_LEGEND.map((row) => (
                  <tr key={row.severity}>
                    <td><span className={`badge ${row.badgeClass}`}>{row.label}</span></td>
                    <td>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="status-text" style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>
            Warnings and info are grouped together when computing the final decision.
          </p>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">Default policy limits</h2>
        <p className="status-text" style={{ marginTop: 0, marginBottom: 16 }}>
          Overview mode uses these defaults. Technical mode lets you override duration, bitrate, and A/V delta thresholds.
        </p>
        <div className="table-container">
          <table className="workout-table policy-logic-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Default value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {policyRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td><strong>{row.value}</strong></td>
                  <td className="policy-logic-impact">{row.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Check catalog</h2>
        <p className="status-text" style={{ marginTop: 0, marginBottom: 16 }}>
          All preflight issue codes grouped by category. Each code appears at most once in results.
        </p>
        <div className="policy-logic-group-tabs" role="tablist" aria-label="Check groups">
          {VALIDATION_CHECK_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={expandedGroup === group.id}
              className={`tab-btn ${expandedGroup === group.id ? 'active' : ''}`}
              onClick={() => setExpandedGroup(group.id)}
            >
              {group.label}
              <span className="policy-logic-group-count">{group.checks.length}</span>
            </button>
          ))}
        </div>
        {VALIDATION_CHECK_GROUPS.filter((g) => g.id === expandedGroup).map((group) => (
          <div key={group.id} role="tabpanel">
            <p className="status-text" style={{ margin: '16px 0 12px' }}>{group.description}</p>
            <CheckGroupTable group={group} />
          </div>
        ))}
      </section>
    </div>
  )
}
