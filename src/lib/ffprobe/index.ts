export { buildAnalyzeFailureResult } from './analyze-failure'
export { analyzeVideoFile, createTimings, loadFfprobe, preloadFfprobe } from './load-ffprobe'
export { normalizeMetadata } from './normalize-metadata'
export { buildDimensionDiagnostics, getFieldReliability } from './diagnostics'
export { buildMetadataSources } from './metadata-sources'
export type { MetadataSourceMap } from './metadata-sources'
export { evaluateUploaderValidation, evaluatePreflight } from './uploader-validation'
export { buildRecommendationFromValidation, decisionBadgeClass, recommendationBadgeClass } from './recommendation'
export {
  getAudioStreams,
  getPrimaryAudioStream,
  getPrimaryVideoStream,
  getVideoStreams,
  readStreamDimension,
} from './stream-utils'
export {
  DEFAULT_UPLOADER_POLICY,
  DEFAULT_PREFLIGHT_CONFIG,
  type DimensionDiagnostics,
  type FfprobeTimings,
  type FileContext,
  type NormalizedMetadata,
  type PreflightConfig,
  type PreflightIssue,
  type PreflightResult,
  type UploaderPolicy,
  type ValidationCheckGroup,
  type ValidationDecision,
  type ValidationDiagnostics,
  type ValidationIssue,
  type ValidationResult,
} from './types'
