import { useState, useCallback, useTransition, useEffect } from 'react'
import { analyzeWithMinimalFfprobe } from './lib/ffprobe/minimal/load-minimal-ffprobe'
import { normalizeMinimalProbe } from './lib/ffprobe/minimal/normalize-minimal-metadata'
import type { MinimalProbeResult } from './lib/ffprobe/minimal/types'
import type { NormalizedMetadata } from './lib/ffprobe/types'

// Professional Inline SVGs
const FolderIcon = ({ size = 20, style = {} }: { size?: number; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
)

const ChartIcon = ({ size = 20, style = {} }: { size?: number; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
)

const WarningIcon = ({ size = 20, style = {} }: { size?: number; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
)

const CopyIcon = ({ size = 16, style = {} }: { size?: number; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
)

const CheckIcon = ({ size = 16, style = {} }: { size?: number; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
)

const SunIcon = ({ size = 18, style = {} }: { size?: number; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
)

const MoonIcon = ({ size = 18, style = {} }: { size?: number; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
)

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

function renderJsonWithDiff(
  fullObj: any, 
  minObj: any, 
  path = '', 
  indent = 0
): React.ReactNode {
  const spacing = '  '.repeat(indent);

  if (fullObj === null) return <span style={{ color: 'var(--text-muted)' }}>null</span>;
  if (typeof fullObj !== 'object') {
    if (typeof fullObj === 'string') {
      return <span style={{ color: 'var(--primary)' }}>"{fullObj}"</span>;
    }
    return <span style={{ color: 'var(--info)' }}>{String(fullObj)}</span>;
  }

  const isArray = Array.isArray(fullObj);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  const keys = Object.keys(fullObj);
  if (keys.length === 0) {
    return <span>{openBracket}{closeBracket}</span>;
  }

  return (
    <span>
      {openBracket}
      {'\n'}
      {keys.map((key, i) => {
        const currentPath = isArray 
          ? `${path}[${key}]` 
          : (path ? `${path}.${key}` : key);

        let isMissing = false;
        if (minObj === undefined || minObj === null) {
          isMissing = true;
        } else if (isArray) {
          const index = parseInt(key, 10);
          isMissing = minObj[index] === undefined;
        } else {
          isMissing = !(key in minObj) || minObj[key] === null || minObj[key] === undefined;
        }

        const nextMinObj = (!isMissing && minObj) ? minObj[key] : undefined;
        const lineStyle = isMissing 
          ? { color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 4, width: 'fit-content', paddingRight: 6 } 
          : {};

        return (
          <div key={key} style={{ ...lineStyle, paddingLeft: (indent + 1) * 16, display: 'block', whiteSpace: 'pre-wrap' }}>
            {!isArray && <span style={{ color: 'var(--text-muted)' }}>"{key}"</span>}
            {!isArray && ': '}
            {renderJsonWithDiff(fullObj[key], nextMinObj, currentPath, indent + 1)}
            {i < keys.length - 1 && ','}
          </div>
        );
      })}
      {spacing}{closeBracket}
    </span>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const [file, setFile] = useState<File | null>(null)
  const [dragCounter, setDragCounter] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawJson, setRawJson] = useState<MinimalProbeResult | null>(null)
  const [fullJson, setFullJson] = useState<any | null>(null)
  const [viewMode, setViewMode] = useState<'minimal' | 'full'>('minimal')
  const [normalized, setNormalized] = useState<NormalizedMetadata | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isDragOver = dragCounter > 0

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragCounter(prev => prev + 1)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragCounter(prev => prev - 1)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setLoading(true)
    setError(null)
    setRawJson(null)
    setFullJson(null)
    setNormalized(null)
    setCopied(false)

    try {
      // Run both minimal WASM and native system ffprobe CLI in parallel
      const [minimalRes, systemCliRes] = await Promise.all([
        analyzeWithMinimalFfprobe(selectedFile).catch(err => {
          throw new Error(err instanceof Error ? err.message : 'Minimal probe failed.')
        }),
        fetch('/api/ffprobe', {
          method: 'POST',
          headers: {
            'x-file-name': encodeURIComponent(selectedFile.name),
          },
          body: selectedFile,
        })
          .then(async res => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}))
              throw new Error(errData.error || `HTTP error ${res.status}`)
            }
            return res.json()
          })
          .catch(err => {
            console.warn('System ffprobe CLI failed:', err)
            return null
          })
      ])

      const { probe } = minimalRes
      if (!probe.ok) {
        throw new Error(probe.error || 'Failed to parse file metadata.')
      }

      startTransition(() => {
        setRawJson(probe)
        setFullJson(systemCliRes)
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
    setDragCounter(0)
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
    const targetJson = viewMode === 'minimal' ? rawJson : fullJson
    if (!targetJson) return
    navigator.clipboard.writeText(JSON.stringify(targetJson, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetExplorer = () => {
    setFile(null)
    setRawJson(null)
    setFullJson(null)
    setViewMode('minimal')
    setNormalized(null)
    setError(null)
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ minHeight: '100vh', position: 'relative' }}
    >
      <input
        type="file"
        id="fileInput"
        className="file-picker__input"
        onChange={handleFileChange}
        accept="video/*,audio/*,.mp4,.mov,.m4a,.3gp,.3g2,.mj2,.mkv,.mka,.webm,.avi,.flv,.mp3,.wav,.aac,.ogg,.ogv,.ts,.m2ts,.mpg,.mpeg,.mpv,.asf,.wmv,.y4m,.hevc,.f4v,.m2v,.m4v,.mjpeg"
        style={{ display: 'none' }}
      />

      {isDragOver && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(8px)',
            border: '4px dashed var(--primary)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <FolderIcon size={64} style={{ marginBottom: 20, animation: 'bounce 1.5s infinite', color: 'var(--primary)' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--primary)', margin: '0 0 8px 0' }}>
            Drop file anywhere to analyze
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 16 }}>
            Supports video and audio files
          </p>
        </div>
      )}

      <header className="header">
        <div className="container header-content">
          <div className="logo-section" onClick={resetExplorer} style={{ cursor: 'pointer' }} title="Reset Explorer">
            <div className="logo-icon">M</div>
            <div className="logo-text">Aparat ffprobe WASM</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{
                width: 36,
                height: 36,
                padding: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
              type="button"
            >
              {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <div className="badge badge-success" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Minimal Engine v7.1
            </div>
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
            <FolderIcon size={48} style={{ marginBottom: 16, color: 'var(--primary)', margin: '0 auto 16px' }} />
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
            <WarningIcon size={32} style={{ marginBottom: 12, color: 'var(--error)', margin: '0 auto 12px' }} />
            <h3 style={{ color: 'var(--error)', margin: '0 0 8px 0', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Analysis Failed</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--text-muted)' }}>{error}</p>
            <button className="btn btn-secondary" onClick={resetExplorer}>Try Another File</button>
          </div>
        )}

        {rawJson && normalized && !loading && !isPending && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 20px',
              marginBottom: 20,
              backdropFilter: 'var(--glass-filter)',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ChartIcon size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    Analysis for: <span style={{ color: 'var(--primary)' }}>{file?.name}</span>
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    {file && formatBytes(file.size)} • {formatDuration(normalized.durationSeconds)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => document.getElementById('fileInput')?.click()}
                  style={{ padding: '8px 16px', fontSize: 13, gap: 6 }}
                >
                  <FolderIcon size={14} /> Analyze Another File
                </button>
              </div>
            </div>

            <div className="grid-two-cols" style={{ alignItems: 'start' }}>
              <div>
                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                    <h2 className="card-title" style={{ margin: 0 }}>File Summary</h2>
                  </div>

                <div className="meta-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Name</span>
                    <strong style={{ fontSize: 14, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file?.name}
                    </strong>
                  </div>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Size</span>
                    <strong style={{ fontSize: 14 }}>{file && formatBytes(file.size)}</strong>
                  </div>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Container Format</span>
                    <strong style={{ fontSize: 14, textTransform: 'uppercase' }}>{normalized.containerFormat || 'Unknown'}</strong>
                  </div>
                  <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</span>
                    <strong style={{ fontSize: 14 }}>{formatDuration(normalized.durationSeconds)}</strong>
                  </div>
                </div>

                {normalized.hasVideo && (
                  <>
                    <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '24px 0 12px', letterSpacing: '0.05em' }}>Video Stream</h3>
                    <div className="meta-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="meta-item">
                        <dt>Codec</dt>
                        <dd style={{ textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700 }}>
                          {normalized.videoCodec}
                        </dd>
                      </div>
                      <div className="meta-item">
                        <dt>Resolution</dt>
                        <dd>{normalized.width} × {normalized.height}</dd>
                      </div>
                      <div className="meta-item">
                        <dt>Frame Rate</dt>
                        <dd>{normalized.fps ? `${normalized.fps.toFixed(2)} fps` : '—'}</dd>
                      </div>
                      <div className="meta-item">
                        <dt>Aspect Ratio</dt>
                        <dd>{normalized.displayAspectRatio || '—'}</dd>
                      </div>
                      <div className="meta-item">
                        <dt>Color Space</dt>
                        <dd>{normalized.colorSpace || '—'}</dd>
                      </div>
                      <div className="meta-item">
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
                      <div className="meta-item">
                        <dt>Codec</dt>
                        <dd style={{ textTransform: 'uppercase' }}>{normalized.audioCodec}</dd>
                      </div>
                      <div className="meta-item">
                        <dt>Channels</dt>
                        <dd>{normalized.audioChannels === 1 ? 'Mono (1ch)' : normalized.audioChannels === 2 ? 'Stereo (2ch)' : `${normalized.audioChannels} channels`}</dd>
                      </div>
                      <div className="meta-item">
                        <dt>Sample Rate</dt>
                        <dd>{normalized.audioSampleRate ? `${normalized.audioSampleRate / 1000} kHz` : '—'}</dd>
                      </div>
                      <div className="meta-item">
                        <dt>Bitrate</dt>
                        <dd>{normalized.audioBitrateBps ? `${Math.round(normalized.audioBitrateBps / 1000)} kbps` : '—'}</dd>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 600, padding: 20, marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h2 className="card-title" style={{ margin: 0 }}>ffprobe Raw Output</h2>
                
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-well)', padding: 4, borderRadius: '20px' }}>
                  <button 
                    className={`tab-btn ${viewMode === 'minimal' ? 'active' : ''}`}
                    onClick={() => setViewMode('minimal')}
                    style={{ 
                      padding: '4px 12px', 
                      fontSize: 12, 
                      border: 'none', 
                      cursor: 'pointer', 
                      borderRadius: '15px',
                      background: viewMode === 'minimal' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'minimal' ? '#000' : 'var(--text-muted)',
                      fontWeight: viewMode === 'minimal' ? 700 : 500
                    }}
                    type="button"
                  >
                    Minimal WASM
                  </button>
                  <button 
                    className={`tab-btn ${viewMode === 'full' ? 'active' : ''}`}
                    onClick={() => setViewMode('full')}
                    style={{ 
                      padding: '4px 12px', 
                      fontSize: 12, 
                      border: 'none', 
                      cursor: 'pointer', 
                      borderRadius: '15px',
                      background: viewMode === 'full' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'full' ? '#000' : 'var(--text-muted)',
                      fontWeight: viewMode === 'full' ? 700 : 500
                    }}
                    type="button"
                  >
                    System ffprobe CLI (Diff)
                  </button>
                </div>

                <button
                  className={`btn ${copied ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={copyToClipboard}
                  style={{ padding: '6px 16px', fontSize: 13, gap: 6 }}
                >
                  {copied ? (
                    <>
                      <CheckIcon size={14} /> Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon size={14} /> Copy JSON
                    </>
                  )}
                </button>
              </div>

              {viewMode === 'full' && fullJson && (
                <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12, padding: '6px 12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 6, display: 'inline-block', width: 'fit-content' }}>
                  * Fields highlighted in red are stripped/missing in the minimal WASM engine.
                </div>
              )}

              <pre className="db-viewer" style={{
                flex: 1,
                margin: 0,
                maxHeight: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                overflow: 'auto',
                fontSize: 12,
                padding: 16
              }}>
                {viewMode === 'minimal' ? (
                  JSON.stringify(rawJson, null, 2)
                ) : fullJson ? (
                  renderJsonWithDiff(fullJson, rawJson)
                ) : (
                  <span style={{ color: 'var(--error)' }}>System ffprobe CLI result is not available (dev server mode only).</span>
                )}
              </pre>
            </div>
          </div>
          </>
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
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
