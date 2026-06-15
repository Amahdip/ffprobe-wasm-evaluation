import type { NormalizedMetadata, UploaderPolicy, ValidationResult } from '../ffprobe/types'

export interface EngineTimings {
  importMs: number
  initMs: number
  analyzeMs: number
  totalMs: number
}

export interface EngineCapabilities {
  lazyLoaded: boolean
  bundleImpactGzip?: string
  supportedContainers?: string[]
  knownUnsupportedContainers?: string[]
  notes?: string
}

export interface AnalysisResult {
  engineId: string
  engineName: string
  success: boolean
  error: string | null
  timings: EngineTimings
  metadata: NormalizedMetadata | null
  validation: ValidationResult | null
  rawOutput: unknown | null
}

export interface MediaAnalysisEngine {
  id: string
  name: string
  description: string
  available: boolean
  capabilities: EngineCapabilities
  analyze(file: File, policy?: UploaderPolicy): Promise<AnalysisResult>
}

export const EMPTY_TIMINGS: EngineTimings = {
  importMs: 0,
  initMs: 0,
  analyzeMs: 0,
  totalMs: 0,
}

export function buildFailedAnalysisResult(
  engine: MediaAnalysisEngine,
  error: string,
  timings: EngineTimings = EMPTY_TIMINGS,
): AnalysisResult {
  return {
    engineId: engine.id,
    engineName: engine.name,
    success: false,
    error,
    timings,
    metadata: null,
    validation: null,
    rawOutput: null,
  }
}
