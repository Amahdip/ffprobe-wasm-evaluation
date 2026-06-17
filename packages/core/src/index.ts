// @ts-ignore
import createFFprobe from './ffprobe.js'
import type { MinimalProbeResult, MinimalWasmModule } from './types.js'

export * from './types.js'

let modulePromise: Promise<MinimalWasmModule> | null = null

async function getModule(): Promise<MinimalWasmModule> {
  if (!modulePromise) {
    // Since SINGLE_FILE=1 is used, we do not need to specify locateFile.
    // The WASM binary is pre-embedded inside the JS file as a Base64 string.
    modulePromise = (createFFprobe as any)()
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

/**
 * Analyzes a video or audio file using the client-side WebAssembly ffprobe engine.
 * 
 * @param file The file to probe (e.g. from an HTML file input or drop event).
 * @returns A promise resolving to the minimal ffprobe metadata JSON.
 */
export async function analyzeFile(file: File): Promise<MinimalProbeResult> {
  const Module = await getModule()
  const virtualPath = `/probe_${Date.now()}_${sanitizePath(file.name)}`

  try {
    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)
    writeVirtualFile(Module, virtualPath, data)
    
    const json = Module.ccall('get_file_info_json', 'string', ['string'], [virtualPath])
    if (!json) {
      throw new Error('Minimal ffprobe returned an empty response')
    }
    
    const probe = JSON.parse(json) as MinimalProbeResult
    return probe
  } finally {
    try {
      unlinkVirtualFile(Module, virtualPath)
    } catch {
      // ignore cleanup errors
    }
  }
}
