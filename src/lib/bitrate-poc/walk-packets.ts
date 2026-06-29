// Main-thread bridge to the WORKERFS packet-walk PoC.
//
// Spins up the existing minimal-ffprobe worker, sends a `walk` message, and
// receives a transferred Float64Array of [pts, size, keyflag] triples. The
// transfer is zero-copy, so even a multi-hour file's packet table (a few MB
// of doubles) does not get duplicated across the worker boundary.
//
// NOTE: requires the WASM rebuilt with `walk_video_packets` exported
// (see wasm-build/build.sh + docs/bitrate-poc.md). Until then, use the
// synthetic generator in ./synthetic.ts to exercise the math + UI.

const WORKER_URL = '/engines/minimal-metadata/ffprobe.worker.js'

export interface WalkTimings {
  /** WASM module download + compile/init (first run only). */
  importMs: number
  /** The packet walk itself: demux + heap copy inside the worker. */
  analyzeMs: number
  /** Wall-clock from postMessage to result, incl. transfer. */
  totalMs: number
}

export interface WalkResult {
  /** Flat triples: [pts_sec, size_bytes, keyflag(0|1)] * count. */
  packets: Float64Array
  count: number
  timings: WalkTimings
}

export function walkVideoPackets(file: File): Promise<WalkResult> {
  return new Promise<WalkResult>((resolve, reject) => {
    const worker = new Worker(WORKER_URL)
    const id = 1
    const totalStart = performance.now()

    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as
        | { type: 'walkResult'; id: number; ok: true; packets: Float64Array; count: number; importMs: number; analyzeMs: number }
        | { type: 'walkResult'; id: number; ok: false; error: string }
      if (m.type !== 'walkResult' || m.id !== id) return
      worker.terminate()
      if (!m.ok) {
        reject(new Error(m.error))
        return
      }
      resolve({
        packets: m.packets,
        count: m.count,
        timings: {
          importMs: m.importMs,
          analyzeMs: m.analyzeMs,
          totalMs: performance.now() - totalStart,
        },
      })
    }

    worker.onerror = (e: ErrorEvent) => {
      worker.terminate()
      reject(new Error(e.message || 'minimal ffprobe worker crashed'))
    }

    worker.postMessage({ type: 'walk', id, file })
  })
}
