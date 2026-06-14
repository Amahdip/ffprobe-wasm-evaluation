export type FieldDiffStatus = 'match' | 'mismatch' | 'missing' | 'unsupported' | 'engine_failed'

export interface ComparisonFieldDefinition {
  key: string
  label: string
  format?: (value: unknown) => string
  tolerance?: number
}

export interface FieldComparisonCell {
  engineId: string
  engineName: string
  value: string
  rawValue: unknown
  present: boolean
  engineSuccess: boolean
}

export interface FieldComparisonRow {
  key: string
  label: string
  status: FieldDiffStatus
  cells: FieldComparisonCell[]
}

export interface EngineReliabilityScore {
  engineId: string
  engineName: string
  available: boolean
  success: boolean
  scorePercent: number
  fieldsDetected: number
  fieldsMissing: number
  fieldsTotal: number
  analyzeFailures: number
  unsupportedFormats: number
  details: string[]
}

export interface EngineBenchmarkRow {
  engineId: string
  engineName: string
  available: boolean
  success: boolean
  importMs: number
  initMs: number
  analyzeMs: number
  totalMs: number
}

export interface EngineComparisonReport {
  fileName: string
  engineIds: string[]
  fieldRows: FieldComparisonRow[]
  benchmarks: EngineBenchmarkRow[]
  reliabilityScores: EngineReliabilityScore[]
  mismatchCount: number
  missingCount: number
  recommendation: EngineComparisonRecommendation
}

export interface EngineComparisonRecommendation {
  preferredEngineId: string | null
  preferredEngineName: string | null
  summary: string
  reasons: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface MatrixEngineSummary {
  engineId: string
  engineName: string
  total: number
  success: number
  successRatePercent: number
}
