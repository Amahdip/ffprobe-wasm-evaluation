import {
  buildAnalyzeFailureResult,
  DEFAULT_UPLOADER_POLICY,
  evaluateUploaderValidation,
  type UploaderPolicy,
} from '../ffprobe'
import { analyzeWithMinimalFfprobe } from '../ffprobe/minimal/load-minimal-ffprobe'
import { normalizeMinimalProbe } from '../ffprobe/minimal/normalize-minimal-metadata'
import type { MediaAnalysisEngine } from './types'

export const minimalMetadataEngine: MediaAnalysisEngine = {
  id: 'minimal-metadata-ffprobe',
  name: 'minimal-metadata-ffprobe',
  description: 'Optimized metadata-only ffprobe (~530 KB gzip, no pthreads / no COOP-COEP)',
  available: true,
  capabilities: {
    lazyLoaded: true,
    bundleImpactGzip: '~530 KB gzip',
    bundleImpactBrotli: '~430 KB brotli',
    supportedContainers: ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'matroska', 'avi', 'flv', 'mp3'],
    knownUnsupportedContainers: [],
    notes: 'Single-threaded; standalone .wasm; no SharedArrayBuffer required',
  },
  async analyze(file: File, policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY) {
    const context = {
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
    }

    try {
      const { probe, timings } = await analyzeWithMinimalFfprobe(file)

      if (!probe.ok) {
        const message = probe.error_detail ?? probe.error ?? 'Probe failed'
        const metadata = normalizeMinimalProbe(probe, context)
        const validation = buildAnalyzeFailureResult(message, context, policy)
        validation.metadata = { ...validation.metadata, ...metadata }

        return {
          engineId: minimalMetadataEngine.id,
          engineName: minimalMetadataEngine.name,
          success: false,
          error: message,
          timings,
          metadata,
          validation,
          rawOutput: probe,
        }
      }

      const metadata = normalizeMinimalProbe(probe, context)
      const fileInfoLike = {
        format: {
          format_name: probe.format_name,
          duration: probe.duration != null ? String(probe.duration) : undefined,
          bit_rate: probe.bit_rate != null ? String(probe.bit_rate) : undefined,
          nb_streams: probe.nb_streams,
        },
        streams: (probe.streams ?? []).map((s) => ({
          index: s.index,
          codec_type: s.codec_type === 'video' ? 'video' : s.codec_type === 'audio' ? 'audio' : s.codec_type,
          codec_name: s.codec_name,
          width: s.width,
          height: s.height,
          codec_width: s.codec_width,
          codec_height: s.codec_height,
          avg_frame_rate: s.avg_frame_rate,
          bit_rate: s.bit_rate != null ? String(s.bit_rate) : undefined,
          duration: s.duration != null ? String(s.duration) : undefined,
          profile: s.profile,
          level: s.level,
          pix_fmt: s.pix_fmt,
          channels: s.channels,
          sample_rate: s.sample_rate != null ? String(s.sample_rate) : undefined,
          tags: s.tags,
          color_primaries: s.color_primaries,
          color_transfer: s.color_transfer,
          color_range: s.color_range,
          sample_aspect_ratio: s.sample_aspect_ratio,
          display_aspect_ratio: s.display_aspect_ratio,
        })),
      }

      const validation = evaluateUploaderValidation(fileInfoLike as never, context, policy)
      validation.metadata = metadata

      return {
        engineId: minimalMetadataEngine.id,
        engineName: minimalMetadataEngine.name,
        success: true,
        error: null,
        timings,
        metadata,
        validation,
        rawOutput: probe,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const validation = buildAnalyzeFailureResult(message, context, policy)

      return {
        engineId: minimalMetadataEngine.id,
        engineName: minimalMetadataEngine.name,
        success: false,
        error: message,
        timings: validation.metadata ? { importMs: 0, initMs: 0, analyzeMs: 0, totalMs: 0 } : { importMs: 0, initMs: 0, analyzeMs: 0, totalMs: 0 },
        metadata: validation.metadata,
        validation,
        rawOutput: null,
      }
    }
  },
}
