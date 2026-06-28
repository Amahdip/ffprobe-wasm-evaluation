// @ts-ignore — generated Emscripten glue has no type declarations
import createFFprobe from './ffprobe.js'
import type { MinimalProbeResult, MinimalWasmModule } from './types.js'

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

type WorkerResult =
  | { id: number; ok: true; json: string }
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
