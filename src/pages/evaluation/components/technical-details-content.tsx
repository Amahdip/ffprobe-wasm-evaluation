import type { FileInfo } from 'ffprobe-wasm'
import type { EngineComparisonReport } from '../../../lib/comparison'
import type { AnalysisResult } from '../../../lib/engines/types'
import type { ValidationResult } from '../../../lib/ffprobe'
import { BundleImpactCard } from './bundle-impact-card'
import { EngineSelector, type AnalyzeMode } from './engine-selector'
import type { ViewMode } from './view-mode-toggle'
import {
  CheckGroupPanel,
  DimensionMetaItem,
  FieldTagSection,
  IssueList,
  MetaItem,
  SourceItem,
  diagnosticCalloutClass,
} from './evaluation-detail-blocks'

interface TechnicalDetailsContentProps {
  viewMode: ViewMode
  validation: ValidationResult | null
  primaryEngineName: string
  rawOutput: FileInfo | null
  engineResults: AnalysisResult[]
  comparisonReport: EngineComparisonReport | null
  analyzeMode: AnalyzeMode
  selectedEngineId: string
  matrixEngineIds: string[]
  onModeChange: (mode: AnalyzeMode) => void
  onEngineChange: (engineId: string) => void
  onMatrixEnginesChange: (engineIds: string[]) => void
}

export function TechnicalDetailsContent({
  viewMode,
  validation,
  primaryEngineName,
  rawOutput,
  engineResults,
  comparisonReport,
  analyzeMode,
  selectedEngineId,
  matrixEngineIds,
  onModeChange,
  onEngineChange,
  onMatrixEnginesChange,
}: TechnicalDetailsContentProps) {
  return (
    <div className="technical-details-content">
      {viewMode === 'overview' ? (
        <EngineSelector
          mode={analyzeMode}
          selectedEngineId={selectedEngineId}
          matrixEngineIds={matrixEngineIds}
          onModeChange={onModeChange}
          onEngineChange={onEngineChange}
          onMatrixEnginesChange={onMatrixEnginesChange}
        />
      ) : null}


      <BundleImpactCard mode={analyzeMode} selectedEngineId={selectedEngineId} />

      {validation ? (
        <>
          <section className="card">
            <h2 className="card-title">Normalized metadata</h2>
            <p className="status-text engine-source-label">
              Source engine: <strong>{primaryEngineName}</strong> (primary successful engine for detailed validation)
            </p>
            <dl className="meta-grid">
              <MetaItem label="Container" value={validation.metadata.containerFormat} />
              <MetaItem label="Duration" value={validation.metadata.durationSeconds != null ? `${validation.metadata.durationSeconds.toFixed(3)}s` : '—'} />
              <MetaItem label="Video codec" value={validation.metadata.videoCodec} />
              <MetaItem label="Audio codec" value={validation.metadata.audioCodec} />
              <DimensionMetaItem validation={validation} />
              <MetaItem label="FPS" value={validation.metadata.fps?.toFixed(3) ?? '—'} />
              <MetaItem label="Bitrate" value={validation.metadata.bitrateBps != null ? `${Math.round(validation.metadata.bitrateBps / 1000)} kbps` : '—'} />
              <MetaItem label="File size" value={validation.metadata.fileSizeBytes != null ? `${(validation.metadata.fileSizeBytes / 1_000_000).toFixed(2)} MB` : '—'} />
              <MetaItem label="Pixel format" value={validation.metadata.pixelFormat} />
              <MetaItem label="Video profile" value={validation.metadata.videoProfile ? `${validation.metadata.videoProfile}${validation.metadata.videoLevel != null ? ` L${validation.metadata.videoLevel}` : ''}` : '—'} />
            </dl>
          </section>

          <section className="card">
            <h2 className="card-title">Preflight checks</h2>
            <p className="status-text engine-source-label">
              Policy validation for <strong>{primaryEngineName}</strong> — backend/Akuma remains authoritative.
            </p>
            <div className="check-groups">
              {validation.checkGroups.map((group) => (
                <CheckGroupPanel key={group.id} group={group} />
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="card-title">Diagnostics</h2>
            <p className="status-text engine-source-label">
              Normalizer diagnostics for <strong>{primaryEngineName}</strong>.
            </p>
            <dl className="meta-grid">
              <MetaItem label="Raw video width" value={validation.diagnostics.dimensions.rawVideoWidth} />
              <MetaItem label="Raw video height" value={validation.diagnostics.dimensions.rawVideoHeight} />
              <MetaItem label="Raw codec_width" value={validation.diagnostics.dimensions.rawVideoCodecWidth} />
              <MetaItem label="Raw codec_height" value={validation.diagnostics.dimensions.rawVideoCodecHeight} />
            </dl>
            <div className={diagnosticCalloutClass(validation.diagnostics.dimensions.conclusion)}>
              <strong>{validation.diagnostics.dimensions.conclusion}</strong>
              <p>{validation.diagnostics.dimensions.explanation}</p>
            </div>
            <FieldTagSection label="Reliable fields" fields={validation.diagnostics.reliableFields} variant="reliable" />
            <FieldTagSection label="Fallback fields" fields={validation.diagnostics.fallbackFields} variant="fallback" />
          </section>

          <section className="card">
            <h2 className="card-title">Metadata source</h2>
            <p className="status-text engine-source-label">
              Field provenance from <strong>{primaryEngineName}</strong> raw output.
            </p>
            <dl className="source-grid">
              <SourceItem label="Resolution" value={validation.metadata.width && validation.metadata.height ? `${validation.metadata.width}×${validation.metadata.height}` : '—'} source={validation.diagnostics.metadataSources.resolution} isFallback={validation.diagnostics.dimensions.dimensionSource === 'codec_fallback'} />
              <SourceItem label="FPS" value={validation.metadata.fps?.toFixed(3) ?? '—'} source={validation.diagnostics.metadataSources.fps} />
              <SourceItem label="Video codec" value={validation.metadata.videoCodec} source={validation.diagnostics.metadataSources.videoCodec} />
              <SourceItem label="Duration" value={validation.metadata.durationSeconds != null ? `${validation.metadata.durationSeconds.toFixed(3)}s` : '—'} source={validation.diagnostics.metadataSources.duration} />
            </dl>
          </section>

          <div className="grid-two-cols">
            <section className="card">
              <h2 className="card-title">Warnings</h2>
              <IssueList items={validation.warnings} empty="No warnings." variant="warnings" />
            </section>
            <section className="card">
              <h2 className="card-title">Errors</h2>
              <IssueList items={validation.errors} empty="No errors." variant="errors" />
            </section>
          </div>
        </>
      ) : null}

      {engineResults.length > 0 ? (
        <details className="technical-details">
          <summary>Raw engine output ({engineResults.length} engine(s))</summary>
          {engineResults.map((result) => (
            <div key={result.engineId} style={{ marginTop: 12 }}>
              <h3 className="card-subtitle">{result.engineName}</h3>
              <pre className="db-viewer">{JSON.stringify(result.rawOutput, null, 2)}</pre>
            </div>
          ))}
        </details>
      ) : rawOutput ? (
        <section className="card">
          <h2 className="card-title">Raw ffprobe JSON ({primaryEngineName})</h2>
          <pre className="db-viewer">{JSON.stringify(rawOutput, null, 2)}</pre>
        </section>
      ) : null}

      {comparisonReport && viewMode === 'technical' ? (
        <details className="technical-details">
          <summary>Per-field comparison (full diff)</summary>
          <pre className="db-viewer">{JSON.stringify(comparisonReport.fieldRows, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  )
}
