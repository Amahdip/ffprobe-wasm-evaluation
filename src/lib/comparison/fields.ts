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
  {
    key: 'durationSeconds',
    label: 'Duration',
    format: (v) => {
      const n = v as number | null
      return n != null ? `${n.toFixed(3)}s` : '—'
    },
    tolerance: 0.05,
  },
  {
    key: 'bitrateBps',
    label: 'Bitrate',
    format: (v) => {
      const n = v as number | null
      return n != null ? `${Math.round(n / 1000)} kbps` : '—'
    },
  },
  { key: 'fps', label: 'FPS', format: (v) => formatNumber(v as number | null, 3) },
  { key: 'width', label: 'Width', format: (v) => formatNumber(v as number | null, 0) },
  { key: 'height', label: 'Height', format: (v) => formatNumber(v as number | null, 0) },
  {
    key: 'codecWidth',
    label: 'Codec width',
    format: (v) => formatNumber(v as number | null, 0),
  },
  {
    key: 'codecHeight',
    label: 'Codec height',
    format: (v) => formatNumber(v as number | null, 0),
  },
  { key: 'hasAudio', label: 'Has audio', format: (v) => String(v) },
  { key: 'hasVideo', label: 'Has video', format: (v) => String(v) },
  {
    key: 'videoStreamCount',
    label: 'Video streams',
    format: (v) => formatNumber(v as number | null, 0),
  },
  {
    key: 'audioStreamCount',
    label: 'Audio streams',
    format: (v) => formatNumber(v as number | null, 0),
  },
  { key: 'rotation', label: 'Rotation', format: (v) => (v != null ? `${v}°` : '—') },
  { key: 'colorPrimaries', label: 'Color primaries' },
  { key: 'colorTransfer', label: 'Color transfer' },
  { key: 'colorSpace', label: 'Color space' },
  { key: 'isHdr', label: 'HDR', format: (v) => String(v) },
  { key: 'pixelFormat', label: 'Pixel format' },
  { key: 'videoProfile', label: 'Video profile' },
  {
    key: 'videoLevel',
    label: 'Video level',
    format: (v) => formatNumber(v as number | null, 0),
  },
]

const FIELD_EXTRACTORS: Record<string, (metadata: NormalizedMetadata) => unknown> = {
  codecWidth: (m) => m.videoStreamDimensions.rawCodecWidth ?? m.width,
  codecHeight: (m) => m.videoStreamDimensions.rawCodecHeight ?? m.height,
}

export function getMetadataFieldValue(metadata: NormalizedMetadata | null, key: string): unknown {
  if (!metadata) return null
  const extractor = FIELD_EXTRACTORS[key]
  if (extractor) return extractor(metadata)
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
