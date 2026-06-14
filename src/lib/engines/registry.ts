import { ffprobeWasmEngine } from './ffprobe-wasm-engine'
import { internalWasmEngine } from './internal-engine'
import type { MediaAnalysisEngine } from './types'

const engineRegistry = new Map<string, MediaAnalysisEngine>()

function registerEngine(engine: MediaAnalysisEngine) {
  engineRegistry.set(engine.id, engine)
}

registerEngine(ffprobeWasmEngine)
registerEngine(internalWasmEngine)

export function getEngine(id: string): MediaAnalysisEngine | undefined {
  return engineRegistry.get(id)
}

export function getAllEngines(): MediaAnalysisEngine[] {
  return Array.from(engineRegistry.values())
}

export function getAvailableEngines(): MediaAnalysisEngine[] {
  return getAllEngines().filter((engine) => engine.available)
}

export function registerAdditionalEngine(engine: MediaAnalysisEngine) {
  registerEngine(engine)
}

export { engineRegistry }
