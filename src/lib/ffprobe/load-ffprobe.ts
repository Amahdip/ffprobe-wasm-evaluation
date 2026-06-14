import type { FileInfo } from 'ffprobe-wasm'
import { assertFfprobeWasmEnvironment } from '../browser-environment'
import type { FfprobeTimings } from './types'

type FFprobeModule = typeof import('ffprobe-wasm')

interface LoadedFfprobe {
  getFileInfo: (file: File) => Promise<FileInfo>
  terminate: () => void
}

let ffprobeModulePromise: Promise<FFprobeModule> | null = null
let ffprobeWorker: InstanceType<FFprobeModule['FFprobeWorker']> | null = null

async function importFfprobeModule(): Promise<FFprobeModule> {
  if (!ffprobeModulePromise) {
    ffprobeModulePromise = import('ffprobe-wasm')
  }

  return ffprobeModulePromise
}

export async function loadFfprobe(): Promise<LoadedFfprobe> {
  const totalStart = performance.now()

  const importStart = performance.now()
  const module = await importFfprobeModule()
  const importMs = performance.now() - importStart
  console.info(`[ffprobe] import ffprobe-wasm: ${importMs.toFixed(1)}ms`)

  if (!ffprobeWorker) {
    const initStart = performance.now()
    ffprobeWorker = new module.FFprobeWorker()
    const workerInitMs = performance.now() - initStart
    console.info(`[ffprobe] initialize wasm worker: ${workerInitMs.toFixed(1)}ms`)
  } else {
    console.info(`[ffprobe] initialize wasm worker: 0.0ms (already loaded)`)
  }

  const worker = ffprobeWorker

  return {
    async getFileInfo(file: File) {
      const analyzeStart = performance.now()
      const fileInfo = await worker.getFileInfo(file)
      const analyzeMs = performance.now() - analyzeStart
      const totalMs = performance.now() - totalStart

      console.info(`[ffprobe] analyze file: ${analyzeMs.toFixed(1)}ms`)
      console.info(`[ffprobe] total (this run): ${totalMs.toFixed(1)}ms`)

      return fileInfo
    },
    terminate() {
      worker.terminate()
      ffprobeWorker = null
      ffprobeModulePromise = null
    },
  }
}

export function createTimings(
  importMs: number,
  initMsValue: number,
  analyzeMs: number,
): FfprobeTimings {
  return {
    importMs,
    initMs: initMsValue,
    analyzeMs,
    totalMs: importMs + initMsValue + analyzeMs,
  }
}

export async function preloadFfprobe(): Promise<void> {
  const importStart = performance.now()
  const module = await importFfprobeModule()
  const importMs = performance.now() - importStart
  console.info(`[ffprobe] import ffprobe-wasm: ${importMs.toFixed(1)}ms`)

  if (!ffprobeWorker) {
    const initStart = performance.now()
    ffprobeWorker = new module.FFprobeWorker()
    const initMsValue = performance.now() - initStart
    console.info(`[ffprobe] initialize wasm worker: ${initMsValue.toFixed(1)}ms`)
  }
}

export async function analyzeVideoFile(file: File): Promise<{
  fileInfo: FileInfo
  timings: FfprobeTimings
}> {
  assertFfprobeWasmEnvironment()

  const importStart = performance.now()
  const module = await importFfprobeModule()
  const importMs = performance.now() - importStart

  let initMsValue = 0

  if (!ffprobeWorker) {
    const initStart = performance.now()
    ffprobeWorker = new module.FFprobeWorker()
    initMsValue = performance.now() - initStart
  }

  const analyzeStart = performance.now()
  const fileInfo = await ffprobeWorker.getFileInfo(file)
  const analyzeMs = performance.now() - analyzeStart

  console.info(`[ffprobe] import ffprobe-wasm: ${importMs.toFixed(1)}ms`)
  console.info(`[ffprobe] initialize wasm worker: ${initMsValue.toFixed(1)}ms`)
  console.info(`[ffprobe] analyze file: ${analyzeMs.toFixed(1)}ms`)

  return {
    fileInfo,
    timings: createTimings(importMs, initMsValue, analyzeMs),
  }
}
