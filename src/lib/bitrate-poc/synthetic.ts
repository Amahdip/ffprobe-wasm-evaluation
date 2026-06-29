// Synthetic packet generator — lets you exercise the stats + UI + perf harness
// BEFORE rebuilding the WASM with walk_video_packets exported.
//
// Produces the same flat [pts, size, keyflag] triples the worker returns,
// modelling a calm -> busy -> NOISE -> busy timeline so the histogram shows a
// realistic right-skewed/multimodal distribution (and so you can confirm the
// noise stretch does NOT win the P95 once you add anti-noise handling later).

export interface SyntheticOptions {
  durationSec: number
  fps: number
  /** Keyframe (IDR) interval in seconds. */
  gopSec: number
  /**
   * Constant-bitrate mode: every segment gets ~identical byte size (e.g. a
   * Premiere 10 Mbps CBR export). Used to exercise the CBR-trap detection.
   */
  cbr: boolean
}

const DEFAULTS: SyntheticOptions = { durationSec: 600, fps: 30, gopSec: 2, cbr: false }

interface Phase {
  /** Fraction of the timeline this phase covers. */
  weight: number
  /** Mean non-keyframe packet size (bytes) for this phase. */
  meanSize: number
  /** Relative jitter (0..1). */
  jitter: number
}

// calm dialogue -> action -> sensor NOISE (biggest packets, low value) -> action
const PHASES: Phase[] = [
  { weight: 0.4, meanSize: 4_000, jitter: 0.3 },
  { weight: 0.25, meanSize: 16_000, jitter: 0.4 },
  { weight: 0.15, meanSize: 60_000, jitter: 0.2 }, // noise: huge but worthless
  { weight: 0.2, meanSize: 18_000, jitter: 0.4 },
]

// Deterministic PRNG so runs are comparable (no Math.random — keeps numbers stable).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateSyntheticPackets(options: Partial<SyntheticOptions> = {}): Float64Array {
  const opts: SyntheticOptions = { ...DEFAULTS, ...options }
  const rnd = mulberry32(1234567)
  const frameCount = Math.floor(opts.durationSec * opts.fps)
  const gopFrames = Math.max(1, Math.round(opts.gopSec * opts.fps))

  // cumulative phase boundaries (in frame index)
  const totalWeight = PHASES.reduce((s, p) => s + p.weight, 0)
  const bounds: number[] = []
  let acc = 0
  for (const p of PHASES) {
    acc += p.weight / totalWeight
    bounds.push(Math.floor(acc * frameCount))
  }
  const phaseAt = (f: number): Phase => {
    for (let i = 0; i < bounds.length; i++) if (f < bounds[i]) return PHASES[i]
    return PHASES[PHASES.length - 1]
  }

  // CBR mode: flat target size everywhere, tiny jitter → very low CV.
  const CBR_MEAN = 40_000

  const triples: number[] = []
  for (let f = 0; f < frameCount; f++) {
    const pts = f / opts.fps
    const isKey = f % gopFrames === 0
    let size: number
    if (opts.cbr) {
      // Constant rate: P/B frames near-identical; small bounded jitter (±2%).
      const j = 1 + (rnd() * 2 - 1) * 0.02
      size = isKey ? CBR_MEAN * 1.8 : CBR_MEAN * j
    } else {
      const phase = phaseAt(f)
      if (isKey) {
        // I-frames are the largest; scale off the phase mean.
        size = phase.meanSize * 6 * (0.8 + 0.4 * rnd())
      } else {
        const j = 1 + (rnd() * 2 - 1) * phase.jitter
        size = phase.meanSize * j
      }
    }
    triples.push(pts, Math.max(1, Math.round(size)), isKey ? 1 : 0)
  }
  return Float64Array.from(triples)
}
