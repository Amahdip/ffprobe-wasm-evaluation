import { useCallback, useState } from 'react'
import { walkVideoPackets } from '../lib/bitrate-poc/walk-packets'
import { analyzePackets, DEFAULT_POC_OPTIONS, type PocOptions, type PocResult } from '../lib/bitrate-poc/analyze'

interface Bench {
  fileName: string
  fileBytes: number
  packetCount: number
  importMs: number
  walkMs: number
  mathMs: number
  renderMs: number
  totalMs: number
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${u[i]}`
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return m > 0 ? `${m}m ${r}s` : `${r}s`
}

function windowSourceLabel(source: PocResult['chosen']['source']): string {
  switch (source) {
    case 'sliding-peak':
      return 'sliding peak (heaviest motion window)'
    case 'midpoint-cbr':
      return 'midpoint (CBR source — flat distribution)'
    case 'whole-video':
      return 'whole video (shorter than one window)'
  }
}

/** Dependency-free SVG histogram of the segment-size bell curve. */
function Histogram({ result }: { result: PocResult }) {
  const { counts, labels } = result.histogram
  const max = Math.max(1, ...counts)
  const W = 720
  const H = 240
  const pad = { l: 36, r: 12, t: 12, b: 48 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const bw = innerW / counts.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Segment size histogram">
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + innerH * (1 - f)
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--border-color)" strokeWidth={1} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-muted)">
              {Math.round(max * f)}
            </text>
          </g>
        )
      })}
      {counts.map((c, i) => {
        const h = (c / max) * innerH
        const x = pad.l + i * bw
        const y = pad.t + innerH - h
        return (
          <rect key={i} x={x + 1} y={y} width={Math.max(1, bw - 2)} height={h} fill="var(--primary)" opacity={0.85}>
            <title>{`${labels[i]} Mbit — ${c} segment(s)`}</title>
          </rect>
        )
      })}
      {labels.map((lbl, i) =>
        i % Math.ceil(labels.length / 6) === 0 ? (
          <text key={i} x={pad.l + i * bw + bw / 2} y={H - pad.b + 16} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
            {lbl.split('–')[0]}
          </text>
        ) : null,
      )}
      <text x={pad.l + innerW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
        Segment size (Mbit, non-keyframe bytes per {DEFAULT_POC_OPTIONS.windowSeconds}s window)
      </text>
    </svg>
  )
}

/** Per-bin bitrate timeline — chosen window highlighted in amber. */
function Timeline({ result }: { result: PocResult }) {
  const bins = result.bins
  const max = Math.max(1, ...bins.map((b) => b.bitrateBps))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80, marginTop: 8 }}>
      {bins.map((b) => {
        const h = (b.bitrateBps / max) * 100
        const isChosen = b.startSec >= result.chosen.startSec && b.startSec < result.chosen.endSec
        return (
          <div
            key={b.index}
            title={`${fmtSec(b.startSec)} — ${(b.bitrateBps / 1000).toFixed(0)} kbps`}
            style={{
              flex: 1,
              height: `${h}%`,
              background: isChosen ? 'var(--warning, #f59e0b)' : 'var(--primary)',
              opacity: isChosen ? 1 : 0.55,
              borderRadius: 2,
            }}
          />
        )
      })}
    </div>
  )
}

const EMPTY_RAW: Record<keyof PocOptions, string> = {
  windowSeconds: '',
  slideSeconds: '',
  headroomFactor: '',
  cbrThreshold: '',
  histogramBuckets: '',
}

export default function BitratePocPage() {
  const [raw, setRaw] = useState<Record<keyof PocOptions, string>>(EMPTY_RAW)
  const [usedOpts, setUsedOpts] = useState<PocOptions>(DEFAULT_POC_OPTIONS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PocResult | null>(null)
  const [bench, setBench] = useState<Bench | null>(null)

  const resolveOpts = useCallback((): PocOptions => {
    const num = (s: string, d: number) => {
      const n = Number(s)
      return s.trim() === '' || Number.isNaN(n) ? d : n
    }
    return {
      windowSeconds: num(raw.windowSeconds, DEFAULT_POC_OPTIONS.windowSeconds),
      slideSeconds: num(raw.slideSeconds, DEFAULT_POC_OPTIONS.slideSeconds),
      headroomFactor: num(raw.headroomFactor, DEFAULT_POC_OPTIONS.headroomFactor),
      cbrThreshold: num(raw.cbrThreshold, DEFAULT_POC_OPTIONS.cbrThreshold),
      histogramBuckets: num(raw.histogramBuckets, DEFAULT_POC_OPTIONS.histogramBuckets),
    }
  }, [raw])

  const runWasm = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      setResult(null)
      setBench(null)
      try {
        const opts = resolveOpts()
        setUsedOpts(opts)
        const t0 = performance.now()
        const walk = await walkVideoPackets(file)
        const res = analyzePackets(walk.packets, opts)
        const renderStart = performance.now()
        setResult(res)
        requestAnimationFrame(() => {
          const renderMs = performance.now() - renderStart
          setBench({
            fileName: file.name,
            fileBytes: file.size,
            packetCount: res.packetCount,
            importMs: walk.timings.importMs,
            walkMs: walk.timings.analyzeMs,
            mathMs: res.mathMs,
            renderMs,
            totalMs: performance.now() - t0,
          })
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'walk failed')
      } finally {
        setBusy(false)
      }
    },
    [resolveOpts],
  )

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) void runWasm(f)
    },
    [runWasm],
  )

  const numField = (label: string, key: keyof PocOptions) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={raw[key]}
        placeholder={String(DEFAULT_POC_OPTIONS[key])}
        onChange={(ev) => setRaw((o) => ({ ...o, [key]: ev.target.value }))}
        className="input"
        style={{ width: 110, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
      />
    </label>
  )

  return (
    <main className="container main-content" style={{ paddingTop: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <a href="#/" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to Metadata Explorer</a>
        <h1 className="section-title" style={{ fontSize: 34, marginTop: 12 }}>Dynamic Max-Bitrate PoC</h1>
        <p className="section-subtitle" style={{ fontSize: 15 }}>
          Select a local video file. The tool reads packet sizes without decoding,
          finds the busiest {DEFAULT_POC_OPTIONS.windowSeconds}-second window, and estimates a safe maxrate ceiling.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {numField('Window seconds', 'windowSeconds')}
          {numField('Headroom ×', 'headroomFactor')}
          {numField('CBR threshold (CV)', 'cbrThreshold')}
          {numField('Histogram buckets', 'histogramBuckets')}
          <div style={{ marginLeft: 'auto' }}>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              {busy ? 'Walking packets…' : 'Select video & analyse'}
              <input type="file" accept="video/*,.mp4,.mov,.mkv,.webm,.ts,.avi" onChange={onFile} style={{ display: 'none' }} disabled={busy} />
            </label>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '12px 0 0' }}>
          Requires the WASM rebuilt with <code>walk_video_packets</code> — see <code>docs/bitrate-poc.md</code>.
          Leave any field blank to use its default.
        </p>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--error)', padding: 20, color: 'var(--error)' }}>
          {error}
        </div>
      )}

      {result && bench && (
        <>
          <div className="grid-two-cols" style={{ alignItems: 'start', gap: 20 }}>
            <div className="card">
              <h2 className="card-title">Chosen Time-Span</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 10, columnGap: 16, fontSize: 14, marginTop: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Window</span>
                <strong style={{ color: 'var(--primary)', fontSize: 16 }}>{fmtSec(result.chosen.startSec)} – {fmtSec(result.chosen.endSec)}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Selected by</span>
                <strong>{windowSourceLabel(result.chosen.source)}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Source type</span>
                <strong>
                  {result.isSourceCBR ? (
                    <span className="badge badge-warning">CBR · CV {result.cv.toFixed(3)}</span>
                  ) : (
                    <span className="badge badge-success">VBR · CV {result.cv.toFixed(3)}</span>
                  )}
                </strong>
                <span style={{ color: 'var(--text-muted)' }}>Estimated maxrate</span>
                <strong style={{ fontSize: 16 }}>{result.maxBitrateKbps.toLocaleString()} kbps</strong>
                <span style={{ color: 'var(--text-muted)' }}>Duration</span>
                <strong>{fmtSec(result.durationSec)}</strong>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Performance</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 10, columnGap: 16, fontSize: 14, marginTop: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>File</span>
                <strong style={{ wordBreak: 'break-all' }}>{bench.fileName}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Size</span>
                <strong>{fmtBytes(bench.fileBytes)}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Packets read</span>
                <strong>{bench.packetCount.toLocaleString()}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Demux time</span>
                <strong>{bench.walkMs.toFixed(0)} ms</strong>
                <span style={{ color: 'var(--text-muted)' }}>Demux throughput</span>
                <strong>{(bench.fileBytes / 1e6 / (bench.walkMs / 1000)).toFixed(0)} MB/s</strong>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Total time</span>
                <strong style={{ fontWeight: 800 }}>{bench.totalMs.toFixed(0)} ms</strong>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h2 className="card-title">Segment bitrate distribution</h2>
            <Histogram result={result} />
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 0' }}>
              Timeline <span style={{ color: 'var(--warning, #f59e0b)' }}>■ Chosen window</span>
            </h3>
            <Timeline result={result} />
          </div>
        </>
      )}
    </main>
  )
}
