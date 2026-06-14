import { getAllEngines, getEngine } from './registry'
import type { AnalysisResult, MediaAnalysisEngine } from './types'
import { buildFailedAnalysisResult } from './types'
import type { UploaderPolicy } from '../ffprobe/types'
import { DEFAULT_UPLOADER_POLICY } from '../ffprobe/types'

export async function runEngineAnalysis(
  engineId: string,
  file: File,
  policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY,
): Promise<AnalysisResult> {
  const engine = getEngine(engineId)
  if (!engine) {
    return buildFailedAnalysisResult(
      { id: engineId, name: engineId, description: '', available: false, capabilities: { lazyLoaded: false }, analyze: async () => { throw new Error('missing') } },
      `Engine "${engineId}" is not registered.`,
    )
  }

  if (!engine.available) {
    return engine.analyze(file, policy)
  }

  return engine.analyze(file, policy)
}

export async function runEnginesAnalysis(
  engineIds: string[],
  file: File,
  policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY,
): Promise<AnalysisResult[]> {
  const uniqueIds = [...new Set(engineIds)]
  return Promise.all(uniqueIds.map((id) => runEngineAnalysis(id, file, policy)))
}

export async function runAllRegisteredEngines(
  file: File,
  policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY,
): Promise<AnalysisResult[]> {
  return runEnginesAnalysis(getAllEngines().map((e) => e.id), file, policy)
}

export function resolveEngineSelection(
  mode: 'single' | 'compare',
  selectedIds: string[],
): string[] {
  if (mode === 'compare') {
    return getAllEngines().map((e) => e.id)
  }
  return selectedIds.length > 0 ? [selectedIds[0]] : ['ffprobe-wasm']
}

export type { MediaAnalysisEngine, AnalysisResult }
