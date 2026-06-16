import { useState, useCallback, useTransition } from 'react'
import { analyzeWithMinimalFfprobe } from './lib/ffprobe/minimal/load-minimal-ffprobe'
import { normalizeMinimalProbe } from './lib/ffprobe/minimal/normalize-minimal-metadata'
import type { MinimalProbeResult } from './lib/ffprobe/minimal/types'
import type { NormalizedMetadata } from './lib/ffprobe/types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)

  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || h > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  if (ms > 0) parts.push(`${ms}ms`)

  return parts.join(' ')
}

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawJson, setRawJson] = useState<MinimalProbeResult | null>(null)
  const [normalized, setNormalized] = useState<NormalizedMetadata | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setLoading(true)
    setError(null)
    setRawJson(null)
    setNormalized(null)
    setCopied(false)

    try {
      const { probe } = await analyzeWithMinimalFfprobe(selectedFile)
      if (!probe.ok) {
        throw new Error(probe.error || 'Failed to parse file metadata.')
      }

      startTransition(() => {
        setRawJson(probe)
        setNormalized(
          normalizeMinimalProbe(probe, {
            fileName: selectedFile.name,
            fileSizeBytes: selectedFile.size,
          })
        )
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during file analysis.')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      processFile(droppedFile)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }, [])

  const copyToClipboard = () => {
    if (!rawJson) return
    navigator.clipboard.writeText(JSON.stringify(rawJson, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetExplorer = () => {
    setFile(null)
    setRawJson(null)
    setNormalized(null)
    setError(null)
  }

  return (
    <>
      <header className="header">
        <div className="container header-content">
          <div className="logo-section">
            <div className="logo-icon">M</div>
            <div className="logo-text">Aparat ffprobe WASM</div>
          </div>
          <div className="badge badge-success" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Minimal Engine v7.1
          </div>
        </div>
      </header>

      <main className="container main-content">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 className="section-title" style={{ fontSize: 40 }}>Video Metadata Explorer</h1>
          <p className="section-subtitle" style={{ fontSize: 16 }}>
            Super lightweight client-side media probe powered by WebAssembly. No uploads to server.
          </p>
        </div>

        {!file && (
          <div
            className={`card ${isDragOver ? 'drag-over-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: isDragOver ? '2px dashed var(--primary)' : '1px dashed var(--border-color)',
              background: isDragOver ? 'rgba(34, 197, 94, 0.04)' : 'var(--bg-card)',
              padding: '60px 40px',
              textAlign: 'center',
              cursor: 'pointer',
              borderRadius: 'var(--radius-lg)',
              transition: 'var(--transition-smooth)',
              boxShadow: isDragOver ? '0 0 30px rgba(34, 197, 94, 0.1)' : 'none',
              maxWidth: 720,
              margin: '0 auto'
            }}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              type="file"
              id="fileInput"
              className="file-picker__input"
              onChange={handleFileChange}
              accept="video/*,audio/*"
            />
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <h3 style={{ fontSize: 20, margin: '0 0 8px 0', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              Drag & drop your video or audio file here
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px 0', fontSize: 14 }}>
              Supports MP4, MKV, WebM, AVI, FLV, TS, WMV, Y4M, and more
            </p>
            <button className="btn btn-primary" type="button">
              Choose File
            </button>
          </div>
        )}

        {(loading || isPending) && (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 480, margin: '0 auto' }}>
            <div className="spinner" style={{
              width: 50,
              height: 50,
              border: '3px solid rgba(34, 197, 94, 0.1)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }}></div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: '0 0 8px 0' }}>Probing media file...</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Extracting metadata client-side via WASM</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'var(--error)', padding: 24, maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: 'var(--error)', margin: '0 0 8px 0', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Analysis Failed</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--text-muted)' }}>{error}</p>
            <button className="btn btn-secondary" onClick={resetExplorer}>Try Another File</button>
          </div>
        )}

        {rawJson && normalized && !loading && !isPending && (
          <div className="grid-two-cols" style={{ alignItems: 'start' }}>
            <div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <h2 className="card-title" style={{ margin: 0 }}>File Summary</h2>
                  <button className="btn btn-secondary" onClick={resetExplorer} style={{ padding: '6px 12px', fontSize: 12 }}>
                    Analyze New File
                  </button>
                </div>

                <div className="meta-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Name</span>
                    <strong style={{ fontSize: 14, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file?.name}
                    </strong>
                  </div>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Size</span>
                    <strong style={{ fontSize: 14 }}>{file && formatBytes(file.size)}</strong>
                  </div>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Container Format</span>
                    <strong style={{ fontSize: 14, textTransform: 'uppercase' }}>{normalized.containerFormat || 'Unknown'}</strong>
                  </div>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</span>
                    <strong style={{ fontSize: 14 }}>{formatDuration(normalized.durationSeconds)}</strong>
                  </div>
                </div>

                {normalized.hasVideo && (
                  <>
                    <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '24px 0 12px', letterSpacing: '0.05em' }}>Video Stream</h3>
                    <div className="meta-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Codec</dt>
                        <dd style={{ textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700 }}>
                          {normalized.videoCodec}
                        </dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Resolution</dt>
                        <dd>{normalized.width} × {normalized.height}</dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Frame Rate</dt>
                        <dd>{normalized.fps ? `${normalized.fps.toFixed(2)} fps` : '—'}</dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Aspect Ratio</dt>
                        <dd>{normalized.displayAspectRatio || '—'}</dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Color Space</dt>
                        <dd>{normalized.colorSpace || '—'}</dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Bit Depth / Dynamic Range</dt>
                        <dd>
                          {normalized.isHdr ? (
                            <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 6px' }}>HDR</span>
                          ) : normalized.is10Bit ? (
                            <span className="badge badge-info" style={{ fontSize: 10, padding: '2px 6px' }}>10-Bit SDR</span>
                          ) : (
                            <span>8-Bit SDR</span>
                          )}
                        </dd>
                      </div>
                    </div>
                  </>
                )}

                {normalized.hasAudio && (
                  <>
                    <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '24px 0 12px', letterSpacing: '0.05em' }}>Audio Stream</h3>
                    <div className="meta-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Codec</dt>
                        <dd style={{ textTransform: 'uppercase' }}>{normalized.audioCodec}</dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Channels</dt>
                        <dd>{normalized.audioChannels === 1 ? 'Mono (1ch)' : normalized.audioChannels === 2 ? 'Stereo (2ch)' : `${normalized.audioChannels} channels`}</dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Sample Rate</dt>
                        <dd>{normalized.audioSampleRate ? `${normalized.audioSampleRate / 1000} kHz` : '—'}</dd>
                      </div>
                      <div className="meta-item" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <dt>Bitrate</dt>
                        <dd>{normalized.audioBitrateBps ? `${Math.round(normalized.audioBitrateBps / 1000)} kbps` : '—'}</dd>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 600, padding: 20, marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="card-title" style={{ margin: 0 }}>ffprobe Raw Output</h2>
                <button className={`btn ${copied ? 'btn-primary' : 'btn-secondary'}`} onClick={copyToClipboard} style={{ padding: '6px 16px', fontSize: 13 }}>
                  {copied ? '✓ Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre className="db-viewer" style={{
                flex: 1,
                margin: 0,
                maxHeight: 'none',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: '#22c55e',
                overflow: 'auto',
                fontSize: 12,
                padding: 16
              }}>
                {JSON.stringify(rawJson, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .drag-over-active {
          border-color: var(--primary) !important;
          background: rgba(34, 197, 94, 0.06) !important;
        }
      `}</style>
    </>
  )
}
