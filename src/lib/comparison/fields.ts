import type { NormalizedMetadata } from '../ffprobe/types'
import type { ComparisonFieldDefinition } from './types'

function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(digits)
}

export const COMPARISON_FIELDS: ComparisonFieldDefinition[] = [
  { key: 'containerFormat', label: 'Container' },
  { key: 'videoCodec', label: 'Video codec' },
  { key: 'audioCodec', label: 'Audio codec' },
  { key: 'width', label: 'Width', format: (v) => formatNumber(v as number | null, 0) },
  { key: 'height', label: 'Height', format: (v) => formatNumber(v as number | null, 0) },
  { key: 'fps', label: 'FPS', format: (v) => formatNumber(v as number | null, 3) },
  {
    key: 'bitrateBps',
    label: 'Bitrate',
    format: (v) => {
      const n = v as number | null
      return n != null ? `${Math.round(n / 1000)} kbps` : '—'
    },
  },
  {
    key: 'durationSeconds',
    label: 'Duration',
    format: (v) => {
      const n = v as number | null
      return n != null ? `${n.toFixed(3)}s` : '—'
    },
    tolerance: 0.05,
  },
  { key: 'hasVideo', label: 'Has video', format: (v) => String(v) },
  { key: 'hasAudio', label: 'Has audio', format: (v) => String(v) },
  { key: 'pixelFormat', label: 'Pixel format' },
  { key: 'videoProfile', label: 'Video profile' },
  { key: 'audioSampleRate', label: 'Audio sample rate', format: (v) => (v != null ? `${v} Hz` : '—') },
  { key: 'audioChannels', label: 'Audio channels', format: (v) => formatNumber(v as number | null, 0) },
  { key: 'isVertical', label: 'Vertical', format: (v) => String(v) },
  { key: 'isHdr', label: 'HDR', format: (v) => String(v) },
  { key: 'uploadSizeCategory', label: 'Upload size category' },
]

export function getMetadataFieldValue(metadata: NormalizedMetadata | null, key: string): unknown {
  if (!metadata) return null
  return metadata[key as keyof NormalizedMetadata]
}

export function formatComparisonValue(
  definition: ComparisonFieldDefinition,
  rawValue: unknown,
): string {
  if (rawValue === null || rawValue === undefined || rawValue === '') return '—'
  if (definition.format) return definition.format(rawValue)
  return String(rawValue)
}

export function valuesMatch(
  a: unknown,
  b: unknown,
  tolerance?: number,
): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  if (typeof a === 'number' && typeof b === 'number' && tolerance != null) {
    return Math.abs(a - b) <= tolerance
  }
  return String(a).toLowerCase() === String(b).toLowerCase()
}
