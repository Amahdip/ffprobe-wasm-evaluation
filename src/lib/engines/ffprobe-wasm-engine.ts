import {
  analyzeVideoFile,
  buildAnalyzeFailureResult,
  DEFAULT_UPLOADER_POLICY,
  evaluateUploaderValidation,
  type UploaderPolicy,
} from '../ffprobe'
import type { MediaAnalysisEngine } from './types'

export const ffprobeWasmEngine: MediaAnalysisEngine = {
  id: 'ffprobe-wasm',
  name: 'ffprobe-wasm',
  description: 'Client-side ffprobe via WebAssembly (lazy-loaded ~2.9 MiB gzip)',
  available: true,
  capabilities: {
    lazyLoaded: true,
    bundleImpactGzip: '~2.9 MiB gzip',
    bundleImpactBrotli: '~2.03 MiB brotli',
    supportedContainers: ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'matroska'],
    knownUnsupportedContainers: ['avi', 'flv'],
    notes: 'Requires COOP/COEP for SharedArrayBuffer',
  },
  async analyze(file: File, policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY) {
    const context = {
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
    }

    try {
      const { fileInfo, timings } = await analyzeVideoFile(file)
      const validation = evaluateUploaderValidation(fileInfo, context, policy)

      return {
        engineId: ffprobeWasmEngine.id,
        engineName: ffprobeWasmEngine.name,
        success: true,
        error: null,
        timings: {
          importMs: timings.importMs,
          initMs: timings.initMs,
          analyzeMs: timings.analyzeMs,
          totalMs: timings.totalMs,
        },
        metadata: validation.metadata,
        validation,
        rawOutput: fileInfo,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const validation = buildAnalyzeFailureResult(message, context, policy)

      return {
        engineId: ffprobeWasmEngine.id,
        engineName: ffprobeWasmEngine.name,
        success: false,
        error: message,
        timings: {
          importMs: 0,
          initMs: 0,
          analyzeMs: 0,
          totalMs: 0,
        },
        metadata: validation.metadata,
        validation,
        rawOutput: null,
      }
    }
  },
}

export async function analyzeWithFfprobeWasm(
  file: File,
  policy?: UploaderPolicy,
) {
  return ffprobeWasmEngine.analyze(file, policy)
}
