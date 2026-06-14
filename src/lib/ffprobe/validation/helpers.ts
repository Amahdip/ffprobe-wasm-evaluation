import type { ValidationIssue } from '../types'

export function createIssue(
  code: string,
  message: string,
  severity: ValidationIssue['severity'],
): ValidationIssue {
  return { code, message, severity }
}

export function normalizeCodec(codec: string | null): string {
  return codec?.toLowerCase() ?? ''
}

export function containerAllowed(detected: string | null, allowed: string[]): boolean {
  if (!detected) return false
  const parts = detected.toLowerCase().split(',')
  return allowed.some((allowedContainer) =>
    parts.some((part) => part.includes(allowedContainer.toLowerCase())),
  )
}

/** Broadcast / cinema rates — not treated as suspicious FPS values */
export const ACCEPTED_FPS = [
  23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 72, 90, 100, 120,
]

export function isAcceptedFps(fps: number): boolean {
  return ACCEPTED_FPS.some((standard) => Math.abs(fps - standard) < 0.08)
}

export function isVfrSuspected(
  avgFps: number | null,
  rawFps: number | null,
  relativeThreshold = 0.03,
): boolean {
  if (avgFps === null || rawFps === null || avgFps <= 0 || rawFps <= 0) {
    return false
  }

  const relativeDiff = Math.abs(avgFps - rawFps) / Math.max(avgFps, rawFps)
  if (relativeDiff <= relativeThreshold) {
    return false
  }

  // NTSC fractional pairs (e.g. 24000/1001 vs 24/1) should not warn
  if (isAcceptedFps(avgFps) && isAcceptedFps(rawFps)) {
    return false
  }

  return true
}

const STANDARD_ASPECT_RATIOS = [
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '1:1', value: 1 },
  { label: '21:9', value: 21 / 9 },
]

export function getAspectRatioLabel(width: number, height: number, tolerance = 0.04): string | null {
  if (width <= 0 || height <= 0) return null
  const ratio = width / height
  const match = STANDARD_ASPECT_RATIOS.find(
    (entry) => Math.abs(ratio - entry.value) / entry.value <= tolerance,
  )
  return match?.label ?? null
}

export function isStandardAspectRatio(width: number, height: number, tolerance = 0.04): boolean {
  return getAspectRatioLabel(width, height, tolerance) !== null
}

const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67', 'smpte428', 'hlg'])
const HDR_PRIMARIES = new Set(['bt2020', 'smpte432'])

export function isHdrVideo(
  colorPrimaries: string | null,
  colorTransfer: string | null,
): boolean {
  const transfer = colorTransfer?.toLowerCase() ?? ''
  const primaries = colorPrimaries?.toLowerCase() ?? ''
  return HDR_TRANSFERS.has(transfer) || HDR_PRIMARIES.has(primaries)
}

export function is10BitPixelFormat(pixelFormat: string | null): boolean {
  if (!pixelFormat) return false
  return /10(le|be)?$/i.test(pixelFormat) || pixelFormat.includes('p10')
}

export function isInterlacedFieldOrder(fieldOrder: string | null): boolean {
  if (!fieldOrder) return false
  const normalized = fieldOrder.toLowerCase()
  return normalized !== 'progressive' && normalized !== 'unknown' && normalized !== ''
}

export function uploadSizeDisplayLabel(category: string): string {
  if (category === 'very_large') return 'huge'
  if (category === 'tiny') return 'small'
  return category
}

export function parseStreamNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '' || value === 'N/A') return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}
