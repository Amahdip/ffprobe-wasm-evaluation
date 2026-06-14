import type { ValidationDecision, ValidationResult } from './types'

export interface RecommendationSummary {
  recommendationLabel: string
  reason: string
  goodFor: string[]
  risks: string[]
  /** @deprecated use recommendationLabel */
  decision: 'use_with_fallback'
  /** @deprecated use recommendationLabel */
  title: string
  /** @deprecated use goodFor */
  pros: string[]
  /** @deprecated use risks */
  cons: string[]
  /** @deprecated use reason */
  decisionText: string
  /** @deprecated use risks */
  doNotUseFor: string[]
  /** @deprecated use risks */
  productionRisks: string[]
  /** @deprecated use reason */
  summary: string
}

export function buildRecommendationFromValidation(_result: ValidationResult | null): RecommendationSummary {
  const goodFor = [
    'Codec detection',
    'Duration',
    'FPS',
    'Bitrate',
    'Audio/video presence',
    'No-audio warning',
    'AV1/HEVC warning',
    'Extension mismatch',
  ]

  const risks = [
    '~2.9 MiB gzip lazy chunk',
    'AVI/FLV unsupported in current tests',
    'Corrupted files fail',
    'Dimensions require codec_width/codec_height fallback',
    'Backend/Akuma validation must remain authoritative',
  ]

  const reason =
    'ffprobe-wasm is suitable as a lazy-loaded pre-upload warning layer, but not as the authoritative validator.'

  return {
    recommendationLabel: 'Use with fallback',
    reason,
    goodFor,
    risks,
    decision: 'use_with_fallback',
    title: 'Use ffprobe-wasm before upload',
    pros: goodFor,
    cons: risks,
    decisionText: reason,
    doNotUseFor: [
      'Authoritative validation',
      'Blocking upload solely because ffprobe-wasm failed',
      'Resolution-only gates without backend confirmation',
    ],
    productionRisks: risks,
    summary: reason,
  }
}

export function decisionBadgeClass(decision: ValidationDecision): string {
  switch (decision) {
    case 'pass':
      return 'badge badge-success'
    case 'warn':
      return 'badge badge-warning'
    case 'soft_fail':
      return 'badge badge-info'
    case 'block':
      return 'badge badge-error'
    default:
      return 'badge badge-info'
  }
}

export function recommendationBadgeClass(): string {
  return 'badge badge-warning'
}
