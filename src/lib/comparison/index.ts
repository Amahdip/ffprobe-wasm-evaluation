export type {
  EngineBenchmarkRow,
  EngineComparisonRecommendation,
  EngineComparisonReport,
  EngineReliabilityScore,
  FieldComparisonCell,
  FieldComparisonRow,
  FieldDiffStatus,
  MatrixEngineSummary,
} from './types'
export { COMPARISON_FIELDS } from './fields'
export {
  buildBenchmarkRows,
  buildEngineComparisonReport,
  buildFieldComparisonRows,
  calculateReliabilityScore,
  diffStatusBadgeClass,
  diffStatusLabel,
  summarizeMatrixByEngine,
} from './compare'
