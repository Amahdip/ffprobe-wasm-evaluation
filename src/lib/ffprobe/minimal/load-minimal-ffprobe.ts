import type { MinimalProbeResult } from './types'
import type { FfprobeTimings } from '../types'

// Classic worker served statically from public/. It importScripts() the
// Emscripten glue and mounts the File via WORKERFS, so the file is read
// lazily (only the byte ranges ffprobe seeks to) instead of being copied
// into memory. This removes the old ~2GB arrayBuffer()/MEMFS ceiling.
const WORKER_URL = '/engines/minimal-metadata/ffprobe.worker.js'

type WorkerResult =
  | { type: 'ready'; id: number }
  | { type: 'result'; id: number; ok: true; json: string; importMs: number; analyzeMs: number }
  | { type: 'result'; id: number; ok: false; error: string }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: WorkerResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker

  const w = new Worker(WORKER_URL)
  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    const msg = e.data
    const entry = pending.get(msg.id)
    if (!entry) return
    pending.delete(msg.id)
    entry.resolve(msg)
  }
  w.onerror = (e) => {
    // A worker-level error rejects every in-flight request; the worker is
    // discarded so the next call spins up a fresh one.
    const err = new Error(e.message || 'Minimal ffprobe worker crashed')
    for (const { reject } of pending.values()) reject(err)
    pending.clear()
    worker = null
  }
  worker = w
  return w
}

function send(message: { type: 'preload' | 'probe'; file?: File }): Promise<WorkerResult> {
  const w = getWorker()
  const id = nextId++
  return new Promise<WorkerResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ ...message, id })
  })
}

export async function analyzeWithMinimalFfprobe(file: File): Promise<{
  probe: MinimalProbeResult
  timings: FfprobeTimings
}> {
  const totalStart = performance.now()
  const res = await send({ type: 'probe', file })

  if (res.type !== 'result') {
    throw new Error('Unexpected response from minimal ffprobe worker')
  }
  if (!res.ok) {
    throw new Error(res.error)
  }

  const probe = JSON.parse(res.json) as MinimalProbeResult
  return {
    probe,
    timings: {
      importMs: res.importMs,
      initMs: 0,
      analyzeMs: res.analyzeMs,
      totalMs: performance.now() - totalStart,
    },
  }
}

export async function preloadMinimalFfprobe(): Promise<void> {
  await send({ type: 'preload' })
}
