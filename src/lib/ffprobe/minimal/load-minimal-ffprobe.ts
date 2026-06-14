import type { CreateMinimalFfprobe, MinimalProbeResult, MinimalWasmModule } from './types'
import type { FfprobeTimings } from '../types'

const SCRIPT_URL = '/engines/minimal-metadata/ffprobe.js'
const WASM_BASE = '/engines/minimal-metadata/'

declare global {
  interface Window {
    createFFprobe?: CreateMinimalFfprobe
  }
}

let scriptPromise: Promise<CreateMinimalFfprobe> | null = null
let modulePromise: Promise<MinimalWasmModule> | null = null

function loadScript(): Promise<CreateMinimalFfprobe> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    if (window.createFFprobe) {
      resolve(window.createFFprobe)
      return
    }

    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.createFFprobe) resolve(window.createFFprobe)
        else reject(new Error('minimal ffprobe script loaded but createFFprobe missing'))
      })
      existing.addEventListener('error', () => reject(new Error('Failed to load minimal ffprobe script')))
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.createFFprobe) resolve(window.createFFprobe)
      else reject(new Error('minimal ffprobe script loaded but createFFprobe missing'))
    }
    script.onerror = () => reject(new Error(`Failed to load ${SCRIPT_URL}`))
    document.head.appendChild(script)
  })

  return scriptPromise
}

async function getModule(): Promise<MinimalWasmModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const createFFprobe = await loadScript()
      return createFFprobe({
        locateFile: (path) => `${WASM_BASE}${path}`,
      })
    })()
  }
  return modulePromise
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

  throw new Error('Minimal ffprobe module has no MEMFS write API (FS.writeFile or FS_createDataFile)')
}

function unlinkVirtualFile(module: MinimalWasmModule, virtualPath: string): void {
  if (module.FS_unlink) {
    module.FS_unlink(virtualPath)
    return
  }

  module.FS?.unlink?.(virtualPath)
}

export async function analyzeWithMinimalFfprobe(file: File): Promise<{
  probe: MinimalProbeResult
  timings: FfprobeTimings
}> {
  if (!window.isSecureContext) {
    throw new Error('Minimal ffprobe requires a secure context (HTTPS or localhost).')
  }

  const totalStart = performance.now()
  const importStart = performance.now()
  const Module = await getModule()
  const importMs = performance.now() - importStart
  const initMs = 0

  const virtualPath = `/probe_${Date.now()}_${sanitizePath(file.name)}`
  const analyzeStart = performance.now()

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    writeVirtualFile(Module, virtualPath, data)
    const json = Module.ccall('get_file_info_json', 'string', ['string'], [virtualPath])
    if (!json) {
      throw new Error('Minimal ffprobe returned an empty response')
    }
    const probe = JSON.parse(json) as MinimalProbeResult
    const analyzeMs = performance.now() - analyzeStart

    return {
      probe,
      timings: {
        importMs,
        initMs,
        analyzeMs,
        totalMs: performance.now() - totalStart,
      },
    }
  } finally {
    try {
      unlinkVirtualFile(Module, virtualPath)
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function preloadMinimalFfprobe(): Promise<void> {
  await getModule()
}
