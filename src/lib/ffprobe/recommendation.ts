import type { ValidationResult } from './types'

export interface RecommendationSummary {
  recommendationLabel: string
  reason: string
  goodFor: string[]
  risks: string[]
  caveats: string[]
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
    'Container / format detection',
    'Video & audio codec identification',
    'Duration, bitrate, FPS, resolution',
    'Has-audio / has-video / stream counts',
    'HDR / color metadata (minimal engine)',
    'Rotation / orientation (minimal engine)',
    'Wrong-extension detection',
    'No-audio and codec warnings',
  ]

  const risks = [
    'pixelFormat, videoProfile, videoLevel unavailable in minimal (decoders removed)',
    'Corrupted/truncated files return in-band errors — do not block upload on probe failure alone',
    'Backend / Akuma validation remains authoritative',
  ]

  const caveats = [
    'If profile/level/pix_fmt become hard requirements, evaluate a targeted H.264-only decoder variant',
    'Browser validation of minimal-metadata still pending in production',
    'npm ffprobe-wasm still requires COOP/COEP; minimal-metadata does not',
  ]

  const reason =
    'Use optimized minimal-metadata ffprobe as the preferred pre-upload analysis engine, pending browser validation. It preserves core preflight metadata while significantly reducing payload and removing SharedArrayBuffer / COOP-COEP requirements.'

  return {
    recommendationLabel: 'Prefer minimal-metadata (pending validation)',
    reason,
    goodFor,
    risks,
    caveats,
    decision: 'use_with_fallback',
    title: 'Prefer minimal-metadata ffprobe for upload preflight',
    pros: goodFor,
    cons: risks,
    decisionText: reason,
    doNotUseFor: [
      'Authoritative validation without backend confirmation',
      'Blocking upload solely because ffprobe analysis failed',
      'H.264 profile/level gates without a decoder-enabled variant',
    ],
    productionRisks: risks,
    summary: reason,
  }
}

export function decisionBadgeClass(decision: import('./types').ValidationDecision): string {
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
  return 'badge badge-success'
}
