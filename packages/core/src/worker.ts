// Module worker: probes a File via Emscripten WORKERFS so files larger than
// ~2GB can be analyzed without loading them into memory. WORKERFS reads only
// the byte ranges ffprobe seeks to (via FileReaderSync, which is worker-only).
//
// @ts-ignore — generated Emscripten glue has no type declarations
import createFFprobe from './ffprobe.js'
import type { MinimalWasmModule } from './types.js'

interface ProbeRequest {
  id: number
  file: File
}

type ProbeResponse =
  | { id: number; ok: true; json: string }
  | { id: number; ok: false; error: string }

let modulePromise: Promise<MinimalWasmModule> | null = null
let mountCounter = 0

function getModule(): Promise<MinimalWasmModule> {
  if (!modulePromise) {
    // SINGLE_FILE build embeds the wasm as base64 — no locateFile needed.
    modulePromise = (createFFprobe as () => Promise<MinimalWasmModule>)()
  }
  return modulePromise
}

function post(message: ProbeResponse): void {
  ;(self as unknown as Worker).postMessage(message)
}

self.onmessage = async (event: MessageEvent<ProbeRequest>) => {
  const { id, file } = event.data
  try {
    const Module = await getModule()
    const dir = `/probe_${mountCounter++}`
    const path = `${dir}/input`

    Module.FS.mkdir(dir)
    // Lazy-read mount — the File is never copied wholesale into wasm memory.
    Module.FS.mount(Module.WORKERFS, { blobs: [{ name: 'input', data: file }] }, dir)
    try {
      const json = Module.ccall('get_file_info_json', 'string', ['string'], [path])
      if (!json) throw new Error('Minimal ffprobe returned an empty response')
      post({ id, ok: true, json })
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
