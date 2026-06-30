// Module worker: probes a File via Emscripten WORKERFS so files larger than
// ~2GB can be analyzed without loading them into memory. WORKERFS reads only
// the byte ranges ffprobe seeks to (via FileReaderSync, which is worker-only).
//
// Two request kinds share the mount/cleanup machinery:
//   - 'probe' (default): get_file_info_json → metadata JSON string.
//   - 'walk': walk_video_packets → packed [pts, size, keyflag] Float64 triples,
//     demuxed without decoding. The buffer is transferred (zero-copy) to the
//     main thread.
//
// @ts-ignore — generated Emscripten glue has no type declarations
import createFFprobe from './ffprobe.js'
import type { MinimalWasmModule } from './types.js'

interface ProbeRequest {
  id: number
  file: File
  kind?: 'probe' | 'walk' | 'segment'
  /** segment only: target chunk length in seconds (cuts at next keyframe). */
  chunkSeconds?: number
}

interface WorkerSegment {
  index: number
  startSec: number
  durationSec: number
  data: Uint8Array
}

type ProbeResponse =
  | { id: number; ok: true; kind: 'probe'; json: string; importMs: number }
  | { id: number; ok: true; kind: 'walk'; packets: Float64Array; count: number; importMs: number; walkMs: number }
  | { id: number; ok: true; kind: 'segment'; segments: WorkerSegment[]; importMs: number; segmentMs: number }
  | { id: number; ok: false; error: string }

let modulePromise: Promise<MinimalWasmModule> | null = null
let importStart = 0
let importMs = 0
let mountCounter = 0

function getModule(): Promise<MinimalWasmModule> {
  if (!modulePromise) {
    // SINGLE_FILE build embeds the wasm as base64 — no locateFile needed.
    importStart = performance.now()
    modulePromise = (createFFprobe as () => Promise<MinimalWasmModule>)().then((m) => {
      importMs = performance.now() - importStart
      return m
    })
  }
  return modulePromise
}

function post(message: ProbeResponse, transfer: Transferable[] = []): void {
  ;(self as unknown as Worker).postMessage(message, transfer)
}

self.onmessage = async (event: MessageEvent<ProbeRequest>) => {
  const { id, file, kind = 'probe', chunkSeconds = 6 } = event.data
  try {
    const Module = await getModule()
    const dir = `/probe_${mountCounter++}`
    const path = `${dir}/input`

    Module.FS.mkdir(dir)
    // Lazy-read mount — the File is never copied wholesale into wasm memory.
    Module.FS.mount(Module.WORKERFS, { blobs: [{ name: 'input', data: file }] }, dir)
    try {
      if (kind === 'segment') {
        const segStart = performance.now()
        const outDir = `${dir}_out`
        Module.FS.mkdir(outDir)
        const ptr = Module.ccall<number>(
          'segment_video',
          'number',
          ['string', 'number', 'string'],
          [path, chunkSeconds, `${outDir}/seg_`],
        )
        if (!ptr) throw new Error('segment_video returned null (open failed or no video stream)')
        const heap = Module.HEAPF64
        const base = ptr / 8
        const count = heap[base]
        const segments: WorkerSegment[] = []
        const transfer: Transferable[] = []
        for (let j = 0; j < count; j++) {
          const startSec = heap[base + 1 + 3 * j]
          const durationSec = heap[base + 1 + 3 * j + 1]
          const segPath = `${outDir}/seg_${String(j).padStart(3, '0')}.ts`
          // readFile returns a view into MEMFS; copy so we can free + transfer it.
          const data = Module.FS.readFile(segPath).slice()
          Module.FS.unlink(segPath)
          segments.push({ index: j, startSec, durationSec, data })
          transfer.push(data.buffer)
        }
        Module._free?.(ptr)
        try {
          Module.FS.rmdir(outDir)
        } catch {
          // ignore
        }
        post({ id, ok: true, kind: 'segment', segments, importMs, segmentMs: performance.now() - segStart }, transfer)
      } else if (kind === 'walk') {
        const walkStart = performance.now()
        const ptr = Module.ccall<number>('walk_video_packets', 'number', ['string'], [path])
        if (!ptr) throw new Error('walk_video_packets returned null (open failed or no video stream)')
        // Re-read HEAPF64 AFTER the call — ALLOW_MEMORY_GROWTH may have moved it.
        const heap = Module.HEAPF64
        const base = ptr / 8 // byte offset → Float64 element index
        const count = heap[base]
        // slice() detaches a standalone copy from the wasm heap so we can free + transfer.
        const packets = heap.slice(base + 1, base + 1 + 3 * count)
        Module._free?.(ptr)
        post({ id, ok: true, kind: 'walk', packets, count, importMs, walkMs: performance.now() - walkStart }, [
          packets.buffer,
        ])
      } else {
        const json = Module.ccall<string>('get_file_info_json', 'string', ['string'], [path])
        if (!json) throw new Error('Minimal ffprobe returned an empty response')
        post({ id, ok: true, kind: 'probe', json, importMs })
      }
    } finally {
      try {
        Module.FS.unmount(dir)
        Module.FS.rmdir(dir)
      } catch {
        // ignore cleanup errors
      }
    }
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
