// Bitrate PoC — client-side analysis math (ffprobe-wasm only; NO akuma changes).
//
// Implements the agreed design:
//   1. ONE ultimate 10s time-span, found by a SLIDING window (second-by-second)
//      over the packet data — the window with the highest aggregate NON-keyframe
//      (P+B) byte size = peak motion density.
//   2. CBR-trap defense: if the per-segment byte distribution is ~flat
//      (coefficient of variation below a threshold), the source is pre-allocated
//      CBR (e.g. Premiere 10 Mbps), packet sizes carry no motion signal, so we
//      fall back to the video MIDPOINT (avoids probing static opening credits).
//
// This stays purely on the client as a preflight visualization + window picker.
// The real maxrate is decided server-side: akuma re-encodes the Chosen Time-Span
// (-f null - at the target preset/CRF), which collapses an over-provisioned CBR
// source down to its true perceptual need. The client cannot encode, so the
// kbps reported here is SOURCE-derived (a function of the source's bytes) and is
// only an upper-bound preview, not the shipped ceiling.

export interface PocOptions {
  /** Sliding + tumbling window length in seconds (the "10-second span"). */
  windowSeconds: number
  /** Sliding step in seconds (second-by-second = 1). */
  slideSeconds: number
  /** Peak-to-average / safety multiplier applied to the chosen window's bitrate. */
  headroomFactor: number
  /**
   * CBR detection threshold: coefficient of variation (stddev/mean) of the
   * tumbling-segment sizes. Below this, the distribution is "flat" => CBR.
   */
  cbrThreshold: number
  /** Number of buckets for the histogram / bell curve. */
  histogramBuckets: number
}

export const DEFAULT_POC_OPTIONS: PocOptions = {
  windowSeconds: 60,
  slideSeconds: 1,
  headroomFactor: 1.3,
  cbrThreshold: 0.05,
  histogramBuckets: 24,
}

export type WindowSource = 'sliding-peak' | 'midpoint-cbr' | 'whole-video'

export interface ChosenWindow {
  startSec: number
  endSec: number
  /** Aggregate non-keyframe (P+B) bytes inside the window. */
  nonKeyframeBytes: number
  /** nonKeyframeBytes * 8 / spanSec. SOURCE-derived (see file header). */
  bitrateBps: number
  source: WindowSource
}

/** Tumbling (non-overlapping) segment — used for the histogram + timeline. */
export interface BinStat {
  index: number
  startSec: number
  spanSec: number
  nonKeyframeBytes: number
  bitrateBps: number
}

export interface HistogramData {
  labels: string[]
  counts: number[]
  bucketEdges: number[]
}

export interface ChartJsBarSpec {
  type: 'bar'
  data: { labels: string[]; datasets: Array<{ label: string; data: number[] }> }
  options: Record<string, unknown>
}

export interface PocResult {
  packetCount: number
  durationSec: number
  keyframeCount: number
  /** Tumbling segments, for the bell curve + timeline. */
  bins: BinStat[]
  /** The single chosen 10s span (sliding peak, or midpoint if CBR). */
  chosen: ChosenWindow
  isSourceCBR: boolean
  /** Coefficient of variation of the tumbling-segment sizes (the CBR metric). */
  cv: number
  /** chosen.bitrateBps * headroomFactor — SOURCE-derived preview, not shipped. */
  maxBitrateBps: number
  maxBitrateKbps: number
  histogram: HistogramData
  chartJs: ChartJsBarSpec
  mathMs: number
}

function formatMbit(bytes: number): string {
  return ((bytes * 8) / 1_000_000).toFixed(1)
}

/** Per-second aggregate of NON-keyframe (P+B) bytes. Index = integer second. */
function perSecondNonKeyframeBytes(packets: Float64Array, numSeconds: number): Float64Array {
  const perSec = new Float64Array(Math.max(1, numSeconds))
  const n = Math.floor(packets.length / 3)
  for (let i = 0; i < n; i++) {
    const isKey = packets[i * 3 + 2] >= 0.5
    if (isKey) continue
    const sec = Math.floor(packets[i * 3])
    if (sec >= 0 && sec < perSec.length) perSec[sec] += packets[i * 3 + 1]
  }
  return perSec
}

/** Simple range sum over per-second buckets (one-off lookups). */
function sumRange(perSec: Float64Array, startSec: number, endSec: number): number {
  const a = Math.max(0, Math.min(startSec, perSec.length))
  const b = Math.max(0, Math.min(endSec, perSec.length))
  let total = 0
  for (let i = a; i < b; i++) total += perSec[i]
  return total
}

/**
 * Sliding window, second-by-second, with a ROLLING sum: compute the first
 * window once, then for each step ADD the incoming second and SUBTRACT the
 * outgoing one — never recompute from zero. O(numSeconds) total, O(1) per step.
 * Returns the integer start-second of the heaviest non-keyframe window.
 */
function slidingPeakStart(perSec: Float64Array, numSeconds: number, windowSec: number): number {
  // Seed: bytes in the very first window [0, windowSec).
  let sum = 0
  for (let i = 0; i < windowSec && i < numSeconds; i++) sum += perSec[i]

  let bestStart = 0
  let bestBytes = sum

  // Slide: window [s, s+windowSec). Each step: +perSec[s+windowSec-1] -perSec[s-1].
  const lastStart = numSeconds - windowSec
  for (let s = 1; s <= lastStart; s++) {
    sum += perSec[s + windowSec - 1] - perSec[s - 1]
    if (sum > bestBytes) {
      bestBytes = sum
      bestStart = s
    }
  }
  return bestStart
}

/** Coefficient of variation (stddev / mean) of non-overlapping window sizes. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean <= 0) return 0
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length
  return Math.sqrt(variance) / mean
}

export function analyzePackets(packets: Float64Array, options: Partial<PocOptions> = {}): PocResult {
  const opts: PocOptions = { ...DEFAULT_POC_OPTIONS, ...options }
  const mathStart = performance.now()

  const n = Math.floor(packets.length / 3)
  let durationSec = 0
  let keyframeCount = 0
  for (let i = 0; i < n; i++) {
    const pts = packets[i * 3]
    if (pts > durationSec) durationSec = pts
    if (packets[i * 3 + 2] >= 0.5) keyframeCount++
  }

  const W = Math.max(1, Math.round(opts.windowSeconds))
  const numSeconds = Math.max(1, Math.ceil(durationSec))
  const perSec = perSecondNonKeyframeBytes(packets, numSeconds)

  // --- Tumbling segments (for histogram + timeline + CBR metric) ---
  const bins: BinStat[] = []
  for (let start = 0, idx = 0; start < numSeconds; start += W, idx++) {
    const span = Math.max(0.001, Math.min(W, durationSec - start))
    const bytes = sumRange(perSec, start, start + W)
    bins.push({
      index: idx,
      startSec: start,
      spanSec: span,
      nonKeyframeBytes: bytes,
      bitrateBps: (bytes * 8) / span,
    })
  }

  // --- CBR detection: is the segment-size distribution flat? ---
  const tumblingSizes = bins.map((b) => b.nonKeyframeBytes)
  const cv = coefficientOfVariation(tumblingSizes)
  const isSourceCBR = bins.length >= 2 && cv < opts.cbrThreshold

  // --- Choose the single ultimate window ---
  let chosen: ChosenWindow
  if (durationSec <= opts.windowSeconds) {
    // Video shorter than one window: use the whole thing.
    const bytes = sumRange(perSec, 0, numSeconds)
    chosen = {
      startSec: 0,
      endSec: durationSec,
      nonKeyframeBytes: bytes,
      bitrateBps: (bytes * 8) / Math.max(0.001, durationSec),
      source: 'whole-video',
    }
  } else if (isSourceCBR) {
    // CBR: packet sizes carry no motion signal — probe the midpoint instead,
    // centred on 50% so we skip static opening credits.
    let start = Math.round(durationSec / 2 - opts.windowSeconds / 2)
    start = Math.max(0, Math.min(start, numSeconds - W))
    const bytes = sumRange(perSec, start, start + W)
    chosen = {
      startSec: start,
      endSec: start + opts.windowSeconds,
      nonKeyframeBytes: bytes,
      bitrateBps: (bytes * 8) / opts.windowSeconds,
      source: 'midpoint-cbr',
    }
  } else {
    // VBR: slide second-by-second, pick the heaviest non-keyframe window.
    const start = slidingPeakStart(perSec, numSeconds, W)
    const bytes = sumRange(perSec, start, start + W)
    chosen = {
      startSec: start,
      endSec: start + opts.windowSeconds,
      nonKeyframeBytes: bytes,
      bitrateBps: (bytes * 8) / opts.windowSeconds,
      source: 'sliding-peak',
    }
  }

  const maxBitrateBps = chosen.bitrateBps * opts.headroomFactor
  const histogram = buildHistogram([...tumblingSizes].sort((a, b) => a - b), opts.histogramBuckets)

  const chartJs: ChartJsBarSpec = {
    type: 'bar',
    data: { labels: histogram.labels, datasets: [{ label: `# of ${W}s segments`, data: histogram.counts }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: true, text: 'Segment-size distribution (non-keyframe bytes)' } },
      scales: {
        x: { title: { display: true, text: 'Segment size (Mbit)' } },
        y: { title: { display: true, text: 'Frequency (segments)' }, beginAtZero: true },
      },
    },
  }

  return {
    packetCount: n,
    durationSec,
    keyframeCount,
    bins,
    chosen,
    isSourceCBR,
    cv,
    maxBitrateBps,
    maxBitrateKbps: Math.round(maxBitrateBps / 1000),
    histogram,
    chartJs,
    mathMs: performance.now() - mathStart,
  }
}

function buildHistogram(sizesSorted: number[], buckets: number): HistogramData {
  const labels: string[] = []
  const counts: number[] = new Array(buckets).fill(0)
  const bucketEdges: number[] = []

  if (sizesSorted.length === 0) {
    return { labels: ['—'], counts: [0], bucketEdges: [0, 0] }
  }

  const min = sizesSorted[0]
  const max = sizesSorted[sizesSorted.length - 1]
  const span = max - min || 1
  const width = span / buckets

  for (let b = 0; b <= buckets; b++) bucketEdges.push(min + b * width)
  for (let b = 0; b < buckets; b++) labels.push(`${formatMbit(bucketEdges[b])}–${formatMbit(bucketEdges[b + 1])}`)
  for (const v of sizesSorted) {
    let idx = Math.floor((v - min) / width)
    if (idx >= buckets) idx = buckets - 1
    if (idx < 0) idx = 0
    counts[idx]++
  }
  return { labels, counts, bucketEdges }
}
