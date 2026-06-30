// @ts-ignore — generated Emscripten glue has no type declarations
import createFFprobe from './ffprobe.js'
import type {
  MinimalProbeResult,
  MinimalWasmModule,
  MaxrateAnalysis,
  MaxrateOptions,
  MaxrateWindowSource,
  SegmentResult,
} from './types.js'

export * from './types.js'

let modulePromise: Promise<MinimalWasmModule> | null = null

async function getModule(): Promise<MinimalWasmModule> {
  if (!modulePromise) {
    // Since SINGLE_FILE=1 is used, we do not need to specify locateFile.
    // The WASM binary is pre-embedded inside the JS file as a Base64 string.
    modulePromise = (createFFprobe as () => Promise<MinimalWasmModule>)()
  }
  return modulePromise!
}

function sanitizePath(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function writeVirtualFile(module: MinimalWasmModule, virtualPath: string, data: Uint8Array): void {
  if (module.FS?.writeFile) {
    module.FS.writeFile(virtualPath, data)
    return
  }

  if (module.FS_createDataFile) {
    const lastSlash = virtualPath.lastIndexOf('/')
    const parent = lastSlash >= 0 ? virtualPath.slice(0, lastSlash) || '/' : '/'
    const name = lastSlash >= 0 ? virtualPath.slice(lastSlash + 1) : virtualPath
    module.FS_createDataFile(parent, name, data, true, true, true)
    return
  }

  throw new Error('Minimal ffprobe module has no MEMFS write API')
}

function unlinkVirtualFile(module: MinimalWasmModule, virtualPath: string): void {
  if (module.FS_unlink) {
    module.FS_unlink(virtualPath)
    return
  }

  module.FS?.unlink?.(virtualPath)
}

// ── Worker path (large files) ───────────────────────────────────────
// Runs the probe in a Web Worker that mounts the File via WORKERFS, so the
// file is read lazily instead of being copied into memory. This removes the
// ~2GB ceiling of the arrayBuffer()/MEMFS path.

interface WorkerSegment {
  index: number
  startSec: number
  durationSec: number
  data: Uint8Array
}

type WorkerResult =
  | { id: number; ok: true; kind: 'probe'; json: string; importMs: number }
  | { id: number; ok: true; kind: 'walk'; packets: Float64Array; count: number; importMs: number; walkMs: number }
  | { id: number; ok: true; kind: 'segment'; segments: WorkerSegment[]; importMs: number; segmentMs: number }
  | { id: number; ok: false; error: string }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: WorkerResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  // `new URL(...import.meta.url)` is the bundler-standard form picked up by
  // Vite/webpack/Rollup to emit the worker chunk.
  const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    const entry = pending.get(e.data.id)
    if (!entry) return
    pending.delete(e.data.id)
    entry.resolve(e.data)
  }
  w.onerror = (e) => {
    const err = new Error(e.message || 'ffprobe worker crashed')
    for (const { reject } of pending.values()) reject(err)
    pending.clear()
    worker = null
  }
  worker = w
  return w
}

function analyzeViaWorker(file: File): Promise<MinimalProbeResult> {
  const w = getWorker()
  const id = nextId++
  return new Promise<WorkerResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, file })
  }).then((res) => {
    if (!res.ok) throw new Error(res.error)
    if (res.kind !== 'probe') throw new Error('unexpected worker response for probe')
    return JSON.parse(res.json) as MinimalProbeResult
  })
}

async function analyzeDirect(file: File): Promise<MinimalProbeResult> {
  const Module = await getModule()
  const virtualPath = `/probe_${Date.now()}_${sanitizePath(file.name)}`

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    writeVirtualFile(Module, virtualPath, data)

    const json = Module.ccall('get_file_info_json', 'string', ['string'], [virtualPath])
    if (!json) {
      throw new Error('Minimal ffprobe returned an empty response')
    }

    return JSON.parse(json) as MinimalProbeResult
  } finally {
    try {
      unlinkVirtualFile(Module, virtualPath)
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Analyzes a video or audio file using the client-side WebAssembly ffprobe engine.
 *
 * Uses a Web Worker + WORKERFS so files larger than ~2GB are probed without
 * being loaded into memory. When workers are unavailable, it falls back to an
 * in-place path that reads the whole file into memory (subject to the ~2GB
 * browser limit).
 *
 * @param file The file to probe (e.g. from an HTML file input or drop event).
 * @returns A promise resolving to the minimal ffprobe metadata JSON.
 */
export async function analyzeFile(file: File): Promise<MinimalProbeResult> {
  if (typeof Worker !== 'undefined' && typeof URL !== 'undefined') {
    try {
      return await analyzeViaWorker(file)
    } catch (err) {
      // Only fall back on worker-infrastructure failures (e.g. a bundler that
      // can't emit the worker chunk). A genuine probe failure is reported as
      // { ok: false } JSON and resolves normally, so it won't reach here.
      worker = null
      pending.clear()
      return analyzeDirect(file)
    }
  }
  return analyzeDirect(file)
}

// ── Packet walk + content-aware maxrate ─────────────────────────────
// Demuxes the video stream WITHOUT decoding and returns packed
// [pts, size, keyflag] triples, then derives the akuma analysis hint
// (peak window + keyframe list) + a source-derived maxrate preview.
//
// Walk requires a Worker + WORKERFS (FileReaderSync is worker-only); there is
// no main-thread fallback because that would copy the whole file into memory.

interface WalkData {
  packets: Float64Array
  count: number
  importMs: number
  walkMs: number
}

function walkViaWorker(file: File): Promise<WalkData> {
  const w = getWorker()
  const id = nextId++
  return new Promise<WorkerResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, file, kind: 'walk' })
  }).then((res) => {
    if (!res.ok) throw new Error(res.error)
    if (res.kind !== 'walk') throw new Error('unexpected worker response for walk')
    return { packets: res.packets, count: res.count, importMs: res.importMs, walkMs: res.walkMs }
  })
}

/**
 * Walks the video stream's packets (no decode) via a Web Worker + WORKERFS.
 * Returns packed [pts_sec, size_bytes, keyflag] triples.
 */
export async function walkVideoPackets(file: File): Promise<{ packets: Float64Array; count: number }> {
  if (typeof Worker === 'undefined' || typeof URL === 'undefined') {
    throw new Error('walkVideoPackets requires a Web Worker environment (WORKERFS is worker-only)')
  }
  const { packets, count } = await walkViaWorker(file)
  return { packets, count }
}

/**
 * Splits a video at keyframe boundaries into MPEG-TS chunks via stream copy
 * (no re-encode) in a Web Worker. Each chunk is a standalone, concat-joinable
 * .ts (H.264/HEVC, Annex-B) — the client-side equivalent of akuma's
 * `-f segment -c copy`. A new chunk opens at the first keyframe at/after each
 * `chunkSeconds` boundary, so chunk durations land near (but ≥, at the keyframe)
 * the target.
 */
export async function segmentVideo(file: File, chunkSeconds = 6): Promise<SegmentResult> {
  if (typeof Worker === 'undefined' || typeof URL === 'undefined') {
    throw new Error('segmentVideo requires a Web Worker environment (WORKERFS is worker-only)')
  }
  const t0 = performance.now()
  const w = getWorker()
  const id = nextId++
  const res = await new Promise<WorkerResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, file, kind: 'segment', chunkSeconds })
  })
  if (!res.ok) throw new Error(res.error)
  if (res.kind !== 'segment') throw new Error('unexpected worker response for segment')
  return {
    segments: res.segments,
    count: res.segments.length,
    timings: { importMs: res.importMs, segmentMs: res.segmentMs, totalMs: performance.now() - t0 },
  }
}

const DEFAULT_WINDOW_SECONDS = 60
const DEFAULT_HEADROOM = 1.3
const DEFAULT_CBR_THRESHOLD = 0.05

/** Per-second aggregate of NON-keyframe (P+B) bytes. Index = integer second. */
function perSecondNonKeyframeBytes(packets: Float64Array, n: number, numSeconds: number): Float64Array {
  const perSec = new Float64Array(Math.max(1, numSeconds))
  for (let i = 0; i < n; i++) {
    if (packets[i * 3 + 2] >= 0.5) continue // keyframe
    const sec = Math.floor(packets[i * 3])
    if (sec >= 0 && sec < perSec.length) perSec[sec] += packets[i * 3 + 1]
  }
  return perSec
}

function sumRange(perSec: Float64Array, startSec: number, endSec: number): number {
  const a = Math.max(0, Math.min(startSec, perSec.length))
  const b = Math.max(0, Math.min(endSec, perSec.length))
  let total = 0
  for (let i = a; i < b; i++) total += perSec[i]
  return total
}

// Rolling-sum sliding window: seed the first window, then add the incoming
// second and drop the outgoing one — O(numSeconds), O(1) per step.
function slidingPeakStart(perSec: Float64Array, numSeconds: number, windowSec: number): number {
  let sum = 0
  for (let i = 0; i < windowSec && i < numSeconds; i++) sum += perSec[i]
  let bestStart = 0
  let bestBytes = sum
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

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean <= 0) return 0
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length
  return Math.sqrt(variance) / mean
}

/** Sorted keyframe (IDR) presentation timestamps — the GOP boundaries akuma needs. */
function keyframeTimestamps(packets: Float64Array, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (packets[i * 3 + 2] >= 0.5) out.push(packets[i * 3])
  }
  out.sort((a, b) => a - b)
  return out
}

/**
 * Walks the file and derives akuma's analysis hint: the peak (busiest) window
 * by non-keyframe byte density, the keyframe/GOP timestamps, and a
 * source-derived maxrate preview. On a flat/CBR source (low coefficient of
 * variation) the packet sizes carry no motion signal, so it falls back to the
 * video midpoint instead of the byte-peak.
 */
export async function analyzeMaxrate(file: File, options: MaxrateOptions = {}): Promise<MaxrateAnalysis> {
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS
  const headroom = options.headroomFactor ?? DEFAULT_HEADROOM
  const cbrThreshold = options.cbrThreshold ?? DEFAULT_CBR_THRESHOLD

  const t0 = performance.now()
  const walk = await walkViaWorker(file)
  const mathStart = performance.now()

  const { packets } = walk
  const n = walk.count

  let durationSec = 0
  let keyframeCount = 0
  for (let i = 0; i < n; i++) {
    const pts = packets[i * 3]
    if (pts > durationSec) durationSec = pts
    if (packets[i * 3 + 2] >= 0.5) keyframeCount++
  }

  const W = Math.max(1, Math.round(windowSeconds))
  const numSeconds = Math.max(1, Math.ceil(durationSec))
  const perSec = perSecondNonKeyframeBytes(packets, n, numSeconds)

  // Tumbling segments → CBR metric.
  const tumbling: number[] = []
  for (let s = 0; s < numSeconds; s += W) tumbling.push(sumRange(perSec, s, s + W))
  const cv = coefficientOfVariation(tumbling)
  const isSourceCBR = tumbling.length >= 2 && cv < cbrThreshold

  let startSec: number
  let windowSource: MaxrateWindowSource
  if (durationSec <= windowSeconds) {
    startSec = 0
    windowSource = 'whole-video'
  } else if (isSourceCBR) {
    startSec = Math.max(0, Math.min(Math.round(durationSec / 2 - windowSeconds / 2), numSeconds - W))
    windowSource = 'midpoint-cbr'
  } else {
    startSec = slidingPeakStart(perSec, numSeconds, W)
    windowSource = 'sliding-peak'
  }

  const endSec = Math.min(durationSec, startSec + windowSeconds)
  const spanSec = Math.max(0.001, endSec - startSec)
  const windowBytes = sumRange(perSec, startSec, Math.ceil(endSec))
  const peakBitrateBps = (windowBytes * 8) / spanSec

  const mathMs = performance.now() - mathStart
  return {
    videoanalyze: {
      start: startSec,
      end: endSec,
      gop_timestamp: keyframeTimestamps(packets, n),
    },
    durationSec,
    packetCount: n,
    keyframeCount,
    isSourceCBR,
    cv,
    windowSource,
    peakBitrateKbps: Math.round(peakBitrateBps / 1000),
    maxrateKbps: Math.round((peakBitrateBps * headroom) / 1000),
    timings: {
      importMs: walk.importMs,
      walkMs: walk.walkMs,
      mathMs,
      totalMs: performance.now() - t0,
    },
  }
}
