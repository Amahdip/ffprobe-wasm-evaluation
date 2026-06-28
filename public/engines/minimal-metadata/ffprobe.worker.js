/*
 * ffprobe.worker.js — runs the minimal ffprobe WASM inside a Web Worker.
 *
 * Why a worker: WORKERFS mounts a File/Blob and reads only the byte ranges
 * ffprobe seeks to (via FileReaderSync, which is worker-only). This avoids
 * loading the whole file into memory, so files far larger than the old
 * ~2GB ArrayBuffer/MEMFS ceiling can be probed with near-constant memory.
 *
 * Protocol (postMessage):
 *   main -> worker: { type: 'preload', id }
 *   main -> worker: { type: 'probe', id, file }
 *   worker -> main: { type: 'ready', id }
 *                   { type: 'result', id, ok: true, json, importMs, analyzeMs }
 *                   { type: 'result', id, ok: false, error }
 */

/* eslint-disable no-undef */

// Defines self.createFFprobe (Emscripten MODULARIZE). Relative path resolves
// against this worker's location: /engines/minimal-metadata/.
importScripts('./ffprobe.js')

const WASM_BASE = '/engines/minimal-metadata/'

let modulePromise = null
let importMs = 0
let mountCounter = 0

function getModule() {
  if (!modulePromise) {
    const start = performance.now()
    modulePromise = self
      .createFFprobe({ locateFile: (path) => `${WASM_BASE}${path}` })
      .then((mod) => {
        importMs = performance.now() - start
        return mod
      })
  }
  return modulePromise
}

async function probe(file) {
  const Module = await getModule()
  const dir = `/probe_${mountCounter++}`
  const path = `${dir}/input`

  Module.FS.mkdir(dir)
  // WORKERFS reads lazily from the Blob — no full-file copy into WASM memory.
  Module.FS.mount(Module.WORKERFS, { blobs: [{ name: 'input', data: file }] }, dir)

  const analyzeStart = performance.now()
  try {
    const json = Module.ccall('get_file_info_json', 'string', ['string'], [path])
    const analyzeMs = performance.now() - analyzeStart
    if (!json) {
      throw new Error('Minimal ffprobe returned an empty response')
    }
    return { json, analyzeMs }
  } finally {
    try {
      Module.FS.unmount(dir)
      Module.FS.rmdir(dir)
    } catch {
      // ignore cleanup errors
    }
  }
}

self.onmessage = async (e) => {
  const { type, id } = e.data || {}

  if (type === 'preload') {
    try {
      await getModule()
      self.postMessage({ type: 'ready', id })
    } catch (err) {
      self.postMessage({ type: 'result', id, ok: false, error: errorMessage(err) })
    }
    return
  }

  if (type === 'probe') {
    try {
      const { json, analyzeMs } = await probe(e.data.file)
      self.postMessage({ type: 'result', id, ok: true, json, importMs, analyzeMs })
    } catch (err) {
      self.postMessage({ type: 'result', id, ok: false, error: errorMessage(err) })
    }
  }
}

function errorMessage(err) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Minimal ffprobe worker error'
}
